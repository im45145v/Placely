/**
 * User record synchronization.
 *
 * After a successful Google OAuth login we ensure an AppUser document exists
 * in the `users` Appwrite collection.  On first login the document is created
 * with role = "student" and a placeholder universityId.  On subsequent logins
 * the existing document is returned.
 *
 * Role is ALWAYS read from the database, never from the browser.
 *
 * SERVER-SIDE ONLY — do not import from Client Components.
 */
import { Databases, type Models } from "node-appwrite";
import { createServerClient } from "@/lib/appwrite/server";
import { Collections } from "@/lib/appwrite/constants";
import type { AppUser, UserRole } from "@/types";
import { isNotFoundError } from "@/lib/errors";
import { USER_ROLES } from "./roles";
import { getServerEnv } from "@/lib/validation/env";

/** Default university ID until multi-university support is needed. */
const DEFAULT_UNIVERSITY_ID = "default";

/**
 * Ensures an AppUser document exists for the given Appwrite auth user.
 *
 * - If the document already exists, it is returned unchanged (role preserved).
 * - If the document does not exist, a new one is created with role = "student".
 * - Profile provisioning is best-effort so an incomplete optional profile
 *   schema cannot reject a valid Appwrite authentication session.
 *
 * @param authUser - The verified Appwrite Auth user object.
 * @returns The AppUser profile (from DB or synthesised).
 */
export async function syncUserRecord(
  authUser: Models.User<Models.Preferences>
): Promise<AppUser> {
  const databases = new Databases(createServerClient());
  const env = getServerEnv();
  const dbId = env.APPWRITE_DATABASE_ID;

  // 1. Try to read the existing document by Appwrite Auth user ID.
  // We intentionally mirror the auth user ID as the document ID.
  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(
      dbId,
      Collections.USERS,
      authUser.$id
    );
    const user = docToAppUser(doc);
    await provisionStudentProfile(databases, dbId, user);
    return user;
  } catch (err) {
    if (isNotFoundError(err)) {
      // Document not found yet — fall through to create.
    } else {
      throw err;
    }
  }

  // 2. Create new user document
  try {
    const now = new Date().toISOString();
    const normalizedEmail = authUser.email.trim().toLowerCase();
    const bootstrapSuperAdmins = env.APPWRITE_BOOTSTRAP_SUPER_ADMIN_EMAILS ?? [];
    const data: Omit<AppUser, "$id"> = {
      name: authUser.name,
      email: normalizedEmail,
      universityId: inferUniversityId(authUser.email),
      role: bootstrapSuperAdmins.includes(normalizedEmail)
        ? (USER_ROLES.SUPER_ADMIN as UserRole)
        : (USER_ROLES.STUDENT as UserRole),
      isActive: true,
      onboardingCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    // Use the Appwrite Auth user ID as the document ID for easy lookup
    const doc = await databases.createDocument<Models.DefaultDocument>(
      dbId,
      Collections.USERS,
      authUser.$id,
      data
    );
    const user = docToAppUser(doc);
    await provisionStudentProfile(databases, dbId, user);
    return user;
  } catch (createErr) {
    throw createErr;
  }
}

/**
 * Reads the AppUser document for a verified session user.
 * Returns null if the document doesn't exist yet (edge case during first-login
 * race or if DB is not provisioned).
 */
export async function getAppUser(userId: string): Promise<AppUser | null> {
  const databases = new Databases(createServerClient());
  const dbId = getServerEnv().APPWRITE_DATABASE_ID;

  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(dbId, Collections.USERS, userId);
    return docToAppUser(doc);
  } catch {
    return null;
  }
}

function docToAppUser(doc: Models.DefaultDocument): AppUser {
  return {
    $id: doc.$id,
    name: doc["name"] as string,
    email: doc["email"] as string,
    universityId: (doc["universityId"] as string) ?? DEFAULT_UNIVERSITY_ID,
    role: (doc["role"] as UserRole) ?? USER_ROLES.STUDENT,
    isActive: (doc["isActive"] as boolean) ?? true,
    onboardingCompletedAt: doc["onboardingCompletedAt"] as string | undefined,
    createdAt: doc["createdAt"] as string ?? doc.$createdAt,
    updatedAt: doc["updatedAt"] as string ?? doc.$updatedAt,
  };
}

async function ensureStudentProfile(
  databases: Databases,
  dbId: string,
  user: AppUser
): Promise<void> {
  if (user.role !== USER_ROLES.STUDENT) {
    return;
  }

  try {
    await databases.getDocument(dbId, Collections.STUDENT_PROFILES, user.$id);
  } catch (err) {
    if (!isNotFoundError(err)) {
      return;
    }

    const now = new Date().toISOString();
    await databases.createDocument(
      dbId,
      Collections.STUDENT_PROFILES,
      user.$id,
      {
        userId: user.$id,
        universityId: user.universityId,
        personalInfo: {},
        academic: {},
        professional: {
          previousCompanies: [],
          previousTitles: [],
          internships: [],
          certifications: [],
          skills: [],
          projects: [],
        },
        placement: {
          status: "NOT_PLACED",
          numberOfOffers: 0,
          placementHistory: [],
          verifiedAcademicData: false,
        },
        customFields: {},
        isProfileComplete: false,
        createdAt: now,
        updatedAt: now,
      }
    );
  }
}

async function provisionStudentProfile(
  databases: Databases,
  dbId: string,
  user: AppUser
): Promise<void> {
  try {
    await ensureStudentProfile(databases, dbId, user);
  } catch (error) {
    // Authentication must remain available while profile schema changes roll out.
    console.error("[auth/user-sync] Student profile provisioning failed:", error);
  }
}

function inferUniversityId(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return DEFAULT_UNIVERSITY_ID;
  }

  return domain.replace(/[^a-z0-9]+/g, "-");
}
