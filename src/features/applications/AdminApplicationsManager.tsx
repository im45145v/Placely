"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Collections } from "@/lib/appwrite/constants";
import { getCollectionRealtimeChannel } from "@/lib/appwrite/realtime";
import { evaluateEligibilityRule } from "@/lib/eligibility/engine";
import { formatDate } from "@/lib/utils";
import type {
  ApplicationAdminPageData,
  ApplicationDetail,
  ApplicationRoundWorkflow,
  BulkActionResult,
  PaginatedApplications,
} from "@/lib/applications/types";
import type { VariableDefinition } from "@/lib/variables/types";
import type {
  ConditionNode,
  GroupNode,
  PlacementRound,
  RoundOutcome,
  RoundParticipant,
  RuleNode,
} from "@/types";

interface AdminApplicationsManagerProps {
  initialData: ApplicationAdminPageData;
  initialFilters: {
    search: string;
    status: string;
    roleId: string;
    companyId: string;
    studentFilter: RuleNode | null;
  };
}

interface RoundDraft {
  name: string;
  type: PlacementRound["type"];
  description: string;
  instructions: string;
  startTime: string;
  endTime: string;
  location: string;
  meetingLink: string;
  status: PlacementRound["status"];
}

interface ParticipantDraft {
  scheduledStart: string;
  scheduledEnd: string;
  slotLabel: string;
  room: string;
  location: string;
  meetingLink: string;
  scheduleTimezone: string;
  scheduleStatus: "pending" | "scheduled" | "rescheduled" | "cancelled";
  cancellationReason: string;
  instructions: string;
  interviewerIds: string;
  score: string;
  notes: string;
  outcome: "" | RoundOutcome;
  feedback: string;
  publishResult: boolean;
}

interface BulkScheduleDraft {
  startTime: string;
  durationMinutes: string;
  gapMinutes: string;
  room: string;
  location: string;
  meetingLink: string;
  interviewerIds: string;
  instructions: string;
  scheduleTimezone: string;
}

export function AdminApplicationsManager({ initialData, initialFilters }: AdminApplicationsManagerProps) {
  const [applications, setApplications] = useState(initialData.applications.items);
  const [rounds, setRounds] = useState(initialData.rounds);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [roundId, setRoundId] = useState(initialData.rounds[0]?.$id ?? "");
  const [studentFilter, setStudentFilter] = useState<RuleNode | null>(initialFilters.studentFilter ?? createDefaultFilter(initialData.variables));
  const [importFile, setImportFile] = useState<File | null>(null);
  const [roundDrafts, setRoundDrafts] = useState<Record<string, RoundDraft>>(() =>
    Object.fromEntries(initialData.rounds.map((round) => [round.$id, toRoundDraft(round)]))
  );
  const [newRoundDraft, setNewRoundDraft] = useState<RoundDraft>(createEmptyRoundDraft());
  const [participantDrafts, setParticipantDrafts] = useState<Record<string, ParticipantDraft>>({});
  const [bulkScheduleDrafts, setBulkScheduleDrafts] = useState<Record<string, BulkScheduleDraft>>({});
  const [isPending, startTransition] = useTransition();
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const applicationChannels = useMemo(() => [getCollectionRealtimeChannel(Collections.APPLICATIONS)], []);
  const workflowChannels = useMemo(
    () => initialFilters.roleId
      ? [
          getCollectionRealtimeChannel(Collections.PLACEMENT_ROUNDS),
          getCollectionRealtimeChannel(Collections.ROUND_PARTICIPANTS),
          getCollectionRealtimeChannel(Collections.RESULTS),
        ]
      : [],
    [initialFilters.roleId]
  );

  const visibleApplications = useMemo(() => {
    if (!studentFilter) {
      return applications;
    }

    const variableMap = new Map(initialData.variables.map((item) => [item.name, item]));
    return applications.filter((application) =>
      evaluateEligibilityRule(
        studentFilter,
        {
          userId: application.student.userId,
          profileId: application.student.profileId,
          universityId: application.universityId,
          values: application.student.variableValues,
        },
        { variables: variableMap }
      )
    );
  }, [applications, initialData.variables, studentFilter]);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (initialFilters.search) params.set("search", initialFilters.search);
    if (initialFilters.status) params.set("status", initialFilters.status);
    if (initialFilters.roleId) params.set("roleId", initialFilters.roleId);
    if (initialFilters.companyId) params.set("companyId", initialFilters.companyId);
    if (studentFilter) params.set("studentFilter", JSON.stringify(studentFilter));
    return `/api/admin/applications/export?${params.toString()}`;
  }, [initialFilters, studentFilter]);

  const participantsByRound = useMemo(() => {
    const entries = new Map<string, Array<{ application: ApplicationDetail; workflow: ApplicationRoundWorkflow }>>();
    for (const application of visibleApplications) {
      for (const workflow of application.workflow) {
        if (!workflow.participant) continue;
        const existing = entries.get(workflow.round.$id) ?? [];
        existing.push({ application, workflow });
        entries.set(workflow.round.$id, existing);
      }
    }
    return entries;
  }, [visibleApplications]);

  async function refreshLiveData(): Promise<void> {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;

    try {
      const applicationsParams = new URLSearchParams();
      if (initialFilters.search) applicationsParams.set("search", initialFilters.search);
      if (initialFilters.status) applicationsParams.set("status", initialFilters.status);
      if (initialFilters.roleId) applicationsParams.set("roleId", initialFilters.roleId);
      if (initialFilters.companyId) applicationsParams.set("companyId", initialFilters.companyId);
      if (studentFilter) applicationsParams.set("studentFilter", JSON.stringify(studentFilter));
      const [applicationsResponse, roundsResponse] = await Promise.all([
        fetch(`/api/admin/applications?${applicationsParams.toString()}`, { cache: "no-store" }),
        initialFilters.roleId
          ? fetch(`/api/admin/roles/${initialFilters.roleId}/rounds`, { cache: "no-store" })
          : Promise.resolve(null),
      ]);

      if (applicationsResponse.ok) {
        const nextApplications = await applicationsResponse.json() as PaginatedApplications<ApplicationDetail>;
        setApplications(nextApplications.items);
      }

      if (roundsResponse?.ok) {
        const nextRounds = await roundsResponse.json() as PlacementRound[];
        setRounds(nextRounds);
        setRoundDrafts((current) => Object.fromEntries(nextRounds.map((round) => [round.$id, current[round.$id] ?? toRoundDraft(round)])));
      }
    } finally {
      refreshInFlightRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void refreshLiveData();
      }
    }
  }

  useRealtimeSubscription({
    enabled: true,
    channels: applicationChannels,
    onEvent: () => {
      startTransition(() => {
        void refreshLiveData();
      });
    },
  });

  useRealtimeSubscription({
    enabled: workflowChannels.length > 0,
    channels: workflowChannels,
    onEvent: () => {
      startTransition(() => {
        void refreshLiveData();
      });
    },
  });

  function updateApplication(next: ApplicationDetail): void {
    setApplications((current) => current.map((item) => item.$id === next.$id ? next : item));
  }

  function toggleSelection(applicationId: string): void {
    setSelectedIds((current) => current.includes(applicationId) ? current.filter((id) => id !== applicationId) : [...current, applicationId]);
  }

  function withRequest(action: () => Promise<void>): void {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Request failed.");
      }
    });
  }

  async function readJson(response: Response): Promise<unknown> {
    const data = await response.json() as { message?: string };
    if (!response.ok) {
      throw new Error(data.message ?? "Request failed.");
    }
    return data;
  }

  function runSingleAction(applicationId: string, action: "shortlist" | "reject" | "move-to-round"): void {
    withRequest(async () => {
      const response = await fetch(`/api/admin/applications/${applicationId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "move-to-round" ? { roundId, notes } : { notes }),
      });
      const data = await readJson(response) as ApplicationDetail;
      updateApplication(data);
      setMessage(action === "move-to-round" ? "Candidate added to the selected round." : `Application ${action}ed.`);
    });
  }

  function runBulkAction(action: "shortlist" | "reject" | "move_to_round" | "auto_shortlist", mode: "selection" | "filtered"): void {
    if (action === "reject" && !window.confirm("Reject all targeted candidates?")) {
      return;
    }

    withRequest(async () => {
      const response = await fetch("/api/admin/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          applicationIds: mode === "selection" ? selectedIds : undefined,
          notes: notes || undefined,
          roundId: action === "move_to_round" ? roundId || undefined : undefined,
          filters: mode === "filtered" ? {
            search: initialFilters.search || undefined,
            status: initialFilters.status || undefined,
            roleId: initialFilters.roleId || undefined,
            companyId: initialFilters.companyId || undefined,
            studentFilter,
          } : undefined,
        }),
      });
      const data = await readJson(response) as BulkActionResult;
      if (data.mode === "direct" && data.applications) {
        const byId = new Map(data.applications.map((item) => [item.$id, item]));
        setApplications((current) => current.map((item) => byId.get(item.$id) ?? item));
      }
      setSelectedIds([]);
      setMessage(data.mode === "queued" ? "Bulk operation queued." : "Bulk operation completed.");
    });
  }

  function importCsv(): void {
    if (!importFile) {
      setError("Select a CSV file first.");
      return;
    }

    withRequest(async () => {
      const formData = new FormData();
      formData.set("file", importFile);
      const response = await fetch("/api/admin/applications/import", { method: "POST", body: formData });
      await readJson(response);
      setImportFile(null);
      setMessage("CSV import queued.");
    });
  }

  function createRound(): void {
    if (!initialFilters.roleId) {
      setError("Choose a role filter before creating rounds.");
      return;
    }

    withRequest(async () => {
      const response = await fetch(`/api/admin/roles/${initialFilters.roleId}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRoundDraft),
      });
      const created = await readJson(response) as PlacementRound;
      const nextRounds = [...rounds, created].sort((left, right) => left.sequence - right.sequence);
      setRounds(nextRounds);
      setRoundDrafts((current) => ({ ...current, [created.$id]: toRoundDraft(created) }));
      setRoundId(created.$id);
      setNewRoundDraft(createEmptyRoundDraft());
      setMessage("Round created.");
    });
  }

  function saveRound(roundIdToSave: string): void {
    withRequest(async () => {
      const response = await fetch(`/api/admin/roles/${initialFilters.roleId}/rounds/${roundIdToSave}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roundDrafts[roundIdToSave]),
      });
      const updated = await readJson(response) as PlacementRound;
      setRounds((current) => current.map((round) => round.$id === updated.$id ? updated : round));
      setRoundDrafts((current) => ({ ...current, [updated.$id]: toRoundDraft(updated) }));
      setMessage("Round updated.");
    });
  }

  function deleteRound(roundIdToDelete: string): void {
    if (!window.confirm("Delete this round and its participant records?")) {
      return;
    }

    withRequest(async () => {
      const response = await fetch(`/api/admin/roles/${initialFilters.roleId}/rounds/${roundIdToDelete}`, { method: "DELETE" });
      await readJson(response);
      setRounds((current) => current.filter((round) => round.$id !== roundIdToDelete));
      setRoundDrafts((current) => {
        const next = { ...current };
        delete next[roundIdToDelete];
        return next;
      });
      if (roundId === roundIdToDelete) {
        setRoundId("");
      }
      setMessage("Round deleted.");
    });
  }

  function moveRound(roundIdToMove: string, direction: -1 | 1): void {
    const index = rounds.findIndex((round) => round.$id === roundIdToMove);
    const target = rounds[index + direction];
    if (index < 0 || !target) {
      return;
    }

    const nextRounds = rounds.slice();
    nextRounds[index] = target;
    nextRounds[index + direction] = rounds[index];

    withRequest(async () => {
      const response = await fetch(`/api/admin/roles/${initialFilters.roleId}/rounds/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundIds: nextRounds.map((round) => round.$id) }),
      });
      const reordered = await readJson(response) as PlacementRound[];
      setRounds(reordered);
      setRoundDrafts((current) => Object.fromEntries(reordered.map((round) => [round.$id, current[round.$id] ?? toRoundDraft(round)])));
      setMessage("Round order updated.");
    });
  }

  function saveParticipant(participant: RoundParticipant): void {
    const draft = participantDrafts[participant.$id] ?? createParticipantDraft(participant);
    withRequest(async () => {
      const response = await fetch(`/api/admin/round-participants/${participant.$id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledStart: draft.scheduledStart ? toIsoFromLocalInput(draft.scheduledStart) : undefined,
          scheduledEnd: draft.scheduledEnd ? toIsoFromLocalInput(draft.scheduledEnd) : undefined,
          slotLabel: draft.slotLabel || undefined,
          room: draft.room || undefined,
          location: draft.location || undefined,
          meetingLink: draft.meetingLink || undefined,
          scheduleTimezone: draft.scheduleTimezone || undefined,
          scheduleStatus: draft.scheduleStatus,
          cancellationReason: draft.cancellationReason || undefined,
          instructions: draft.instructions || undefined,
          interviewerIds: draft.interviewerIds.split(",").map((item) => item.trim()).filter(Boolean),
          score: draft.score ? Number(draft.score) : undefined,
          notes: draft.notes || undefined,
          outcome: draft.outcome || undefined,
          feedback: draft.feedback || undefined,
          publishResult: draft.publishResult,
        }),
      });
      const updated = await readJson(response) as ApplicationDetail;
      updateApplication(updated);
      setMessage("Participant updated.");
    });
  }

  function bulkScheduleRound(round: PlacementRound): void {
    const participants = (participantsByRound.get(round.$id) ?? []).map(({ workflow }) => workflow.participant!).filter(Boolean);
    const draft = bulkScheduleDrafts[round.$id] ?? createBulkScheduleDraft();
    if (participants.length === 0) {
      setError("No participants are available to bulk schedule.");
      return;
    }
    if (!draft.startTime) {
      setError("Select a bulk schedule start time.");
      return;
    }
    const duration = Number(draft.durationMinutes);
    const gap = Number(draft.gapMinutes || "0");
    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Duration must be a positive number of minutes.");
      return;
    }

    withRequest(async () => {
      const baseStart = new Date(toIsoFromLocalInput(draft.startTime));
      const slots = participants.map((participant, index) => {
        const start = new Date(baseStart.getTime() + index * (duration + gap) * 60_000);
        const end = new Date(start.getTime() + duration * 60_000);
        return {
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          slotLabel: `Slot ${index + 1}`,
          room: draft.room || undefined,
          location: draft.location || undefined,
          meetingLink: draft.meetingLink || undefined,
          interviewerIds: draft.interviewerIds.split(",").map((item) => item.trim()).filter(Boolean),
          instructions: draft.instructions || undefined,
          scheduleTimezone: draft.scheduleTimezone || detectUserTimeZone(),
        };
      });
      const response = await fetch(`/api/admin/roles/${initialFilters.roleId}/rounds/${round.$id}/bulk-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: participants.map((participant) => participant.$id),
          slots,
        }),
      });
      const updated = await readJson(response) as ApplicationDetail[];
      const byId = new Map(updated.map((item) => [item.$id, item]));
      setApplications((current) => current.map((item) => byId.get(item.$id) ?? item));
      setMessage("Round participants scheduled.");
    });
  }

  function removeParticipant(participant: RoundParticipant): void {
    if (!window.confirm("Remove this candidate from the round?")) {
      return;
    }
    withRequest(async () => {
      const response = await fetch(`/api/admin/round-participants/${participant.$id}`, { method: "DELETE" });
      const updated = await readJson(response) as ApplicationDetail;
      updateApplication(updated);
      setMessage("Participant removed from round.");
    });
  }

  function advanceParticipant(applicationId: string, currentRoundId: string): void {
    withRequest(async () => {
      const response = await fetch(`/api/admin/applications/${applicationId}/advance-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: currentRoundId, notes }),
      });
      const updated = await readJson(response) as ApplicationDetail;
      updateApplication(updated);
      setMessage("Candidate moved forward.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Student variable filter</CardTitle>
          <CardDescription>Build shortlist rules like `cgpa &gt; 8` and `work_experience_months &gt; 12`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {studentFilter ? <RuleEditor node={studentFilter} variables={initialData.variables} onChange={setStudentFilter} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setStudentFilter(createDefaultFilter(initialData.variables))}>Reset filter</Button>
            <Button type="button" size="sm" onClick={() => runBulkAction("auto_shortlist", "filtered")} loading={isPending}>Automatic shortlist filtered candidates</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Round workflow</CardTitle>
          <CardDescription>
            {initialFilters.roleId
              ? "Create, reorder, and manage as many rounds as this role needs."
              : "Apply a role filter on this page to configure that role's round workflow."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {initialFilters.roleId ? (
            <>
              <div className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-2">
                <input value={newRoundDraft.name} onChange={(event) => setNewRoundDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Round name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <select value={newRoundDraft.type} onChange={(event) => setNewRoundDraft((current) => ({ ...current, type: event.target.value as PlacementRound["type"] }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {ROUND_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
                </select>
                <input type="datetime-local" value={newRoundDraft.startTime} onChange={(event) => setNewRoundDraft((current) => ({ ...current, startTime: event.target.value }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <input type="datetime-local" value={newRoundDraft.endTime} onChange={(event) => setNewRoundDraft((current) => ({ ...current, endTime: event.target.value }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <input value={newRoundDraft.location} onChange={(event) => setNewRoundDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Location" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <input value={newRoundDraft.meetingLink} onChange={(event) => setNewRoundDraft((current) => ({ ...current, meetingLink: event.target.value }))} placeholder="Meeting link" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <textarea value={newRoundDraft.instructions} onChange={(event) => setNewRoundDraft((current) => ({ ...current, instructions: event.target.value }))} placeholder="Instructions" className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" />
                <div className="md:col-span-2">
                  <Button type="button" size="sm" onClick={createRound} loading={isPending}>Create round</Button>
                </div>
              </div>
              <div className="space-y-4">
                {rounds.map((round, index) => (
                  <div key={round.$id} className="rounded-lg border border-border p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Round {round.sequence}</Badge>
                        <Badge variant={round.status === "completed" ? "success" : round.status === "cancelled" ? "danger" : "outline"}>{round.status}</Badge>
                        <p className="text-sm font-medium">{round.name}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => moveRound(round.$id, -1)} disabled={index === 0 || isPending}>Up</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => moveRound(round.$id, 1)} disabled={index === rounds.length - 1 || isPending}>Down</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => saveRound(round.$id)} loading={isPending}>Save</Button>
                        <Button type="button" size="sm" variant="danger" onClick={() => deleteRound(round.$id)} loading={isPending}>Delete</Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input value={roundDrafts[round.$id]?.name ?? ""} onChange={(event) => setRoundDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? toRoundDraft(round)), name: event.target.value } }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      <select value={roundDrafts[round.$id]?.type ?? round.type} onChange={(event) => setRoundDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? toRoundDraft(round)), type: event.target.value as PlacementRound["type"] } }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {ROUND_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
                      </select>
                      <input type="datetime-local" value={toLocalDateTimeValue(roundDrafts[round.$id]?.startTime)} onChange={(event) => setRoundDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? toRoundDraft(round)), startTime: event.target.value } }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      <input type="datetime-local" value={toLocalDateTimeValue(roundDrafts[round.$id]?.endTime)} onChange={(event) => setRoundDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? toRoundDraft(round)), endTime: event.target.value } }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      <input value={roundDrafts[round.$id]?.location ?? ""} onChange={(event) => setRoundDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? toRoundDraft(round)), location: event.target.value } }))} placeholder="Location" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      <input value={roundDrafts[round.$id]?.meetingLink ?? ""} onChange={(event) => setRoundDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? toRoundDraft(round)), meetingLink: event.target.value } }))} placeholder="Meeting link" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      <textarea value={roundDrafts[round.$id]?.instructions ?? ""} onChange={(event) => setRoundDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? toRoundDraft(round)), instructions: event.target.value } }))} placeholder="Instructions" className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" />
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Participants</p>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => { setRoundId(round.$id); runBulkAction("move_to_round", "selection"); }} disabled={selectedIds.length === 0} loading={isPending}>
                            Add selected candidates
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => bulkScheduleRound(round)} loading={isPending}>
                            Bulk schedule
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-4">
                        <input type="datetime-local" value={bulkScheduleDrafts[round.$id]?.startTime ?? ""} onChange={(event) => setBulkScheduleDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? createBulkScheduleDraft()), startTime: event.target.value } }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        <input value={bulkScheduleDrafts[round.$id]?.durationMinutes ?? "30"} onChange={(event) => setBulkScheduleDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? createBulkScheduleDraft()), durationMinutes: event.target.value } }))} placeholder="Duration minutes" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        <input value={bulkScheduleDrafts[round.$id]?.gapMinutes ?? "0"} onChange={(event) => setBulkScheduleDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? createBulkScheduleDraft()), gapMinutes: event.target.value } }))} placeholder="Gap minutes" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        <input value={bulkScheduleDrafts[round.$id]?.room ?? ""} onChange={(event) => setBulkScheduleDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? createBulkScheduleDraft()), room: event.target.value } }))} placeholder="Room" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        <input value={bulkScheduleDrafts[round.$id]?.location ?? ""} onChange={(event) => setBulkScheduleDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? createBulkScheduleDraft()), location: event.target.value } }))} placeholder="Location" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        <input value={bulkScheduleDrafts[round.$id]?.meetingLink ?? ""} onChange={(event) => setBulkScheduleDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? createBulkScheduleDraft()), meetingLink: event.target.value } }))} placeholder="Meeting link" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        <input value={bulkScheduleDrafts[round.$id]?.interviewerIds ?? ""} onChange={(event) => setBulkScheduleDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? createBulkScheduleDraft()), interviewerIds: event.target.value } }))} placeholder="Interviewer IDs" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        <input value={bulkScheduleDrafts[round.$id]?.scheduleTimezone ?? detectUserTimeZone()} onChange={(event) => setBulkScheduleDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? createBulkScheduleDraft()), scheduleTimezone: event.target.value } }))} placeholder="Timezone" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        <textarea value={bulkScheduleDrafts[round.$id]?.instructions ?? ""} onChange={(event) => setBulkScheduleDrafts((current) => ({ ...current, [round.$id]: { ...(current[round.$id] ?? createBulkScheduleDraft()), instructions: event.target.value } }))} placeholder="Instructions for all slots" className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-4" />
                      </div>
                      {(participantsByRound.get(round.$id) ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No participants assigned yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {(participantsByRound.get(round.$id) ?? []).map(({ application, workflow }) => {
                            const participant = workflow.participant!;
                            const draft = participantDrafts[participant.$id] ?? createParticipantDraft(participant, workflow);
                            return (
                              <div key={participant.$id} className="rounded-md border border-border p-3">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium">{application.student.name}</p>
                                    <p className="text-xs text-muted-foreground">{application.student.email}</p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {workflow.result ? <Badge variant={workflow.result.outcome === "FAILED" ? "danger" : "success"}>{workflow.result.outcome}</Badge> : null}
                                    <Button type="button" size="sm" variant="outline" onClick={() => advanceParticipant(application.$id, round.$id)} loading={isPending}>Move forward</Button>
                                    <Button type="button" size="sm" variant="danger" onClick={() => runSingleAction(application.$id, "reject")} loading={isPending}>Reject</Button>
                                  </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <input type="datetime-local" value={toLocalDateTimeValue(draft.scheduledStart)} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, scheduledStart: event.target.value } }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                  <input type="datetime-local" value={toLocalDateTimeValue(draft.scheduledEnd)} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, scheduledEnd: event.target.value } }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                  <input value={draft.slotLabel} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, slotLabel: event.target.value } }))} placeholder="Slot label" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                  <input value={draft.room} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, room: event.target.value } }))} placeholder="Room" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                  <input value={draft.location} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, location: event.target.value } }))} placeholder="Candidate location" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                  <input value={draft.meetingLink} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, meetingLink: event.target.value } }))} placeholder="Candidate meeting link" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                  <input value={draft.scheduleTimezone} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, scheduleTimezone: event.target.value } }))} placeholder="Timezone" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                  <select value={draft.scheduleStatus} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, scheduleStatus: event.target.value as ParticipantDraft["scheduleStatus"] } }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="pending">Pending</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="rescheduled">Rescheduled</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                  <input value={draft.interviewerIds} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, interviewerIds: event.target.value } }))} placeholder="Interviewer IDs, comma separated" className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" />
                                  <textarea value={draft.instructions} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, instructions: event.target.value } }))} placeholder="Candidate instructions" className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" />
                                  <textarea value={draft.cancellationReason} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, cancellationReason: event.target.value } }))} placeholder="Cancellation reason" className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" />
                                  <input value={draft.score} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, score: event.target.value } }))} placeholder="Score" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                  <select value={draft.outcome} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, outcome: event.target.value as ParticipantDraft["outcome"] } }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Pending result</option>
                                    {ROUND_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{outcome}</option>)}
                                  </select>
                                  <textarea value={draft.notes} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, notes: event.target.value } }))} placeholder="Internal notes" className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                  <textarea value={draft.feedback} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, feedback: event.target.value } }))} placeholder="Student-facing feedback" className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                </div>
                                <label className="mt-3 flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={draft.publishResult} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [participant.$id]: { ...draft, publishResult: event.target.checked } }))} />
                                  Publish result to student
                                </label>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button type="button" size="sm" variant="outline" onClick={() => saveParticipant(participant)} loading={isPending}>Save participant</Button>
                                  <Button type="button" size="sm" variant="danger" onClick={() => removeParticipant(participant)} loading={isPending}>Remove participant</Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {(message || error) ? <p className={error ? "text-sm text-destructive" : "text-sm"}>{error ?? message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk operations</CardTitle>
          <CardDescription>{visibleApplications.length} visible on this page · {initialData.applications.total} matching on server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional audit note" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => runBulkAction("shortlist", "selection")} loading={isPending} disabled={selectedIds.length === 0}>Bulk shortlist selected</Button>
              <Button type="button" size="sm" variant="danger" onClick={() => runBulkAction("reject", "selection")} loading={isPending} disabled={selectedIds.length === 0}>Bulk reject selected</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => runBulkAction("shortlist", "filtered")} loading={isPending}>Bulk shortlist filtered</Button>
              <Button type="button" size="sm" variant="danger" onClick={() => runBulkAction("reject", "filtered")} loading={isPending}>Bulk reject filtered</Button>
            </div>
            <div className="flex gap-2">
              <select value={roundId} onChange={(event) => setRoundId(event.target.value)} className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select round</option>
                {rounds.map((round) => (
                  <option key={round.$id} value={round.$id}>{round.sequence}. {round.name}</option>
                ))}
              </select>
              <Button type="button" size="sm" onClick={() => runBulkAction("move_to_round", "selection")} loading={isPending} disabled={selectedIds.length === 0 || !roundId}>Add selected</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={exportHref} className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent">Export CSV</a>
            <input type="file" accept=".csv,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={importCsv} loading={isPending}>Import CSV</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleApplications.map((application) => (
            <div key={application.$id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selectedIds.includes(application.$id)} onChange={() => toggleSelection(application.$id)} />
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Link href={`/applications/${application.$id}`} className="text-sm font-medium text-primary underline">
                        {application.student.name} · {application.role.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">{application.student.email} · {application.company.name}</p>
                      <p className="text-xs text-muted-foreground">Applied {formatDate(application.appliedAt)} · Current round {application.currentRound?.round.name ?? "Not assigned"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {application.workflow.map((entry) => (
                        <span key={entry.round.$id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">
                          <span className={timelineDotClass(entry.state)} />
                          {entry.round.sequence}. {entry.round.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(application.status)}>{application.status}</Badge>
                  <Button type="button" variant="outline" size="sm" onClick={() => runSingleAction(application.$id, "shortlist")} loading={isPending}>Shortlist</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => runSingleAction(application.$id, "move-to-round")} loading={isPending} disabled={!roundId}>Add to round</Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => runSingleAction(application.$id, "reject")} loading={isPending}>Reject</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const ROUND_TYPE_OPTIONS: PlacementRound["type"][] = [
  "resume_shortlist",
  "online_assessment",
  "technical_interview",
  "managerial_interview",
  "hr_interview",
  "group_discussion",
  "other",
];

const ROUND_OUTCOMES: RoundOutcome[] = ["PASSED", "FAILED", "WAITLISTED", "SELECTED"];

function RuleEditor({ node, variables, onChange }: { node: RuleNode; variables: VariableDefinition[]; onChange: (node: RuleNode | null) => void }) {
  if (node.type === "condition") {
    return <ConditionEditor node={node} variables={variables} onChange={onChange} />;
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap gap-2">
        <select value={node.logic} onChange={(event) => onChange({ ...node, logic: event.target.value as GroupNode["logic"] })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...node, children: [...node.children, createDefaultCondition(variables)] })}>Add condition</Button>
      </div>
      {node.children.map((child, index) => (
        <RuleEditor
          key={index}
          node={child}
          variables={variables}
          onChange={(next) => {
            const children = node.children.slice();
            if (next) {
              children[index] = next;
            } else {
              children.splice(index, 1);
            }
            onChange({ ...node, children: children.length > 0 ? children : [createDefaultCondition(variables)] });
          }}
        />
      ))}
    </div>
  );
}

function ConditionEditor({ node, variables, onChange }: { node: ConditionNode; variables: VariableDefinition[]; onChange: (node: RuleNode | null) => void }) {
  const variable = variables.find((item) => item.name === node.variable) ?? variables[0];
  const operators = variable?.type === "number"
    ? ["gt", "gte", "lt", "lte", "eq", "neq"]
    : variable?.type === "boolean"
      ? ["eq", "neq"]
      : variable?.type === "date"
        ? ["before", "on_or_before", "after", "on_or_after", "eq", "neq"]
        : variable?.type === "multi_select"
          ? ["contains", "not_contains"]
          : ["eq", "neq"];

  return (
    <div className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[1.4fr_1fr_1.3fr_auto]">
      <select value={node.variable} onChange={(event) => onChange({ ...node, variable: event.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
        {variables.map((item) => (
          <option key={item.name} value={item.name}>{item.label}</option>
        ))}
      </select>
      <select value={node.operator} onChange={(event) => onChange({ ...node, operator: event.target.value as ConditionNode["operator"] })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
        {operators.map((operator) => (
          <option key={operator} value={operator}>{operator}</option>
        ))}
      </select>
      <input value={String(node.value ?? "")} onChange={(event) => onChange({ ...node, value: normalizeInputValue(variable, event.target.value) })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Value" />
      <Button type="button" size="sm" variant="outline" onClick={() => onChange(null)}>Remove</Button>
    </div>
  );
}

function createDefaultFilter(variables: VariableDefinition[]): RuleNode {
  return {
    type: "group",
    logic: "AND",
    children: [createDefaultCondition(variables)],
  };
}

function createDefaultCondition(variables: VariableDefinition[]): ConditionNode {
  const variable = variables.find((item) => item.name === "cgpa") ?? variables[0];
  return {
    type: "condition",
    variable: variable?.name ?? "cgpa",
    operator: variable?.type === "number" ? "gt" : "eq",
    value: variable?.type === "number" ? 8 : "",
  };
}

function normalizeInputValue(variable: VariableDefinition | undefined, value: string): string | number | boolean {
  if (variable?.type === "number") {
    return Number(value);
  }
  if (variable?.type === "boolean") {
    return value.toLowerCase() === "true";
  }
  return value;
}

function statusBadgeVariant(status: ApplicationDetail["status"]) {
  if (status === "REJECTED" || status === "WITHDRAWN") return "danger";
  if (status === "SHORTLISTED" || status === "SELECTED" || status === "OFFERED" || status === "ACCEPTED") return "success";
  return "outline";
}

function timelineDotClass(state: ApplicationRoundWorkflow["state"]): string {
  if (state === "selected") return "h-2.5 w-2.5 rounded-full bg-emerald-500";
  if (state === "completed") return "h-2.5 w-2.5 rounded-full bg-sky-500";
  if (state === "active") return "h-2.5 w-2.5 rounded-full bg-amber-500";
  if (state === "rejected") return "h-2.5 w-2.5 rounded-full bg-rose-500";
  return "h-2.5 w-2.5 rounded-full bg-border";
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toRoundDraft(round: PlacementRound): RoundDraft {
  return {
    name: round.name,
    type: round.type,
    description: round.description ?? "",
    instructions: round.instructions ?? "",
    startTime: toLocalDateTimeValue(round.startTime),
    endTime: toLocalDateTimeValue(round.endTime),
    location: round.location ?? "",
    meetingLink: round.meetingLink ?? "",
    status: round.status,
  };
}

function createEmptyRoundDraft(): RoundDraft {
  return {
    name: "",
    type: "online_assessment",
    description: "",
    instructions: "",
    startTime: "",
    endTime: "",
    location: "",
    meetingLink: "",
    status: "scheduled",
  };
}

function createParticipantDraft(participant: RoundParticipant, workflow?: ApplicationRoundWorkflow): ParticipantDraft {
  return {
    scheduledStart: toLocalDateTimeValue(participant.scheduledStart),
    scheduledEnd: toLocalDateTimeValue(participant.scheduledEnd),
    slotLabel: participant.slotLabel ?? "",
    room: participant.room ?? "",
    location: participant.location ?? workflow?.round.location ?? "",
    meetingLink: participant.meetingLink ?? workflow?.round.meetingLink ?? "",
    scheduleTimezone: participant.scheduleTimezone ?? detectUserTimeZone(),
    scheduleStatus: participant.scheduleStatus,
    cancellationReason: participant.cancellationReason ?? "",
    instructions: participant.instructions ?? workflow?.round.instructions ?? "",
    interviewerIds: participant.interviewerIds.join(", "),
    score: participant.score !== undefined ? String(participant.score) : "",
    notes: participant.notes ?? "",
    outcome: workflow?.result?.outcome ?? "",
    feedback: workflow?.result?.feedback ?? "",
    publishResult: participant.resultPublished || Boolean(workflow?.result?.publishedAt),
  };
}

function createBulkScheduleDraft(): BulkScheduleDraft {
  return {
    startTime: "",
    durationMinutes: "30",
    gapMinutes: "0",
    room: "",
    location: "",
    meetingLink: "",
    interviewerIds: "",
    instructions: "",
    scheduleTimezone: detectUserTimeZone(),
  };
}

function toLocalDateTimeValue(value?: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60_000);
  return normalized.toISOString().slice(0, 16);
}

function toIsoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function detectUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
