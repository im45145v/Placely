# Placely UX/Accessibility Improvement Plan

## Goal
Improve Placely's UI accessibility, motion design, and workflow intuitiveness across admin and student surfaces, and add reusable "perspective skills" (placement coordinator, applicant, admin) that guide review work.

## Current context (verified in repo)
- Next.js 16.3.3 App Router, React 19.2.8, Tailwind CSS v4, Appwrite backend, TypeScript strict. No component library (no Radix/shadcn) — `src/components/ui/*` are hand-rolled (Button, Card, Badge, StatusChip, MetricCard, FilterBar, SectionTabs, DetailTabs, SplitPane). Duplicate `EmptyState` exists in both `src/components/ui/` and `src/components/feedback/`.
- Design tokens are CSS variables in `src/app/globals.css` (HSL, light theme only — no dark mode, no `prefers-reduced-motion` block seen).
- Two role surfaces: `src/app/(student)/*` and `src/app/(admin)/*` with an admin section registry at `src/lib/admin/registry.ts`.
- Verification commands: `npm run lint`, `npm run typecheck`, `npm run build` (no test runner installed; add Vitest + axe for accessibility tests).
- Existing Hermes skills live under `~/.hermes/skills/` (categories exist; no placely-review skill yet).
- Read `node_modules/next/dist/docs/` before writing Next code — this version has breaking changes vs training data (per AGENTS.md).

## Architecture / proposed approach
Three workstreams, each independently shippable: (1) a shared a11y + motion foundation in `globals.css` and `src/components/ui/` so every page inherits improvements; (2) page-level fixes on the highest-traffic flows (student roles list/detail, applications, admin applications review) guided by three personas; (3) reusable Hermes skills under `~/.hermes/skills/software-development/` encoding persona-based review checklists so future sessions reuse them. Keep everything CSS/Tailwind-only — no new runtime deps except dev tools (vitest, axe-core, jest-axe).

## Step-by-step tasks

### Phase 0 — Test scaffolding (TDD foundation)

**Task 0.1 — Install dev test tooling**
```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom axe-core jest-axe @types/jest-axe
```
Expected: exit 0, package.json devDependencies updated.

**Task 0.2 — Create `vitest.config.ts` at repo root**
```ts
import { defineConfig } from "vitest/config";
import react from "@testing-library/react";
import path from "node:path";
export default defineConfig({
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```
Add `"test": "vitest run"` to `package.json` scripts. Create `vitest.setup.ts` with `import "@testing-library/jest-dom/vitest";`.
Verify: `npm run test` → exits 0 with "No test files found" (or add `--passWithNoTests`).

### Phase 1 — Accessibility & motion foundation (files changed once, benefit everywhere)

**Task 1.1 — Reduced motion + focus tokens in `src/app/globals.css`**
Append:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
:root {
  --radius: 0.5rem;
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up { animation: fade-in-up 180ms ease-out; }
```
Verify: `npm run build` passes.

**Task 1.2 — TDD: Button visible focus ring**
Write failing test `src/components/ui/Button.test.tsx`:
```tsx
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { Button } from "./Button";

test("Button has no axe violations and shows focus ring on keyboard focus", async () => {
  const { container, getByRole } = render(<Button>Save</Button>);
  expect(await axe(container)).toHaveNoAxeViolations();
  const btn = getByRole("button", { name: "Save" });
  btn.focus();
  expect(btn.className).toContain("focus-visible:ring-2");
});
```
Run `npm run test` → FAILS (Button uses `focus:ring-2`, which also fires on mouse click; `focus-visible` is the a11y-correct token).
Fix in `src/components/ui/Button.tsx`: replace `focus:outline-none focus:ring-2 focus:ring-offset-2` with `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring`, and add `transition-all duration-150 motion-reduce:transition-none` to `base`.
Run `npm run test` → passes. Commit: `test(a11y): button focus-visible + axe`.

**Task 1.3 — Delete duplicate EmptyState**
Keep `src/components/ui/EmptyState.tsx` (check which is imported via `grep -rn "feedback/EmptyState\|ui/EmptyState" src --include=*.tsx`), delete the other, fix imports. Verify: `npm run typecheck` passes.

**Task 1.4 — a11y sweep of shared components** (StatusChip, Badge, FilterBar, SectionTabs, DetailTabs, MetricCard in `src/components/ui/`)
For each: add axe test first (`expect(await axe(container)).toHaveNoAxeViolations()`), run → fix → pass. Known likely fixes:
- StatusChip/badges relying on color alone → include `aria-label` or text icon (e.g. "● Shortlisted" not just a green dot).
- SectionTabs → ensure `role="tablist"`/`role="tab"`/`aria-selected` or convert to nav+links.
- Icon-only buttons (FilterBar clear) → `aria-label`.
Verify each with `npm run test`. Commit per component.

### Phase 2 — Workflow improvements, persona by persona

**Task 2.1 — Create the reusable review skills** (do this FIRST so they drive the page tasks)

Create `~/.hermes/skills/software-development/placely-persona-review/SKILL.md`:
```markdown
---
name: placely-persona-review
description: Use when reviewing or building Placely UI flows. Persona-based checklists for coordinator, applicant (student), and admin perspectives.
---
# Placely Persona Review

## Placement Coordinator (TPO staff)
- Can I launch a role and publish it in under 3 minutes without confusion?
- Are bulk actions (shortlist/reject/advance) safe: confirm dialogs, undo, counts shown?
- Do I see application counts and deadlines at a glance on the dashboard?
- Are eligibility criteria visible to me the way students will see them?

## Applicant (Student)
- Within 5 seconds of landing on /dashboard: what can I apply to, what's my deadline, what changed?
- Application status is always stated in words + position (never color alone).
- Withdrawing/withdrawing errors are confirmable and reversible where possible.
- Empty states tell me what to do next, not just "nothing here".

## Admin
- Destructive actions (close role, reject resume, deactivate student) require confirmation.
- Tables are keyboard navigable; actions reachable without hover-only menus.
- Loading and error states exist for every data fetch.

## Review procedure
1. Walk the flow as each persona using the browser tool; screenshot key states.
2. Check keyboard-only navigation (Tab/Enter/Esc) for the whole flow.
3. Run axe on the page DOM; fix violations in shared components first.
4. Log findings as tasks; fix root causes in `src/components/ui/` when shared.
```
(Adjust frontmatter to match house skill format — see `skill_view(name='hermes-agent-skill-authoring')` first.)

**Task 2.2 — Student: roles list `src/app/(student)/roles/page.tsx`**
Persona: applicant. Checklist items: deadline badges include date text not just "3 days left" color chip; card hover/focus uses `focus-visible:ring` + `animate-fade-in-up` on list mount; empty state links to profile completion.
Test first: axe test on a rendered card fixture in `src/app/(student)/roles/page.test.tsx` (extract card into `src/components/roles/RoleCard.tsx` if inline to make it testable).
Verify: `npm run test`, `npm run build`.

**Task 2.3 — Student: application status clarity in `src/app/(student)/applications/page.tsx` and `[applicationId]/page.tsx`**
Use StatusChip with `aria-label` = full status text; add a vertical timeline of rounds (simple `<ol>` with `aria-current="step"`), no new deps.
Verify: `npm run test` (axe on timeline fixture), `npm run build`.

**Task 2.4 — Coordinator: bulk action safety in `src/app/(admin)/admin/applications/page.tsx`**
Confirm dialogs (native `confirm()` is acceptable — YAGNI, no modal library) before bulk shortlist/reject showing the selected count; after action, show a toast/inline summary "5 shortlisted" with undo link if API supports.
Verify: manual walkthrough per skill checklist + `npm run build`.

**Task 2.5 — Admin: loading/error parity**
Grep for `use client` pages fetching data: every fetch path needs `Skeleton` (`src/components/feedback/Skeleton.tsx`) and an error message. Fix the 3 worst offenders found by the persona walk (likely admin dashboard, applications, roles).
Verify: `npm run build`, manual check with DevTools network throttle.

**Task 2.6 — Mobile/responsive sanity**
Student + admin sidebars (`src/components/layout/StudentSidebar.tsx`, `AdminSidebar.tsx`): at `sm` breakpoint collapse to a header menu with a proper `<button aria-expanded>` toggle. Keyboard test: menu opens with Enter, closes with Esc, focus moves into menu.
Verify: browser walkthrough at 375px width; `npm run typecheck`.

### Phase 3 — Closeout

**Task 3.1 — Full gates**
```bash
npm run lint && npm run typecheck && npm run test && npm run build
```
Expected: all exit 0.

**Task 3.2 — Commit sequence** (small, frequent)
One commit per task as above, e.g. `feat(a11y): reduced-motion + focus-visible tokens`, `feat(student): application timeline`, `chore: remove duplicate EmptyState`.

## Tests / validation
- TDD per component task: failing axe/RTL test → minimal fix → pass → commit.
- Every phase ends with `npm run lint && npm run typecheck && npm run build` clean.
- Persona walkthroughs executed per the `placely-persona-review` skill with screenshots as evidence.

## Risks, tradeoffs, open questions
- **No existing test runner**: adding Vitest is the biggest new surface; if install is problematic (React 19 + jsdom quirks), fall back to `@axe-core/cli` against a running dev server: `npx axe http://localhost:3000/roles` — still verifiable.
- **Next.js 16 unknowns**: docs in `node_modules/next/dist/docs/` must be consulted before touching route/layout conventions; do not copy patterns from training data.
- **Undo for bulk actions**: Appwrite-native backend may not make undo cheap — implement confirmation-first, treat undo as stretch (YAGNI).
- **Dark mode**: intentionally out of scope this pass (tokens are in place; separate task later).
- **Open question for the user**: any specific pages that feel worst today? If none, the persona walkthroughs decide priority (assumed: roles list, applications, admin applications).
- Duplicate EmptyState resolution: assume `src/components/ui/EmptyState.tsx` wins — confirm imports before deleting.
