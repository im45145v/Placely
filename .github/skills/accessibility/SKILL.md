---
name: accessibility
description: Use when auditing or improving UI accessibility, including keyboard navigation, semantic landmarks, labels, focus visibility, screen reader announcements, and reduced-motion behavior.
---

# Accessibility Skill

Use this skill to make UI surfaces measurably more accessible.

## Workflow

1. Audit the target UI against modern web accessibility rules (semantic HTML first, ARIA only when needed).
2. Fix high-impact issues first:
   - keyboard navigation
   - focus visibility
   - labels and names for controls
   - landmarks (`header`, `nav`, `main`, `footer`) and skip links
   - live regions for async updates
3. Preserve behavior while improving accessibility.
4. Re-run lint/type checks and report what changed.

## Minimum Bar

- Interactive controls are keyboard-operable.
- Focus indicators are visible via `:focus-visible`.
- Icon-only controls have accessible names.
- Forms provide labels and meaningful field names.
- Dynamic status/error updates announce through screen readers.
- Motion-heavy UI honors reduced-motion preferences.
