import { BUILT_IN_VARIABLES } from "@/lib/variables/builtins";

export const BUILT_IN_ELIGIBILITY_VARIABLES = BUILT_IN_VARIABLES;

export function getBuiltInEligibilityVariableMap() {
  return new Map(BUILT_IN_ELIGIBILITY_VARIABLES.map((variable) => [variable.name, variable]));
}
