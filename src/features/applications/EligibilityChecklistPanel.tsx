import type { EligibilityChecklist } from "@/lib/eligibility/checklist";

/** Student-facing breakdown of every eligibility/placement criterion (pass and fail), grouped by source. */
export function EligibilityChecklistPanel({ checklist }: { checklist: EligibilityChecklist }) {
  if (checklist.groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {!checklist.eligible && (
        <p className="text-sm font-semibold text-destructive">You are not eligible for this Job Profile.</p>
      )}
      {checklist.groups.map((group) => (
        <div key={group.title}>
          <h4 className="text-sm font-semibold text-foreground">{group.title}</h4>
          <ul className="mt-2 space-y-1.5">
            {group.items.map((item) => (
              <li key={item.key} className="flex items-start gap-2 text-sm">
                <span className={item.satisfied ? "mt-0.5 text-green-600" : "mt-0.5 text-destructive"}>
                  {item.satisfied ? "✓" : "✗"}
                </span>
                <span className={item.satisfied ? "text-foreground" : "text-destructive"}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
