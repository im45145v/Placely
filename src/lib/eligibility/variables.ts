import type { EligibilityVariableDefinition } from "./types";

export const BUILT_IN_ELIGIBILITY_VARIABLES: EligibilityVariableDefinition[] = [
  { name: "cgpa", label: "CGPA", type: "number", description: "Undergraduate CGPA.", isBuiltIn: true },
  { name: "active_backlogs", label: "Active Backlogs", type: "number", description: "Current active backlogs.", isBuiltIn: true },
  { name: "total_backlogs", label: "Total Backlogs", type: "number", description: "Total historical backlogs.", isBuiltIn: true },
  { name: "academic_gaps", label: "Academic Gaps", type: "number", description: "Academic gap count.", isBuiltIn: true },
  { name: "ug_branch", label: "UG Branch", type: "single_select", description: "Student undergraduate branch.", isBuiltIn: true },
  { name: "ug_degree", label: "UG Degree", type: "string", description: "Student undergraduate degree.", isBuiltIn: true },
  { name: "graduation_year", label: "Graduation Year", type: "number", description: "Expected graduation year.", isBuiltIn: true },
  { name: "is_profile_complete", label: "Profile Complete", type: "boolean", description: "Whether the student profile is complete.", isBuiltIn: true },
  { name: "placement_status", label: "Placement Status", type: "single_select", description: "Current placement status.", options: ["NOT_PLACED", "PLACED", "OPTED_OUT"], isBuiltIn: true },
  { name: "verified_academic_data", label: "Academic Data Verified", type: "boolean", description: "Whether academic data is verified.", isBuiltIn: true },
  { name: "number_of_offers", label: "Number of Offers", type: "number", description: "Current number of offers.", isBuiltIn: true },
  { name: "date_of_birth", label: "Date of Birth", type: "date", description: "Student date of birth.", isBuiltIn: true },
  { name: "skills", label: "Skills", type: "multi_select", description: "Normalized skill tags.", isBuiltIn: true },
  { name: "certifications", label: "Certifications", type: "multi_select", description: "Student certifications.", isBuiltIn: true },
  { name: "internships", label: "Internships", type: "multi_select", description: "Recorded internships.", isBuiltIn: true },
];

export function getBuiltInEligibilityVariableMap(): Map<string, EligibilityVariableDefinition> {
  return new Map(BUILT_IN_ELIGIBILITY_VARIABLES.map((variable) => [variable.name, variable]));
}
