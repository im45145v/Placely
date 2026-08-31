"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { StudentProfileView, StudentProfileUpdatePayload } from "@/lib/student-profile/types";
import type { VariableDefinition } from "@/lib/variables/types";

interface ProfileFormProps {
  initialProfile: StudentProfileView;
}

interface FormState {
  name: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  tenthPercentage: string;
  twelfthPercentage: string;
  diplomaPercentage: string;
  ugDegree: string;
  ugInstitution: string;
  ugBranch: string;
  ugCgpa: string;
  graduationYear: string;
  activeBacklogs: string;
  totalBacklogs: string;
  academicGaps: string;
  totalWorkExperienceMonths: string;
  previousCompanies: string;
  previousTitles: string;
  internships: string;
  certifications: string;
  skills: string;
  projects: string;
  optedOut: boolean;
  customFields: Record<string, string | boolean>;
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const [state, setState] = useState<FormState>(() => toFormState(initialProfile));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [completion, setCompletion] = useState(initialProfile.profile.completionPercentage);
  const [placement, setPlacement] = useState(initialProfile.profile.placement);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const payload = toPayload(state, initialProfile.profile.customVariableDefinitions);
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to update profile.");
        return;
      }

      setMessage("Profile updated.");
      setCompletion(data.profile.completionPercentage);
      setPlacement(data.profile.placement);
      setState(toFormState(data));
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Profile completeness</CardTitle>
          <CardDescription>
            Complete the key identity, academic, and professional fields used across placement workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>{completion}% complete</span>
            <span>{placement.status.replaceAll("_", " ")}</span>
          </div>
        </CardContent>
      </Card>

      <Section title="Identity" description={`Email: ${initialProfile.identity.email}`}>
        <TextField label="Full name" value={state.name} onChange={(value) => setState((current) => ({ ...current, name: value }))} required />
        <TextField label="Phone" value={state.phone} onChange={(value) => setState((current) => ({ ...current, phone: value }))} />
        <TextField label="Date of birth" type="date" value={state.dateOfBirth} onChange={(value) => setState((current) => ({ ...current, dateOfBirth: value }))} />
        <TextField label="Gender" value={state.gender} onChange={(value) => setState((current) => ({ ...current, gender: value }))} />
      </Section>

      <Section title="Academic" description="Student-editable academic inputs. Verified academic state remains admin-controlled.">
        <TextField label="10th percentage" type="number" step="0.01" value={state.tenthPercentage} onChange={(value) => setState((current) => ({ ...current, tenthPercentage: value }))} />
        <TextField label="12th percentage" type="number" step="0.01" value={state.twelfthPercentage} onChange={(value) => setState((current) => ({ ...current, twelfthPercentage: value }))} />
        <TextField label="Diploma percentage" type="number" step="0.01" value={state.diplomaPercentage} onChange={(value) => setState((current) => ({ ...current, diplomaPercentage: value }))} />
        <TextField label="UG degree" value={state.ugDegree} onChange={(value) => setState((current) => ({ ...current, ugDegree: value }))} />
        <TextField label="UG institution" value={state.ugInstitution} onChange={(value) => setState((current) => ({ ...current, ugInstitution: value }))} />
        <TextField label="UG branch" value={state.ugBranch} onChange={(value) => setState((current) => ({ ...current, ugBranch: value }))} />
        <TextField label="UG CGPA" type="number" step="0.01" value={state.ugCgpa} onChange={(value) => setState((current) => ({ ...current, ugCgpa: value }))} />
        <TextField label="Graduation year" type="number" value={state.graduationYear} onChange={(value) => setState((current) => ({ ...current, graduationYear: value }))} />
        <TextField label="Active backlogs" type="number" value={state.activeBacklogs} onChange={(value) => setState((current) => ({ ...current, activeBacklogs: value }))} />
        <TextField label="Total backlogs" type="number" value={state.totalBacklogs} onChange={(value) => setState((current) => ({ ...current, totalBacklogs: value }))} />
        <TextField label="Academic gaps" type="number" value={state.academicGaps} onChange={(value) => setState((current) => ({ ...current, academicGaps: value }))} />
      </Section>

      <Section title="Professional" description="Lists accept one entry per line.">
        <TextAreaField label="Previous companies" value={state.previousCompanies} onChange={(value) => setState((current) => ({ ...current, previousCompanies: value }))} />
        <TextAreaField label="Previous job titles" value={state.previousTitles} onChange={(value) => setState((current) => ({ ...current, previousTitles: value }))} />
        <TextField label="Total work experience (months)" type="number" value={state.totalWorkExperienceMonths} onChange={(value) => setState((current) => ({ ...current, totalWorkExperienceMonths: value }))} />
        <TextAreaField label="Internships" value={state.internships} onChange={(value) => setState((current) => ({ ...current, internships: value }))} />
        <TextAreaField label="Certifications" value={state.certifications} onChange={(value) => setState((current) => ({ ...current, certifications: value }))} />
        <TextAreaField label="Skills" value={state.skills} onChange={(value) => setState((current) => ({ ...current, skills: value }))} />
        <TextAreaField label="Projects" value={state.projects} onChange={(value) => setState((current) => ({ ...current, projects: value }))} />
      </Section>

      <Section title="Placement" description="Admin-controlled fields are visible but not student-editable.">
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyField label="Placement status" value={placement.status.replaceAll("_", " ")} />
          <ReadOnlyField label="Offer status" value={placement.offerStatus ?? "Not set"} />
          <ReadOnlyField label="Selected company" value={placement.selectedCompany ?? "Not set"} />
          <ReadOnlyField label="Verified academic data" value={placement.verifiedAcademicData ? "Verified" : "Pending"} />
        </div>
        <label className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={state.optedOut}
            onChange={(event) => setState((current) => ({ ...current, optedOut: event.target.checked }))}
          />
          Opt out of placement participation
        </label>
      </Section>

      {initialProfile.profile.customVariableDefinitions.length > 0 ? (
        <Section title="Custom variables" description="Admin-managed profile fields validated against each variable type.">
          {initialProfile.profile.customVariableDefinitions.map((variable) => (
            <CustomVariableField
              key={variable.name}
              variable={variable}
              value={state.customFields[variable.name]}
              onChange={(value) =>
                setState((current) => ({
                  ...current,
                  customFields: { ...current.customFields, [variable.name]: value },
                }))
              }
            />
          ))}
        </Section>
      ) : null}

      {(message || error) && (
        <p className={error ? "text-sm text-destructive" : "text-sm text-foreground"}>
          {error ?? message}
        </p>
      )}

      <Button type="submit" loading={isPending}>
        Save profile
      </Button>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input
        className="rounded-md border border-input bg-background px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        step={step}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm md:col-span-2">
      <span className="font-medium text-foreground">{label}</span>
      <textarea
        className="min-h-28 rounded-md border border-input bg-background px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function CustomVariableField({
  variable,
  value,
  onChange,
}: {
  variable: VariableDefinition;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  if (variable.type === "boolean") {
    return (
      <label className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="font-medium">{variable.label}</span>
      </label>
    );
  }

  if ((variable.type === "single_select" || variable.type === "multi_select") && variable.options?.length) {
    return (
      <label className={`flex flex-col gap-2 text-sm ${variable.type === "multi_select" ? "md:col-span-2" : ""}`}>
        <span className="font-medium text-foreground">{variable.label}</span>
        {variable.description ? <span className="text-xs text-muted-foreground">{variable.description}</span> : null}
        {variable.type === "single_select" ? (
          <select
            className="rounded-md border border-input bg-background px-3 py-2"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">Select</option>
            {variable.options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <div className="grid gap-2">
            {variable.options.map((option) => {
              const selected = new Set(String(value ?? "").split("\n").filter(Boolean));
              return (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(option)}
                    onChange={(event) => {
                      const next = new Set(selected);
                      if (event.target.checked) {
                        next.add(option);
                      } else {
                        next.delete(option);
                      }
                      onChange(Array.from(next).join("\n"));
                    }}
                  />
                  {option}
                </label>
              );
            })}
          </div>
        )}
      </label>
    );
  }

  return (
    <TextField
      label={variable.label}
      type={variable.type === "number" ? "number" : variable.type === "date" ? "date" : "text"}
      value={typeof value === "string" ? value : ""}
      onChange={onChange as (value: string) => void}
    />
  );
}

function toFormState(profile: StudentProfileView): FormState {
  return {
    name: profile.identity.name,
    phone: profile.profile.personalInfo.phone ?? "",
    dateOfBirth: profile.profile.personalInfo.dateOfBirth?.slice(0, 10) ?? "",
    gender: profile.profile.personalInfo.gender ?? "",
    tenthPercentage: toStringValue(profile.profile.academic.tenthPercentage),
    twelfthPercentage: toStringValue(profile.profile.academic.twelfthPercentage),
    diplomaPercentage: toStringValue(profile.profile.academic.diplomaPercentage),
    ugDegree: profile.profile.academic.ugDegree ?? "",
    ugInstitution: profile.profile.academic.ugInstitution ?? "",
    ugBranch: profile.profile.academic.ugBranch ?? "",
    ugCgpa: toStringValue(profile.profile.academic.ugCgpa),
    graduationYear: toStringValue(profile.profile.academic.graduationYear),
    activeBacklogs: toStringValue(profile.profile.academic.activeBacklogs),
    totalBacklogs: toStringValue(profile.profile.academic.totalBacklogs),
    academicGaps: toStringValue(profile.profile.academic.academicGaps),
    totalWorkExperienceMonths: toStringValue(profile.profile.professional.totalWorkExperienceMonths),
    previousCompanies: profile.profile.professional.previousCompanies.join("\n"),
    previousTitles: profile.profile.professional.previousTitles.join("\n"),
    internships: profile.profile.professional.internships.join("\n"),
    certifications: profile.profile.professional.certifications.join("\n"),
    skills: profile.profile.professional.skills.join("\n"),
    projects: profile.profile.professional.projects.join("\n"),
    optedOut: profile.profile.placement.status === "OPTED_OUT",
    customFields: profile.profile.customVariableDefinitions.reduce<Record<string, string | boolean>>((accumulator, variable) => {
      const rawValue = profile.profile.customFields[variable.name];
      if (variable.type === "boolean") {
        accumulator[variable.name] = rawValue === true;
      } else if (Array.isArray(rawValue)) {
        accumulator[variable.name] = rawValue.join("\n");
      } else if (rawValue === null || rawValue === undefined) {
        accumulator[variable.name] = "";
      } else {
        accumulator[variable.name] = String(rawValue);
      }
      return accumulator;
    }, {}),
  };
}

function toPayload(state: FormState, customVariables: VariableDefinition[]): StudentProfileUpdatePayload {
  return {
    identity: {
      name: state.name,
      phone: optionalString(state.phone),
      dateOfBirth: optionalString(state.dateOfBirth),
      gender: optionalString(state.gender),
    },
    academic: {
      tenthPercentage: optionalNumber(state.tenthPercentage),
      twelfthPercentage: optionalNumber(state.twelfthPercentage),
      diplomaPercentage: optionalNumber(state.diplomaPercentage),
      ugDegree: optionalString(state.ugDegree),
      ugInstitution: optionalString(state.ugInstitution),
      ugBranch: optionalString(state.ugBranch),
      ugCgpa: optionalNumber(state.ugCgpa),
      graduationYear: optionalNumber(state.graduationYear),
      activeBacklogs: optionalNumber(state.activeBacklogs),
      totalBacklogs: optionalNumber(state.totalBacklogs),
      academicGaps: optionalNumber(state.academicGaps),
    },
    professional: {
      previousCompanies: splitLines(state.previousCompanies),
      previousTitles: splitLines(state.previousTitles),
      totalWorkExperienceMonths: optionalNumber(state.totalWorkExperienceMonths),
      internships: splitLines(state.internships),
      certifications: splitLines(state.certifications),
      skills: splitLines(state.skills),
      projects: splitLines(state.projects),
    },
    placement: {
      optedOut: state.optedOut,
    },
    customFields: Object.fromEntries(
      customVariables.map((variable) => [
        variable.name,
        parseCustomFieldValue(variable, state.customFields[variable.name]),
      ])
    ),
  };
}

function parseCustomFieldValue(variable: VariableDefinition, value: string | boolean | undefined): unknown {
  if (variable.type === "boolean") {
    return value === true;
  }
  if (variable.type === "number") {
    return typeof value === "string" && value.trim() ? Number(value) : null;
  }
  if (variable.type === "multi_select") {
    return typeof value === "string" ? splitLines(value) : [];
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  return Number(value);
}

function toStringValue(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}
