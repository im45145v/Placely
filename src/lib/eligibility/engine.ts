import type { ConditionNode, GroupNode, RuleNode } from "@/types";
import { AppError } from "@/lib/errors";
import type {
  EligibilityCheckItem,
  EligibilityComparableValue,
  EligibilityEvaluationContext,
  EligibilityRuleValidationResult,
  EligibilityStudentRecord,
} from "./types";

export function validateEligibilityRuleTree(
  ruleTree: RuleNode | null,
  context: EligibilityEvaluationContext
): EligibilityRuleValidationResult {
  const errors: string[] = [];

  if (!ruleTree) {
    return { valid: true, errors };
  }

  visitNode(ruleTree, "root");
  return { valid: errors.length === 0, errors };

  function visitNode(node: RuleNode, path: string): void {
    if (node.type === "condition") {
      validateCondition(node, path);
      return;
    }

    if (!Array.isArray(node.children) || node.children.length === 0) {
      errors.push(`${path}: group must contain at least one child`);
      return;
    }

    if (node.logic === "NOT" && node.children.length !== 1) {
      errors.push(`${path}: NOT group must contain exactly one child`);
    }

    node.children.forEach((child, index) => visitNode(child, `${path}.${index}`));
  }

  function validateCondition(node: ConditionNode, path: string): void {
    const variable = context.variables.get(node.variable);
    if (!variable) {
      errors.push(`${path}: unknown variable "${node.variable}"`);
      return;
    }

    if (["gt", "gte", "lt", "lte"].includes(node.operator) && variable.type !== "number") {
      errors.push(`${path}: operator ${node.operator} requires a numeric variable`);
    }
    if (["before", "on_or_before", "after", "on_or_after"].includes(node.operator) && variable.type !== "date") {
      errors.push(`${path}: operator ${node.operator} requires a date variable`);
    }
    if (["contains", "not_contains"].includes(node.operator) && variable.type !== "multi_select") {
      errors.push(`${path}: operator ${node.operator} requires a multi-select variable`);
    }
    if (["in", "not_in"].includes(node.operator) && !Array.isArray(node.value)) {
      errors.push(`${path}: operator ${node.operator} requires an array value`);
    }
    if (variable.type === "boolean" && !["eq", "neq"].includes(node.operator)) {
      errors.push(`${path}: boolean variables only support eq/neq`);
    }
  }
}

export function evaluateEligibilityRule(
  ruleTree: RuleNode | null,
  student: EligibilityStudentRecord,
  context: EligibilityEvaluationContext
): boolean {
  const validation = validateEligibilityRuleTree(ruleTree, context);
  if (!validation.valid) {
    throw AppError.validationError(validation.errors.join("; "));
  }

  if (!ruleTree) {
    return true;
  }

  return evaluateNode(ruleTree);

  function evaluateNode(node: RuleNode): boolean {
    if (node.type === "condition") {
      return evaluateCondition(node, student, context);
    }

    if (node.logic === "AND") {
      return node.children.every(evaluateNode);
    }
    if (node.logic === "OR") {
      return node.children.some(evaluateNode);
    }
    return !evaluateNode(node.children[0]);
  }
}

const OPERATOR_LABELS: Record<string, string> = {
  eq: "must equal",
  neq: "must not equal",
  gt: "must be greater than",
  gte: "must be at least",
  lt: "must be less than",
  lte: "must be at most",
  before: "must be before",
  on_or_before: "must be on or before",
  after: "must be after",
  on_or_after: "must be on or after",
  contains: "must include",
  not_contains: "must not include",
  in: "must be one of",
  not_in: "must not be one of",
};

/**
 * Same evaluation as `evaluateEligibilityRule`, but flattens every leaf
 * condition into a human-readable pass/fail item for the student-facing
 * eligibility checklist. Children are always evaluated (no short-circuiting)
 * so every criterion shows up regardless of AND/OR outcome.
 */
export function evaluateEligibilityRuleDetailed(
  ruleTree: RuleNode | null,
  student: EligibilityStudentRecord,
  context: EligibilityEvaluationContext
): { satisfied: boolean; items: EligibilityCheckItem[] } {
  const validation = validateEligibilityRuleTree(ruleTree, context);
  if (!validation.valid) {
    throw AppError.validationError(validation.errors.join("; "));
  }

  const items: EligibilityCheckItem[] = [];
  if (!ruleTree) {
    return { satisfied: true, items };
  }

  const satisfied = evaluateNode(ruleTree);
  return { satisfied, items };

  function evaluateNode(node: RuleNode): boolean {
    if (node.type === "condition") {
      const result = evaluateCondition(node, student, context);
      items.push({
        key: `${node.variable}-${items.length}`,
        label: describeCondition(node, student, context),
        satisfied: result,
      });
      return result;
    }

    const results = node.children.map(evaluateNode);
    if (node.logic === "AND") {
      return results.every(Boolean);
    }
    if (node.logic === "OR") {
      return results.some(Boolean);
    }
    return !results[0];
  }
}

function describeCondition(
  node: ConditionNode,
  student: EligibilityStudentRecord,
  context: EligibilityEvaluationContext
): string {
  const variable = context.variables.get(node.variable);
  const label = variable?.label ?? node.variable;
  const operatorLabel = OPERATOR_LABELS[node.operator] ?? node.operator;
  const actualValue = student.values[node.variable];
  return `${label} ${operatorLabel} ${formatEligibilityValue(node.value)} (actual: ${formatEligibilityValue(actualValue)})`;
}

function formatEligibilityValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(String).join(", ") : "none";
  }
  if (value === null || value === undefined || value === "") {
    return "not set";
  }
  return String(value);
}

function evaluateCondition(
  node: ConditionNode,
  student: EligibilityStudentRecord,
  context: EligibilityEvaluationContext
): boolean {
  const variable = context.variables.get(node.variable);
  if (!variable) {
    return false;
  }

  const actual = normalizeComparableValue(student.values[node.variable], variable.type);
  const expected = normalizeRuleValue(node.value, variable.type);

  switch (node.operator) {
    case "eq":
      return compareEqual(actual, expected);
    case "neq":
      return !compareEqual(actual, expected);
    case "gt":
      return compareNumbers(actual, expected, (left, right) => left > right);
    case "gte":
      return compareNumbers(actual, expected, (left, right) => left >= right);
    case "lt":
      return compareNumbers(actual, expected, (left, right) => left < right);
    case "lte":
      return compareNumbers(actual, expected, (left, right) => left <= right);
    case "before":
      return compareDates(actual, expected, (left, right) => left < right);
    case "on_or_before":
      return compareDates(actual, expected, (left, right) => left <= right);
    case "after":
      return compareDates(actual, expected, (left, right) => left > right);
    case "on_or_after":
      return compareDates(actual, expected, (left, right) => left >= right);
    case "contains":
      return Array.isArray(actual) && actual.some((value) => compareEqual(normalizeScalar(value), normalizeScalar(expected)));
    case "not_contains":
      return Array.isArray(actual) && !actual.some((value) => compareEqual(normalizeScalar(value), normalizeScalar(expected)));
    case "in":
      return Array.isArray(expected) && expected.some((value) => compareEqual(actual, normalizeScalar(value)));
    case "not_in":
      return Array.isArray(expected) && !expected.some((value) => compareEqual(actual, normalizeScalar(value)));
    default:
      return false;
  }
}

function normalizeRuleValue(value: unknown, type: string): EligibilityComparableValue | EligibilityComparableValue[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeScalarByType(item, type));
  }
  return normalizeScalarByType(value, type);
}

function normalizeComparableValue(value: unknown, type: string): EligibilityComparableValue | EligibilityComparableValue[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeScalarByType(item, type));
  }
  return normalizeScalarByType(value, type);
}

function normalizeScalarByType(value: unknown, type: string): EligibilityComparableValue {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (type === "number") {
    return typeof value === "number" ? value : Number(value);
  }
  if (type === "boolean") {
    return typeof value === "boolean" ? value : String(value).toLowerCase() === "true";
  }
  if (type === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return String(value).trim().toLowerCase();
}

function normalizeScalar(value: unknown): EligibilityComparableValue {
  if (value instanceof Date || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  return value === undefined ? null : String(value).trim().toLowerCase();
}

function compareEqual(
  actual: EligibilityComparableValue | EligibilityComparableValue[],
  expected: EligibilityComparableValue | EligibilityComparableValue[]
): boolean {
  if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  }
  return actual === expected;
}

function compareNumbers(
  actual: EligibilityComparableValue | EligibilityComparableValue[],
  expected: EligibilityComparableValue | EligibilityComparableValue[],
  comparator: (left: number, right: number) => boolean
): boolean {
  return typeof actual === "number" && typeof expected === "number" ? comparator(actual, expected) : false;
}

function compareDates(
  actual: EligibilityComparableValue | EligibilityComparableValue[],
  expected: EligibilityComparableValue | EligibilityComparableValue[],
  comparator: (left: number, right: number) => boolean
): boolean {
  return actual instanceof Date && expected instanceof Date
    ? comparator(actual.getTime(), expected.getTime())
    : false;
}

export function createRuleGroup(logic: GroupNode["logic"], children: RuleNode[] = []): GroupNode {
  return { type: "group", logic, children };
}
