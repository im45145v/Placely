import type { VariableDefinition } from "./types";

const BUILT_IN_CREATED_AT = "2026-08-31T00:00:00.000Z";

export const BUILT_IN_VARIABLES: VariableDefinition[] = [
  defineBuiltIn("cgpa", "cgpa", "CGPA", "number", "Undergraduate CGPA."),
  defineBuiltIn("active_backlogs", "active_backlogs", "Active Backlogs", "number", "Current active backlogs."),
  defineBuiltIn("total_backlogs", "total_backlogs", "Total Backlogs", "number", "Total historical backlogs."),
  defineBuiltIn("academic_gaps", "academic_gaps", "Academic Gaps", "number", "Academic gap count."),
  defineBuiltIn("ug_branch", "ug_branch", "UG Branch", "single_select", "Student undergraduate branch."),
  defineBuiltIn("ug_degree", "ug_degree", "UG Degree", "string", "Student undergraduate degree."),
  defineBuiltIn("graduation_year", "graduation_year", "Graduation Year", "number", "Expected graduation year."),
  defineBuiltIn(
    "work_experience_months",
    "work_experience_months",
    "Work Experience (Months)",
    "number",
    "Total prior work experience in months."
  ),
  defineBuiltIn("is_profile_complete", "is_profile_complete", "Profile Complete", "boolean", "Whether the student profile is complete."),
  defineBuiltIn(
    "placement_status",
    "placement_status",
    "Placement Status",
    "single_select",
    "Current placement status.",
    ["NOT_PLACED", "PLACED", "OPTED_OUT"]
  ),
  defineBuiltIn(
    "verified_academic_data",
    "verified_academic_data",
    "Academic Data Verified",
    "boolean",
    "Whether academic data is verified."
  ),
  defineBuiltIn("number_of_offers", "number_of_offers", "Number of Offers", "number", "Current number of offers."),
  defineBuiltIn("date_of_birth", "date_of_birth", "Date of Birth", "date", "Student date of birth."),
  defineBuiltIn("skills", "skills", "Skills", "multi_select", "Normalized skill tags."),
  defineBuiltIn("certifications", "certifications", "Certifications", "multi_select", "Student certifications."),
  defineBuiltIn("internships", "internships", "Internships", "multi_select", "Recorded internships."),
];

function defineBuiltIn(
  id: string,
  name: string,
  label: string,
  type: VariableDefinition["type"],
  description?: string,
  options?: string[]
): VariableDefinition {
  return {
    $id: id,
    universityId: "system",
    id,
    name,
    label,
    description,
    type,
    options,
    source: "built_in",
    isActive: true,
    isBuiltIn: true,
    createdAt: BUILT_IN_CREATED_AT,
    updatedAt: BUILT_IN_CREATED_AT,
  };
}
