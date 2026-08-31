"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCtc, formatDate } from "@/lib/utils";
import type { EligibilityRuleSet, GroupNode, RuleNode, Company, Role } from "@/types";
import type { EligibilityVariableDefinition } from "@/lib/eligibility/types";

interface RoleDetail extends Role {
  company: Company;
  jdMetadata: { fileName: string } | null;
  eligibilityRuleSet: EligibilityRuleSet | null;
}

interface PaginatedRoles {
  items: RoleDetail[];
  page: number;
  totalPages: number;
  total: number;
}

interface EligibilityPreview {
  totalStudents: number;
  eligibleStudents: number;
  removedStudents: number;
  addedStudents: number;
}

const OPERATOR_OPTIONS = [
  { value: "eq", label: "==" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "in", label: "IN" },
  { value: "not_in", label: "NOT IN" },
  { value: "contains", label: "CONTAINS" },
  { value: "not_contains", label: "NOT CONTAINS" },
  { value: "before", label: "Before" },
  { value: "on_or_before", label: "On or before" },
  { value: "after", label: "After" },
  { value: "on_or_after", label: "On or after" },
] as const;

export function AdminRolesManager({
  initialRoles,
  companies,
  variables,
}: {
  initialRoles: PaginatedRoles;
  companies: Company[];
  variables: EligibilityVariableDefinition[];
}) {
  const [roles, setRoles] = useState(initialRoles.items);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitRole(event: React.FormEvent<HTMLFormElement>, roleId?: string): void {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await fetch(roleId ? `/api/admin/roles/${roleId}` : "/api/admin/roles", {
        method: roleId ? "PATCH" : "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to save role.");
        return;
      }
      const entityId = roleId ?? data.$id;
      const detailResponse = await fetch(`/api/admin/roles/${entityId}`);
      const detail = await detailResponse.json();
      if (roleId) {
        setRoles((current) => current.map((item) => (item.$id === roleId ? detail : item)));
        setEditingId(null);
        setMessage("Role updated.");
      } else {
        setRoles((current) => [detail, ...current]);
        event.currentTarget.reset();
        setMessage("Role created.");
      }
    });
  }

  function runRoleAction(roleId: string, action: "publish" | "close" | "duplicate" | "archive"): void {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const path = action === "archive" ? `/api/admin/roles/${roleId}` : `/api/admin/roles/${roleId}/${action}`;
      const response = await fetch(path, { method: action === "archive" ? "DELETE" : "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Role action failed.");
        return;
      }
      if (action === "duplicate") {
        const detailResponse = await fetch(`/api/admin/roles/${data.$id}`);
        const detail = await detailResponse.json();
        setRoles((current) => [detail, ...current]);
        setMessage("Role duplicated.");
        return;
      }
      const detailResponse = await fetch(`/api/admin/roles/${roleId}`);
      const detail = await detailResponse.json();
      setRoles((current) => current.map((item) => (item.$id === roleId ? detail : item)));
      setMessage(`Role ${action}d.`);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create role</CardTitle>
          <CardDescription>Attach the role to an existing company, configure the opening, then define server-side eligibility rules with preview before saving.</CardDescription>
        </CardHeader>
        <CardContent>
          <RoleForm companies={companies} variables={variables} onSubmit={submitRole} isPending={isPending} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>Showing {roles.length} of {initialRoles.total} roles in this view.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {roles.map((role) => (
            <div key={role.$id} className="rounded-md border border-border p-4">
              {editingId === role.$id ? (
                <RoleForm
                  companyRole={role}
                  companies={companies}
                  variables={variables}
                  onSubmit={(event) => submitRole(event, role.$id)}
                  onCancel={() => setEditingId(null)}
                  isPending={isPending}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{role.title}</p>
                    <p className="text-sm text-muted-foreground">{role.company.name} • {role.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {role.location ?? "No location"} • {role.numberOfOpenings ?? "?"} openings
                      {role.ctc ? ` • ${formatCtc(role.ctc)}` : ""}
                      {role.applicationDeadline ? ` • Deadline ${formatDate(role.applicationDeadline)}` : ""}
                    </p>
                    {role.eligibilityRuleSet ? (
                      <p className="text-xs text-muted-foreground">
                        Eligibility configured: {flattenRuleCount(role.eligibilityRuleSet.ruleTree)} rule{flattenRuleCount(role.eligibilityRuleSet.ruleTree) === 1 ? "" : "s"}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Eligibility not configured.</p>
                    )}
                    {role.jdMetadata ? (
                      <Link href={`/api/files/role-jd/${role.$id}`} className="text-xs text-primary underline">
                        Download JD
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(role.$id)}>Edit</Button>
                    {role.status === "draft" ? (
                      <Button type="button" size="sm" onClick={() => runRoleAction(role.$id, "publish")} loading={isPending}>Publish</Button>
                    ) : null}
                    {role.status === "published" ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => runRoleAction(role.$id, "close")} loading={isPending}>Close</Button>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" onClick={() => runRoleAction(role.$id, "duplicate")} loading={isPending}>Duplicate</Button>
                    {role.status !== "cancelled" ? (
                      <Button type="button" variant="danger" size="sm" onClick={() => runRoleAction(role.$id, "archive")} loading={isPending}>Archive</Button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ))}
          {(message || error) && <p className={error ? "text-sm text-destructive" : "text-sm text-foreground"}>{error ?? message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function RoleForm({
  companyRole,
  companies,
  variables,
  onSubmit,
  onCancel,
  isPending,
}: {
  companyRole?: RoleDetail;
  companies: Company[];
  variables: EligibilityVariableDefinition[];
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  isPending: boolean;
}) {
  const [ruleTree, setRuleTree] = useState<RuleNode>(companyRole?.eligibilityRuleSet?.ruleTree ?? createEmptyGroup());
  const [preview, setPreview] = useState<EligibilityPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();

  function handlePreview(): void {
    setPreviewError(null);
    startPreviewTransition(async () => {
      const response = await fetch("/api/admin/roles/eligibility-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: companyRole?.$id,
          draftRuleTree: ruleTree,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPreviewError(data.message ?? "Preview failed.");
        return;
      }
      setPreview(data);
    });
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Company</span>
        <select name="companyId" defaultValue={companyRole?.companyId} className="rounded-md border border-input bg-background px-3 py-2" required>
          <option value="">Select company</option>
          {companies.map((company) => (
            <option key={company.$id} value={company.$id}>{company.name}</option>
          ))}
        </select>
      </label>
      <Field label="Role title" name="title" defaultValue={companyRole?.title} required />
      <Field label="Location" name="location" defaultValue={companyRole?.location} />
      <SelectField label="Work mode" name="workMode" defaultValue={companyRole?.workMode} options={["remote", "onsite", "hybrid"]} />
      <SelectField label="Employment type" name="employmentType" defaultValue={companyRole?.employmentType} options={["full_time", "part_time", "internship", "contract"]} />
      <Field label="Openings" name="numberOfOpenings" type="number" defaultValue={companyRole?.numberOfOpenings?.toString()} />
      <Field label="CTC" name="ctc" type="number" defaultValue={companyRole?.ctc?.toString()} />
      <Field label="Fixed CTC" name="fixedCtc" type="number" defaultValue={companyRole?.fixedCtc?.toString()} />
      <Field label="Variable CTC" name="variableCtc" type="number" defaultValue={companyRole?.variableCtc?.toString()} />
      <Field label="Joining date" name="joiningDate" type="date" defaultValue={companyRole?.joiningDate?.slice(0, 10)} />
      <Field label="Application deadline" name="applicationDeadline" type="datetime-local" defaultValue={companyRole?.applicationDeadline?.slice(0, 16)} />
      <TextAreaField label="Description" name="description" defaultValue={companyRole?.jdText} className="md:col-span-2" />
      <TextAreaField label="Required skills" name="requiredSkills" defaultValue={companyRole?.requiredSkills.join("\n")} />
      <TextAreaField label="Required qualifications" name="requiredQualifications" defaultValue={companyRole?.requiredQualifications.join("\n")} />
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">JD attachment</span>
        <input type="file" name="jd" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="rounded-md border border-input bg-background px-3 py-2" />
      </label>

      <div className="md:col-span-2 rounded-md border border-border p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Eligibility engine</p>
            <p className="text-xs text-muted-foreground">Rules are evaluated only on the server. Preview does not save or publish changes.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handlePreview} loading={isPreviewPending}>Preview eligibility</Button>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <Field label="Rule set name" name="eligibilityRuleName" defaultValue={companyRole?.eligibilityRuleSet?.name ?? `${companyRole?.title ?? ""} Eligibility`.trim()} />
          <Field label="Rule description" name="eligibilityRuleDescription" defaultValue={companyRole?.eligibilityRuleSet?.description} />
        </div>

        <input type="hidden" name="eligibilityRuleTree" value={JSON.stringify(ruleTree)} readOnly />
        <RuleGroupEditor node={ruleTree} variables={variables} onChange={setRuleTree} />

        {preview ? (
          <div className="mt-4 rounded-md bg-accent/40 p-3 text-sm">
            <p>Current criteria: {companyRole?.eligibilityRuleSet ? `${flattenRuleCount(companyRole.eligibilityRuleSet.ruleTree)} rule${flattenRuleCount(companyRole.eligibilityRuleSet.ruleTree) === 1 ? "" : "s"}` : "None"}</p>
            <p>Eligible: {preview.eligibleStudents} / {preview.totalStudents}</p>
            <p>{preview.removedStudents} students removed</p>
            <p>{preview.addedStudents} students added</p>
          </div>
        ) : null}
        {previewError ? <p className="mt-3 text-sm text-destructive">{previewError}</p> : null}
      </div>

      <div className="md:col-span-2 flex gap-2">
        <Button type="submit" loading={isPending}>{companyRole ? "Save role" : "Create role"}</Button>
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button> : null}
      </div>
    </form>
  );
}

function RuleGroupEditor({
  node,
  variables,
  onChange,
}: {
  node: RuleNode;
  variables: EligibilityVariableDefinition[];
  onChange: (node: RuleNode) => void;
}) {
  if (node.type === "condition") {
    const variable = variables.find((item) => item.name === node.variable) ?? variables[0];
    return (
      <div className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[1.5fr_1fr_1.5fr_auto]">
        <select
          value={node.variable}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(event) => onChange(normalizeCondition({ ...node, variable: event.target.value }, variables))}
        >
          {variables.map((item) => (
            <option key={item.name} value={item.name}>{item.label}</option>
          ))}
        </select>
        <select
          value={node.operator}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(event) => onChange({ ...node, operator: event.target.value as never })}
        >
          {getAllowedOperators(variable?.type).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ValueEditor condition={node} variable={variable} onChange={(value) => onChange({ ...node, value })} />
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(createEmptyCondition(variables))}>Reset</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Group</span>
        <select
          value={node.logic}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(event) => onChange({ ...node, logic: event.target.value as GroupNode["logic"] })}
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
          <option value="NOT">NOT</option>
        </select>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...node, children: [...normalizeNotChildren(node.logic, node.children), createEmptyCondition(variables)] })}>Add rule</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...node, children: [...normalizeNotChildren(node.logic, node.children), createEmptyGroup()] })}>Add group</Button>
      </div>
      <div className="space-y-3">
        {normalizeNotChildren(node.logic, node.children).map((child, index) => (
          <div key={index} className="space-y-2">
            <RuleGroupEditor
              node={child}
              variables={variables}
              onChange={(nextChild) => {
                const children = normalizeNotChildren(node.logic, node.children).slice();
                children[index] = nextChild;
                onChange({ ...node, children: childrenForLogic(node.logic, children) });
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const children = normalizeNotChildren(node.logic, node.children).filter((_, childIndex) => childIndex !== index);
                onChange({ ...node, children: childrenForLogic(node.logic, children.length > 0 ? children : [createEmptyCondition(variables)]) });
              }}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueEditor({
  condition,
  variable,
  onChange,
}: {
  condition: Extract<RuleNode, { type: "condition" }>;
  variable?: EligibilityVariableDefinition;
  onChange: (value: string | number | boolean | Array<string | number | boolean>) => void;
}) {
  const type = variable?.type ?? "string";
  const currentValue = Array.isArray(condition.value) ? condition.value.join(", ") : String(condition.value ?? "");
  if (type === "boolean") {
    return (
      <select
        value={String(condition.value ?? "false")}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value === "true")}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (type === "date") {
    return (
      <input
        type="date"
        value={typeof condition.value === "string" ? condition.value : ""}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (type === "single_select" && variable?.options?.length) {
    return (
      <select
        value={typeof condition.value === "string" ? condition.value : ""}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select</option>
        {variable.options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={type === "number" ? "number" : "text"}
      value={currentValue}
      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      onChange={(event) => onChange(parseValueInput(event.target.value, type, condition.operator))}
      placeholder={condition.operator === "in" || condition.operator === "not_in" ? "Comma-separated values" : "Value"}
    />
  );
}

function Field({ label, name, defaultValue, required, type = "text" }: { label: string; name: string; defaultValue?: string; required?: boolean; type?: string }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} required={required} className="rounded-md border border-input bg-background px-3 py-2" />
    </label>
  );
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string; options: string[] }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""} className="rounded-md border border-input bg-background px-3 py-2">
        <option value="">Not set</option>
        {options.map((option) => (
          <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({ label, name, defaultValue, className }: { label: string; name: string; defaultValue?: string; className?: string }) {
  return (
    <label className={`flex flex-col gap-2 text-sm ${className ?? ""}`}>
      <span className="font-medium">{label}</span>
      <textarea name={name} defaultValue={defaultValue} className="min-h-28 rounded-md border border-input bg-background px-3 py-2" />
    </label>
  );
}

function createEmptyGroup(): GroupNode {
  return {
    type: "group",
    logic: "AND",
    children: [{ type: "condition", variable: "cgpa", operator: "gte", value: 7 }],
  };
}

function createEmptyCondition(variables: EligibilityVariableDefinition[]): Extract<RuleNode, { type: "condition" }> {
  const variable = variables[0];
  return normalizeCondition({ type: "condition", variable: variable?.name ?? "cgpa", operator: "eq", value: "" }, variables);
}

function normalizeCondition(condition: Extract<RuleNode, { type: "condition" }>, variables: EligibilityVariableDefinition[]) {
  const variable = variables.find((item) => item.name === condition.variable) ?? variables[0];
  if (!variable) {
    return condition;
  }
  return {
    ...condition,
    operator: getAllowedOperators(variable.type)[0].value,
    value: defaultValueForType(variable.type),
  };
}

function defaultValueForType(type: EligibilityVariableDefinition["type"]) {
  if (type === "number") {
    return 0;
  }
  if (type === "boolean") {
    return false;
  }
  if (type === "multi_select") {
    return [];
  }
  return "";
}

function getAllowedOperators(type?: EligibilityVariableDefinition["type"]) {
  if (type === "number") {
    return OPERATOR_OPTIONS.filter((option) => ["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in"].includes(option.value));
  }
  if (type === "boolean") {
    return OPERATOR_OPTIONS.filter((option) => ["eq", "neq"].includes(option.value));
  }
  if (type === "date") {
    return OPERATOR_OPTIONS.filter((option) => ["eq", "neq", "before", "on_or_before", "after", "on_or_after"].includes(option.value));
  }
  if (type === "multi_select") {
    return OPERATOR_OPTIONS.filter((option) => ["contains", "not_contains"].includes(option.value));
  }
  return OPERATOR_OPTIONS.filter((option) => ["eq", "neq", "in", "not_in"].includes(option.value));
}

function parseValueInput(value: string, type: EligibilityVariableDefinition["type"], operator: string) {
  if (operator === "in" || operator === "not_in") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  if (type === "number") {
    return Number(value);
  }
  return value;
}

function normalizeNotChildren(logic: GroupNode["logic"], children: RuleNode[]): RuleNode[] {
  return logic === "NOT" ? children.slice(0, 1) : children;
}

function childrenForLogic(logic: GroupNode["logic"], children: RuleNode[]): RuleNode[] {
  return logic === "NOT" ? children.slice(0, 1) : children;
}

function flattenRuleCount(node: RuleNode): number {
  if (node.type === "condition") {
    return 1;
  }
  return node.children.reduce((count, child) => count + flattenRuleCount(child), 0);
}
