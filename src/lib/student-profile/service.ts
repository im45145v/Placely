import type { Models } from "node-appwrite";
import { Query } from "node-appwrite";
import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { getServerDatabases } from "@/lib/appwrite/server";
import { AppError, isNotFoundError } from "@/lib/errors";
import type { AppUser, StudentProfile } from "@/types";
import {
  buildPlacementFromStudentInput,
  calculateProfileCompletion,
  canEditStudentProfile,
  canViewStudentProfile,
  isStudentSelf,
  normalizeAcademicInput,
  normalizeIdentityInput,
  normalizeProfessionalInput,
  sanitizeStudentProfilePayloadForStudent,
} from "./rules";
import type { StudentProfileUpdatePayload, StudentProfileView } from "./types";

export async function getStudentProfileForActor(
  actor: AppUser,
  targetUserId = actor.$id
): Promise<StudentProfileView> {
  const user = await readUser(targetUserId);
  const profile = await readStudentProfileByUserId(targetUserId);

  if (!canViewStudentProfile(actor, user.$id, user.universityId)) {
    throw AppError.forbidden("You do not have access to this profile.");
  }

  return toStudentProfileView(user, profile);
}

export async function updateStudentProfileForActor(
  actor: AppUser,
  targetUserId: string,
  payload: StudentProfileUpdatePayload
): Promise<StudentProfileView> {
  const databases = getServerDatabases();
  const user = await readUser(targetUserId);
  const profile = await readStudentProfileByUserId(targetUserId);

  if (!canEditStudentProfile(actor, user.$id, user.universityId)) {
    throw AppError.forbidden("You do not have permission to update this profile.");
  }

  const effectivePayload = isStudentSelf(actor, targetUserId)
    ? sanitizeStudentProfilePayloadForStudent(payload)
    : payload;

  const identityPatch = normalizeIdentityInput(effectivePayload.identity);
  const academicPatch = normalizeAcademicInput(effectivePayload.academic);
  const professionalPatch = normalizeProfessionalInput(effectivePayload.professional);
  const placement = buildPlacementFromStudentInput(
    profile.placement as StudentProfile["placement"] & Record<string, unknown>,
    effectivePayload.placement
  );

  const nextUser = {
    ...user,
    ...(identityPatch.name ? { name: identityPatch.name } : {}),
    updatedAt: new Date().toISOString(),
  };

  const nextProfile: Omit<StudentProfile, "$id"> = {
    userId: profile.userId,
    universityId: profile.universityId,
    personalInfo: {
      ...profile.personalInfo,
      ...(identityPatch.phone !== undefined ? { phone: identityPatch.phone } : {}),
      ...(identityPatch.dateOfBirth !== undefined ? { dateOfBirth: identityPatch.dateOfBirth } : {}),
      ...(identityPatch.gender !== undefined ? { gender: identityPatch.gender } : {}),
    },
    academic: {
      ...profile.academic,
      ...academicPatch,
    },
    professional: {
      ...profile.professional,
      ...professionalPatch,
      previousCompanies: professionalPatch.previousCompanies ?? profile.professional.previousCompanies,
      previousTitles: professionalPatch.previousTitles ?? profile.professional.previousTitles,
      internships: professionalPatch.internships ?? profile.professional.internships,
      certifications: professionalPatch.certifications ?? profile.professional.certifications,
      skills: professionalPatch.skills ?? profile.professional.skills,
      projects: professionalPatch.projects ?? profile.professional.projects,
    },
    placement,
    customFields: profile.customFields,
    isProfileComplete: false,
    createdAt: profile.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const completionPercentage = calculateProfileCompletion({
    identity: {
      name: nextUser.name,
      email: nextUser.email,
      phone: nextProfile.personalInfo.phone,
      dateOfBirth: nextProfile.personalInfo.dateOfBirth,
    },
    academic: nextProfile.academic,
    professional: nextProfile.professional,
  });

  nextProfile.isProfileComplete = completionPercentage === 100;

  await databases.updateDocument(DATABASE_ID, Collections.USERS, user.$id, {
    name: nextUser.name,
    updatedAt: nextUser.updatedAt,
  });

  const updatedProfileDoc = await databases.updateDocument(
    DATABASE_ID,
    Collections.STUDENT_PROFILES,
    profile.$id,
    {
      personalInfo: nextProfile.personalInfo,
      academic: nextProfile.academic,
      professional: nextProfile.professional,
      placement: nextProfile.placement,
      customFields: nextProfile.customFields,
      isProfileComplete: nextProfile.isProfileComplete,
      updatedAt: nextProfile.updatedAt,
    }
  );

  return toStudentProfileView(nextUser, docToStudentProfile(updatedProfileDoc, profile.$id));
}

async function readUser(userId: string): Promise<AppUser> {
  const databases = getServerDatabases();
  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(
      DATABASE_ID,
      Collections.USERS,
      userId
    );

    return {
      $id: doc.$id,
      name: String(doc.name),
      email: String(doc.email),
      universityId: String(doc.universityId),
      role: doc.role as AppUser["role"],
      isActive: Boolean(doc.isActive),
      onboardingCompletedAt: doc.onboardingCompletedAt as string | undefined,
      createdAt: (doc.createdAt as string) ?? doc.$createdAt,
      updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      throw AppError.notFound("User not found.");
    }
    throw error;
  }
}

async function readStudentProfileByUserId(userId: string): Promise<StudentProfile> {
  const databases = getServerDatabases();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.STUDENT_PROFILES,
    [Query.equal("userId", userId), Query.limit(1)]
  );

  const doc = result.documents[0];
  if (!doc) {
    throw AppError.notFound("Student profile not found.");
  }

  return docToStudentProfile(doc, doc.$id);
}

function docToStudentProfile(
  doc: Models.DefaultDocument,
  id: string
): StudentProfile {
  return {
    $id: id,
    userId: String(doc.userId),
    universityId: String(doc.universityId),
    personalInfo: (doc.personalInfo as StudentProfile["personalInfo"]) ?? {},
    academic: (doc.academic as StudentProfile["academic"]) ?? {},
    professional: (doc.professional as StudentProfile["professional"]) ?? {
      previousCompanies: [],
      previousTitles: [],
      internships: [],
      certifications: [],
      skills: [],
      projects: [],
    },
    placement: (doc.placement as StudentProfile["placement"]) ?? {
      status: "NOT_PLACED",
      numberOfOffers: 0,
      placementHistory: [],
    },
    customFields: (doc.customFields as Record<string, unknown>) ?? {},
    isProfileComplete: Boolean(doc.isProfileComplete),
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function toStudentProfileView(
  user: AppUser,
  profile: StudentProfile
): StudentProfileView {
  const completionPercentage = calculateProfileCompletion({
    identity: {
      name: user.name,
      email: user.email,
      phone: profile.personalInfo.phone,
      dateOfBirth: profile.personalInfo.dateOfBirth,
    },
    academic: profile.academic,
    professional: profile.professional,
  });

  return {
    identity: {
      userId: user.$id,
      name: user.name,
      email: user.email,
      universityId: user.universityId,
      role: user.role,
    },
    profile: {
      profileId: profile.$id,
      personalInfo: profile.personalInfo,
      academic: profile.academic,
      professional: profile.professional,
      placement: profile.placement as StudentProfileView["profile"]["placement"],
      completionPercentage,
      isProfileComplete: completionPercentage === 100,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
  };
}
