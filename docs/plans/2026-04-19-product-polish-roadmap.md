# vi.html Product Polish Roadmap (April 2026)

> **For Claude:** This is a multi-feature roadmap, not an executable plan. Each feature listed here gets its own dedicated implementation plan in `docs/plans/`. Pick a feature, write its plan with the `superpowers:writing-plans` skill, ship it, repeat. The roadmap itself is informational — there are no tasks to execute against it directly.

## Vision

vi.html is a single-file markdown editor for solo prose work — specifically the workflow of writing long documents (10–30 pages) in vim, then pasting clean HTML into Microsoft Word for final delivery. The target environment is a locked-down corporate machine where you can't install software but can open an HTML file in Edge.

This roadmap captures the next round of product polish: features that make daily writing more pleasant, distinctive, and well-grounded in vim muscle memory.

## Design North Star

The aesthetic target is the world of *Her* (2013) crossed with Geoff McFetridge's design language — warm, calm, friendly, low-contrast but comfortable. A computer that's a friend, not a hacker tool. An oasis from corporate beige.

Concretely:

- Warm cream / parchment background; espresso text (not harsh black)
- Terracotta or dusty-coral accents
- Generous whitespace and line-height
- Soft rounded forms; gentle easing on transitions
- Rounded sans for chrome; an optional serif for the prose surface itself
- Calm and deliberate, never aggressive

## Architectural Commitments

These are decided. Don't re-litigate.

- **Stays a single static HTML file.** No backend, no telemetry, no WebSockets, no phone-home behavior. GitHub Pages deployment.
- **Stack stays put.** CodeMirror 6 + `@replit/codemirror-vim` + `marked` is the foundation. We are not switching engines or rebuilding vim from scratch.
- **"Nearest native browser feature" pattern.** Before reimplementing a vim feature, ask whether a browser-native equivalent achieves the goal. Spellcheck (`:set spell` → contenteditable `spellcheck` attribute, see `src/main.js:333`, `src/vim/options.js:63`) is the model.
- **Smaller sequenced PRs.** One feature per branch per PR. No grand bundles.
- **Test discipline.** Pure functions are exported and unit-tested. Browser behavior is verified interactively via the `?test` harness.

## Reference Documents

- **[Goerz vim quick reference card](https://michaelgoerz.net/refcards/vimqrc.pdf)** ([LaTeX source](https://github.com/goerz/Refcards/tree/master/vim)) — the canonical scope artifact for vim coverage. Used as a *negative* scope doc: every cell on the card is either already covered, in the feature inventory below, or in the explicit out-of-scope list. New "do we need feature X?" debates should start with "is X on the refcard?" and "is it already classified?"

## Out of Scope, by Design

These were considered and explicitly excluded. Add to this list as new "no" decisions get made — to stop us re-litigating later.

- **Multi-windowing / window splits** (`:split`, `Ctrl-W` family). CM6 is one view; massive scope for marginal value.
- **Tags** (`Ctrl-]`, `:tags`, `gd`/`gD`, `:ts`/`:tj`). No tag files in a browser.
- **Compiling** (`:make`, `:compiler`, quickfix). No build pipeline.
- **Shell** (`:sh`, `:!cmd`), `K` / `keywordprg`, `:hardcopy`. No shell.
- **Real filesystem** (`:e file`, `:r file`, `gf`). Browser sandbox; partial coverage via the existing buffers system is enough.
- **Completion frameworks** (`Ctrl-X Ctrl-*` family). Needs dictionaries / tags / etc.
- **Differential testing infrastructure** (headless nvim oracle). Useful in theory; not worth the budget for this product's goals.
- **Backend / accounts / collaboration.** Rails/Hetzner/Kamal explored and dropped for vi.html proper.
- **Sharing features** (URL-fragment encoding, share-by-link). Irrelevant for the solo-use case.
- **`formatoptions` flags.** Already documented as a known omission.

## Feature Inventory

Each feature below gets its own plan when it's time to build. Order is a recommendation, not a contract — the user picks the next one based on what they actually want.

### Sprint 1 — Quick wins, prove the rhythm

1. **Auto-continue lists** — Enter on `- foo` produces `- ` on the next line; `1.` becomes `2.`; preserves indent; Enter on empty marker terminates the list. Plan: `2026-04-19-list-continuation.md`.
2. **Word count + reading time** — small status-bar indicator (one number, ~200 wpm reading-time estimate).

### Sprint 2 — Foundational

3. **Theme: the "Her" treatment** — warm cream/espresso palette, McFetridge sensibility. One opinionated theme, plus a same-aesthetic dark variant for late-night work. Will likely warrant a `-design.md` companion before the implementation plan.
4. **Word-paste fidelity audit** — diagnostic pass: build representative test docs (headings, lists, tables, blockquotes, code spans, emphasis, curly quotes), paste into Word, fix anything ugly. May produce an explicit "Copy as Word-friendly HTML" command if helpful.

### Sprint 3 — Long-doc tools

5. **Outline / TOC pane** — `:TOC` or `gO` opens a navigable list of headings. Critical for 30-page docs.
6. **Focus / typewriter mode** — dim non-active paragraphs; center current line. Toggle via `:focus` or similar.
7. **Scroll-synced live preview** — editor and preview track each other while scrolling.

### Sprint 4 — Vim power

8. **Macros** (`q`/`@`/`@@`) — record and replay key sequences. Vim's killer feature for repetitive edits.
9. **`:g`/`:v` global command** — run an Ex command on every line matching/not-matching a pattern. Examples: `:g/TODO/d`, `:v/^#/d`.

### Sprint 5 — Backlog

10. **Smart renumbering** — delete an item from `1. 2. 3.`, the rest renumber.
11. **Autosave / persistence audit** — review localStorage save cadence, TTL, and whether to add an undo-across-reload snapshot ring.

### Stretch — Markdown extras

12. **GFM tables** — table editing helpers (auto-format, alignment, navigation).
13. **Footnotes** — `[^1]` syntax in marked + smart insert helper.

## Someday-Maybe (Parking Lot)

These were filed for later, mostly because they belong to the *recipe editor* sister project, not vi.html proper.

- **`cooleditor-rails` gem** — Stimulus controller wrapping the built bundle, importmap entry, configurable options. **Trigger:** after porting the vim layer into the recipe editor reveals real integration friction. **Anti-goal:** generalizing before we know what the API surface wants to be.
- **Cooleditor.com platform with accounts** (Rails 8 on Hetzner via Kamal): server-side document storage, share-by-shortcode, collaborative editing (CRDT), server-side PDF export, GitHub OAuth. **Trigger:** a specific feature on the inventory above that genuinely cannot be done client-side. **Guardrail:** the single-file `vi.html` stays the flagship artifact; the platform is additive, never replaces it.

## Process

For each feature:

1. Pick from the inventory.
2. Write a detailed implementation plan: `docs/plans/YYYY-MM-DD-<feature-name>.md`. Use the `superpowers:writing-plans` skill.
3. Commit the plan on a feature branch.
4. Execute via `superpowers:subagent-driven-development` (per `~/CLAUDE.md`: skip the "subagent vs inline?" prompt and proceed directly with subagent-driven).
5. Verification gate: `npm run check` clean + interactive browser test passes.
6. Open the PR via `gh pr create` (standing permission per `~/CLAUDE.md` once the verification gate passes).
7. After merge, update this roadmap to mark the feature shipped.
