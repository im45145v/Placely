import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibilityRule, validateEligibilityRuleTree } from "./engine";
import { BUILT_IN_ELIGIBILITY_VARIABLES } from "./variables";
import type { RuleNode } from "@/types";

const context = {
  variables: new Map(BUILT_IN_ELIGIBILITY_VARIABLES.map((variable) => [variable.name, variable])),
};

const student = {
  userId: "user-1",
  profileId: "profile-1",
  universityId: "uni-1",
  values: {
    cgpa: 8.1,
    active_backlogs: 0,
    ug_branch: "CSE",
    is_profile_complete: true,
    placement_status: "NOT_PLACED",
    verified_academic_data: true,
    date_of_birth: "2004-04-10",
    skills: ["react", "typescript"],
    certifications: ["aws"],
  },
};

test("evaluates nested AND/OR groups with IN correctly", () => {
  const rule: RuleNode = {
    type: "group",
    logic: "AND",
    children: [
      { type: "condition", variable: "cgpa", operator: "gte", value: 7 },
      { type: "condition", variable: "active_backlogs", operator: "eq", value: 0 },
      {
        type: "group",
        logic: "OR",
        children: [
          { type: "condition", variable: "ug_branch", operator: "in", value: ["CSE", "IT", "ECE"] },
          { type: "condition", variable: "skills", operator: "contains", value: "java" },
        ],
      },
    ],
  };

  assert.equal(evaluateEligibilityRule(rule, student, context), true);
});

test("evaluates NOT groups and boolean comparisons", () => {
  const rule: RuleNode = {
    type: "group",
    logic: "NOT",
    children: [{ type: "condition", variable: "is_profile_complete", operator: "eq", value: false }],
  };

  assert.equal(evaluateEligibilityRule(rule, student, context), true);
});

test("evaluates date operators using server-side date parsing", () => {
  const rule: RuleNode = {
    type: "group",
    logic: "AND",
    children: [
      { type: "condition", variable: "date_of_birth", operator: "before", value: "2005-01-01" },
      { type: "condition", variable: "date_of_birth", operator: "after", value: "2003-01-01" },
    ],
  };

  assert.equal(evaluateEligibilityRule(rule, student, context), true);
});

test("returns false when numeric value is missing for numeric comparison", () => {
  const rule: RuleNode = {
    type: "condition",
    variable: "cgpa",
    operator: "gte",
    value: 7.5,
  };

  assert.equal(
    evaluateEligibilityRule(rule, { ...student, values: { ...student.values, cgpa: null } }, context),
    false
  );
});

test("rejects invalid boolean operators and malformed NOT groups", () => {
  const malformedRule: RuleNode = {
    type: "group",
    logic: "NOT",
    children: [
      { type: "condition", variable: "verified_academic_data", operator: "eq", value: true },
      { type: "condition", variable: "verified_academic_data", operator: "eq", value: false },
    ],
  };
  const invalidBooleanRule: RuleNode = {
    type: "condition",
    variable: "verified_academic_data",
    operator: "gt",
    value: true,
  };

  const malformedValidation = validateEligibilityRuleTree(malformedRule, context);
  const booleanValidation = validateEligibilityRuleTree(invalidBooleanRule, context);

  assert.equal(malformedValidation.valid, false);
  assert.match(malformedValidation.errors.join(" "), /NOT group must contain exactly one child/);
  assert.equal(booleanValidation.valid, false);
  assert.match(booleanValidation.errors.join(" "), /boolean variables only support eq\/neq/);
});

test("supports NOT IN for string variables and CONTAINS for multi-select variables", () => {
  const branchRule: RuleNode = {
    type: "condition",
    variable: "ug_branch",
    operator: "not_in",
    value: ["MECH", "CIVIL"],
  };
  const skillsRule: RuleNode = {
    type: "condition",
    variable: "skills",
    operator: "contains",
    value: "react",
  };

  assert.equal(evaluateEligibilityRule(branchRule, student, context), true);
  assert.equal(evaluateEligibilityRule(skillsRule, student, context), true);
});
