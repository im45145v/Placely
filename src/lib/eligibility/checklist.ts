/**
 * Combines rule-tree eligibility conditions with placement-restriction checks
 * into a single student-facing checklist (all criteria, pass and fail).
 */
import type { AppUser } from "@/types";
import { evaluatePlacementRulesForApplication } from "@/lib/placement-rules/service";
import { evaluateEligibilityResultForRole } from "./service";

export interface EligibilityChecklistItem {
  key: string;
  label: string;
  satisfied: boolean;
}

export interface EligibilityChecklistGroup {
  title: string;
  items: EligibilityChecklistItem[];
}

export interface EligibilityChecklist {
  eligible: boolean;
  groups: EligibilityChecklistGroup[];
}

export async function buildEligibilityChecklistForRole(
  actor: AppUser,
  input: { roleId: string; studentProfileId: string; studentUserId: string }
): Promise<EligibilityChecklist> {
  const [eligibility, placementRules] = await Promise.all([
    evaluateEligibilityResultForRole(actor, { roleId: input.roleId, studentProfileId: input.studentProfileId }),
    evaluatePlacementRulesForApplication(actor, { roleId: input.roleId, studentUserId: input.studentUserId }),
  ]);

  const groups: EligibilityChecklistGroup[] = [];
  if (eligibility.items.length > 0) {
    groups.push({ title: "Eligibility Criteria", items: eligibility.items });
  }
  if (placementRules.checks.length > 0) {
    groups.push({
      title: "Placement Restrictions",
      items: placementRules.checks.map((check) => ({
        key: check.ruleId,
        label: check.message,
        satisfied: check.satisfied,
      })),
    });
  }

  return {
    eligible: eligibility.eligible && placementRules.allowed,
    groups,
  };
}
