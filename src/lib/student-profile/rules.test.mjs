import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateProfileCompletion,
  canEditStudentProfile,
  canViewStudentProfile,
  sanitizeStudentProfilePayloadForStudent,
} from "./rules.ts";

const studentA = {
  $id: "student-a",
  name: "Student A",
  email: "a@example.edu",
  universityId: "uni-a",
  role: "STUDENT",
  isActive: true,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
};

const studentB = {
  ...studentA,
  $id: "student-b",
  name: "Student B",
  email: "b@example.edu",
};

const placementAdmin = {
  ...studentA,
  $id: "placement-admin",
  role: "PLACEMENT_ADMIN",
};

const superAdmin = {
  ...studentA,
  $id: "super-admin",
  universityId: "central",
  role: "SUPER_ADMIN",
};

test("authorization matrix covers anonymous, student A, student B, placement admin, and super admin", () => {
  assert.equal(canViewStudentProfile(null, studentA.$id, studentA.universityId), false);
  assert.equal(canEditStudentProfile(null, studentA.$id, studentA.universityId), false);

  assert.equal(canViewStudentProfile(studentA, studentA.$id, studentA.universityId), true);
  assert.equal(canEditStudentProfile(studentA, studentA.$id, studentA.universityId), true);

  assert.equal(canViewStudentProfile(studentB, studentA.$id, studentA.universityId), false);
  assert.equal(canEditStudentProfile(studentB, studentA.$id, studentA.universityId), false);

  assert.equal(canViewStudentProfile(placementAdmin, studentA.$id, studentA.universityId), true);
  assert.equal(canEditStudentProfile(placementAdmin, studentA.$id, studentA.universityId), true);

  assert.equal(canViewStudentProfile(superAdmin, studentA.$id, studentA.universityId), true);
  assert.equal(canEditStudentProfile(superAdmin, studentA.$id, studentA.universityId), true);
});

test("student payload sanitization strips admin-controlled placement fields", () => {
  const sanitized = sanitizeStudentProfilePayloadForStudent({
    placement: {
      optedOut: true,
      status: "PLACED",
      selectedCompany: "Hidden Corp",
      verifiedAcademicData: true,
      offerStatus: "OFFERED",
    },
  });

  assert.deepEqual(sanitized, {
    identity: undefined,
    academic: undefined,
    professional: undefined,
    placement: {
      optedOut: true,
    },
  });
});

test("profile completion reflects identity, academics, and professional coverage", () => {
  const completion = calculateProfileCompletion({
    identity: {
      name: "Student A",
      email: "a@example.edu",
      phone: "9999999999",
      dateOfBirth: "2004-01-01",
    },
    academic: {
      ugDegree: "B.Tech",
      ugInstitution: "Placely University",
      ugBranch: "CSE",
      ugCgpa: 8.4,
      tenthPercentage: 92,
      twelfthPercentage: 89,
      graduationYear: 2027,
    },
    professional: {
      previousCompanies: [],
      previousTitles: [],
      totalWorkExperienceMonths: 0,
      internships: ["Summer Internship"],
      certifications: [],
      skills: ["TypeScript"],
      projects: ["Campus portal"],
    },
  });

  assert.equal(completion, 100);
});
