import type { AppUser, PlacementStatus, StudentProfile } from "@/types";

export interface StudentIdentityUpdate {
  name: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
}

export interface StudentAcademicData {
  tenthPercentage?: number;
  twelfthPercentage?: number;
  diplomaPercentage?: number;
  ugDegree?: string;
  ugInstitution?: string;
  ugBranch?: string;
  ugCgpa?: number;
  graduationYear?: number;
  activeBacklogs?: number;
  totalBacklogs?: number;
  academicGaps?: number;
}

export interface StudentProfessionalData {
  previousCompanies: string[];
  previousTitles: string[];
  totalWorkExperienceMonths?: number;
  internships: string[];
  certifications: string[];
  skills: string[];
  projects: string[];
}

export interface StudentPlacementEditableData {
  optedOut?: boolean;
}

export interface AdminPlacementData {
  status: PlacementStatus;
  numberOfOffers: number;
  currentOfferId?: string;
  currentOfferCtc?: number;
  placementHistory: string[];
  selectedCompany?: string;
  offerStatus?: string;
  verifiedAcademicData?: boolean;
}

export interface StudentProfileView {
  identity: {
    userId: string;
    name: string;
    email: string;
    universityId: string;
    role: AppUser["role"];
  };
  profile: {
    profileId: string;
    personalInfo: StudentProfile["personalInfo"];
    academic: StudentAcademicData;
    professional: StudentProfessionalData;
    placement: AdminPlacementData;
    completionPercentage: number;
    isProfileComplete: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface StudentProfileUpdatePayload {
  identity?: Partial<StudentIdentityUpdate>;
  academic?: Partial<StudentAcademicData>;
  professional?: Partial<StudentProfessionalData>;
  placement?: StudentPlacementEditableData;
}
