# vi.html Product Polish Roadmap (April 2026) — Historical Snapshot

> **Note (April 19, 2026):** This roadmap has been dissolved.
>
> - **Vision, Design North Star, Architectural Commitments, and Out-of-Scope decisions** moved into `CLAUDE.md` so they're always in Claude's context.
> - **Feature inventory** split into individual GitHub Issues (no milestones — they're the unmilestoned idea pile per the project-tracking convention in `~/.interslice-common/project-tracking.md`). The "Sprint N" temporal grouping was dropped because milestones represent launch gates, not phases.
> - **Process section** removed — the per-feature workflow (design spec → implementation plan → subagent-driven execution → PR) is captured in user-level methodology and the superpowers skills.
>
> This file is preserved for git-archaeology continuity. For current product direction:
> - `CLAUDE.md` — vision, design, architecture, out of scope.
> - `gh issue list` — feature pile.
> - `docs/plans/YYYY-MM-DD-<feature>.md` — per-feature design specs and implementation plans.

---

The original sprint-style content below is the snapshot as of the dissolution date. Items marked shipped were already complete at that point; the rest were filed as GitHub Issues.

## Shipped at dissolution

- **Sprint 1 #1 — Auto-continue lists** (via CM6 native; see superseded plan `2026-04-19-list-continuation.md`).
- **Sprint 1 #2 — Word count + reading time** (PR #14).
- **Sprint 2 #3 — Theme: the "Her" treatment** (PR #13).

## Filed as GitHub Issues

- #15 — Word-paste fidelity audit (was Sprint 2 #4)
- #16 — Outline / TOC pane (was Sprint 3 #5)
- #17 — Focus / typewriter mode (was Sprint 3 #6)
- #18 — Scroll-synced live preview (was Sprint 3 #7)
- #19 — Macros (was Sprint 4 #8)
- #20 — `:g`/`:v` global command (was Sprint 4 #9)
- #21 — Smart renumbering (was Sprint 5 #10)
- #22 — Autosave / persistence audit (was Sprint 5 #11)
- #23 — GFM tables (was Stretch #12)
- #24 — Footnotes (was Stretch #13)

## Someday-Maybe (Parking Lot, sister-project)

These were filed for later, mostly because they belong to the *recipe editor* sister project, not vi.html proper. Kept here for context — not filed as vi.html issues.

- **`cooleditor-rails` gem** — Stimulus controller wrapping the built bundle, importmap entry, configurable options. **Trigger:** after porting the vim layer into the recipe editor reveals real integration friction. **Anti-goal:** generalizing before we know what the API surface wants to be.
- **Cooleditor.com platform with accounts** (Rails 8 on Hetzner via Kamal): server-side document storage, share-by-shortcode, collaborative editing (CRDT), server-side PDF export, GitHub OAuth. **Trigger:** a specific feature on the inventory above that genuinely cannot be done client-side. **Guardrail:** the single-file `vi.html` stays the flagship artifact; the platform is additive, never replaces it.
