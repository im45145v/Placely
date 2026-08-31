"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { VariableDefinition } from "@/lib/variables/types";

const VARIABLE_TYPES = ["string", "number", "boolean", "date", "single_select", "multi_select"] as const;

interface VariableFormState {
  name: string;
  label: string;
  description: string;
  type: VariableDefinition["type"];
  options: string;
  isActive: boolean;
}

export function AdminVariablesManager({ initialVariables }: { initialVariables: VariableDefinition[] }) {
  const [variables, setVariables] = useState(initialVariables);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveVariable(event: React.FormEvent<HTMLFormElement>, variableId?: string): void {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const payload = readForm(event.currentTarget);

    startTransition(async () => {
      const response = await fetch(variableId ? `/api/admin/variables/${variableId}` : "/api/admin/variables", {
        method: variableId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to save variable.");
        return;
      }

      if (variableId) {
        setVariables((current) => current.map((item) => (item.$id === variableId ? data : item)));
        setEditingId(null);
        setMessage("Variable updated.");
      } else {
        setVariables((current) => [...current, data].sort((left, right) => left.label.localeCompare(right.label)));
        event.currentTarget.reset();
        setMessage("Variable created.");
      }
    });
  }

  function removeVariable(variableId: string): void {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/variables/${variableId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to delete variable.");
        return;
      }
      setVariables((current) => current.filter((item) => item.$id !== variableId));
      setMessage("Variable deleted.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create custom variable</CardTitle>
          <CardDescription>Custom variables are stored as flexible profile fields and are available to eligibility, placement rules, analytics, and notification templates.</CardDescription>
        </CardHeader>
        <CardContent>
          <VariableForm isPending={isPending} onSubmit={saveVariable} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variables</CardTitle>
          <CardDescription>{variables.length} variable definitions in this university.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {variables.map((variable) => (
            <div key={variable.$id} className="rounded-md border border-border p-4">
              {editingId === variable.$id ? (
                <VariableForm variable={variable} isPending={isPending} onSubmit={(event) => saveVariable(event, variable.$id)} onCancel={() => setEditingId(null)} />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{variable.label}</p>
                      <Badge variant={variable.isActive ? "success" : "outline"}>{variable.isActive ? "Active" : "Inactive"}</Badge>
                      <Badge variant="info">{variable.type}</Badge>
                      <Badge variant="outline">{variable.source}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{variable.name}</p>
                    {variable.description ? <p className="text-sm text-muted-foreground">{variable.description}</p> : null}
                    {variable.options?.length ? <p className="text-xs text-muted-foreground">Options: {variable.options.join(", ")}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!variable.isBuiltIn ? <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(variable.$id)}>Edit</Button> : null}
                    {!variable.isBuiltIn ? <Button type="button" variant="danger" size="sm" onClick={() => removeVariable(variable.$id)} loading={isPending}>Delete</Button> : null}
                    {variable.isBuiltIn ? <Badge variant="warning">Built-in protected</Badge> : null}
                  </div>
                </div>
              )}
            </div>
          ))}
          {(message || error) ? <p className={error ? "text-sm text-destructive" : "text-sm"}>{error ?? message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function VariableForm({
  variable,
  isPending,
  onSubmit,
  onCancel,
}: {
  variable?: VariableDefinition;
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
}) {
  const initial = toFormState(variable);
  const [type, setType] = useState<VariableDefinition["type"]>(initial.type);

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
      <Field label="Name" name="name" defaultValue={initial.name} required />
      <Field label="Label" name="label" defaultValue={initial.label} required />
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Type</span>
        <select
          name="type"
          defaultValue={initial.type}
          className="rounded-md border border-input bg-background px-3 py-2"
          onChange={(event) => setType(event.target.value as VariableDefinition["type"])}
        >
          {VARIABLE_TYPES.map((option) => (
            <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={initial.isActive} />
        Active
      </label>
      <TextAreaField label="Description" name="description" defaultValue={initial.description} className="md:col-span-2" />
      {(type === "single_select" || type === "multi_select") ? (
        <TextAreaField
          label="Options"
          name="options"
          defaultValue={initial.options}
          className="md:col-span-2"
        />
      ) : null}
      <div className="md:col-span-2 flex gap-2">
        <Button type="submit" loading={isPending}>{variable ? "Save variable" : "Create variable"}</Button>
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button> : null}
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue, required }: { label: string; name: string; defaultValue?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input name={name} defaultValue={defaultValue} required={required} className="rounded-md border border-input bg-background px-3 py-2" />
    </label>
  );
}

function TextAreaField({ label, name, defaultValue, className }: { label: string; name: string; defaultValue?: string; className?: string }) {
  return (
    <label className={`flex flex-col gap-2 text-sm ${className ?? ""}`}>
      <span className="font-medium">{label}</span>
      <textarea name={name} defaultValue={defaultValue} className="min-h-24 rounded-md border border-input bg-background px-3 py-2" />
    </label>
  );
}

function readForm(form: HTMLFormElement) {
  const formData = new FormData(form);
  return {
    name: String(formData.get("name") ?? ""),
    label: String(formData.get("label") ?? ""),
    description: String(formData.get("description") ?? "").trim() || undefined,
    type: String(formData.get("type") ?? "string"),
    options: String(formData.get("options") ?? "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    isActive: formData.get("isActive") === "on",
  };
}

function toFormState(variable?: VariableDefinition): VariableFormState {
  return {
    name: variable?.name ?? "",
    label: variable?.label ?? "",
    description: variable?.description ?? "",
    type: variable?.type ?? "string",
    options: variable?.options?.join("\n") ?? "",
    isActive: variable?.isActive ?? true,
  };
}
