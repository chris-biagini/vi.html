# Systematic audit of `src/vim/` against upstream — design

**Issue:** [#26](https://github.com/chris-biagini/vi.html/issues/26)
**Branch:** `feature/vim-audit-26`
**Status:** design — awaiting user review before writing the implementation plan

## Context

Prior audits of custom vim code against upstream have been reactive — triggered by specific feature plans. Each one found something:

- **List continuation (#12):** built a custom handler, then discovered CM6 + `@codemirror/lang-markdown` already did it natively. Reverted the feature, kept the docs. This audit was the source of the `cm6_native_coverage` memory and the "verify native CM6 behavior *before* planning" rule in `CLAUDE.md`.
- **Macros + `:g`/`:v` (#19, #20):** both fully supported upstream. Closed as docs-only.
- **Spellcheck:** `:set spell` replaced with the browser `spellcheck` attribute.

The hit rate — three-for-three — suggests there is real, unreviewed code in `src/vim/` that upstream now covers. This spec describes a systematic, file-by-file pass.

## Goal

Every file in `src/vim/` gets a verdict — **keep**, **slim**, or **delete** — with a one-sentence justification citing either an upstream line reference or a harness test. Deletions and slimming land as separate follow-up PRs in future sessions. This session ships only the audit report and the follow-up issues.

## Scope

All 13 files in `src/vim/`:

| File | LoC | Tier |
|---|---:|---|
| `gq.js` | 144 | priority suspect |
| `options.js` | 79 | priority suspect |
| `textwidth.js` | 50 | priority suspect |
| `fold.js` | 73 | priority suspect |
| `clipboard.js` | 23 | priority suspect |
| `arrow-clamp.js` | 29 | priority suspect |
| `highlight.js` | 57 | priority suspect |
| `abbreviations.js` | 127 | quick-skim |
| `buffers.js` | 184 | quick-skim |
| `commands.js` | 108 | quick-skim |
| `exrc.js` | 92 | quick-skim |
| `mappings.js` | 12 | quick-skim |
| `tilde.js` | 101 | quick-skim |

(LoC from issue #26 where cited; approximate otherwise — the subagents will use real line counts.)

## Method

Per `CLAUDE.md` "verify native CM6 behavior *before* planning":

1. **Grep the upstream bundle:** `node_modules/@replit/codemirror-vim/dist/index.js` (~8,774 lines). Look for operator names, option names, registers, or other identifiers relevant to the file under audit.
2. **Check CM6 packages:** `@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@codemirror/lang-markdown`.
3. **Empirical verification via `?test` harness** when the hypothesis is ambiguous: strip (or bypass) the custom handler and drive the target scenario through `window.__vi`; observe whether upstream behavior alone covers the need. Harness usage notes are in `CLAUDE.md` → "Browser Testing (Playwright)".

## Execution — parallel Opus subagents

Seven subagents, dispatched in parallel. Each gets: the file(s) to audit, the stated hypothesis, path to the upstream bundle, harness quirks from `CLAUDE.md`, and a required output shape (verdict + justification + citations + proposed next step).

| # | File(s) | Hypothesis to test |
|---|---|---|
| 1 | `gq.js` | Upstream exposes a `hardWrap` operator or paragraph-reflow primitive that could replace our gq/gw handler. |
| 2 | `options.js` + `textwidth.js` (paired) | Upstream already plumbs `number`, `relativenumber`, `textwidth`; for `textwidth`, upstream may also wrap on insert, making our handler redundant. Paired because findings in one reframe the other. |
| 3 | `clipboard.js` | `@replit/codemirror-vim` now routes `"*` to the OS clipboard without our shim. |
| 4 | `fold.js` | `@codemirror/language` + `@codemirror/lang-markdown` already detect heading fold ranges; our custom folding may duplicate them. |
| 5 | `arrow-clamp.js` | A CM6 option or extension stops arrow keys from wrapping lines in insert mode. |
| 6 | `highlight.js` | The tweaks duplicate what `@codemirror/lang-markdown` default styles already cover. |
| 7 | Quick-skim batch: `abbreviations.js`, `buffers.js`, `commands.js`, `exrc.js`, `mappings.js`, `tilde.js` | Confirm these address browser/app concerns upstream has no reason to handle; flag any surprises for deeper review. |

## Deliverable

A single committed document, `docs/plans/2026-04-19-vim-audit.md`, containing:

1. **Context** — link to #26, why we audited, date.
2. **Method** — recap of the grep-plus-harness approach.
3. **Verdict table** — one row per file:
   - file path, LoC, hypothesis tested
   - verdict: **keep** / **slim** / **delete**
   - justification: one sentence citing either a bundle line reference or a harness scenario
   - follow-up: issue # / PR # / N/A
4. **Summary of follow-ups filed** — the issue numbers this audit spun off.
5. **Memory updates** — a list of edits to apply to `~/.claude/projects/-home-claude-vi-html/memory/cm6_native_coverage.md`. The memory file itself is updated directly (it lives outside the repo); the list in the report records what changed and why.

## Follow-up policy

- **Delete** verdict → open a GitHub issue with the subagent's findings attached. Do not open a PR in this session.
- **Slim** verdict → same.
- **Keep** verdict → no follow-up needed. Justification in the audit table is the record.

Closing #26 when the audit report is merged is the done-criteria gate — every file has a verdict; every delete/slim verdict has a follow-up issue.

## Out of scope

- Actually deleting or slimming code. Each of those is its own branch, its own PR, its own session.
- Non-vim files (`main.js`, `preview.js`, etc.). Issue #26 is explicit about this.
- Modernization-for-its-own-sake. Only delete or slim where upstream genuinely covers the need.

## Risks and mitigations

- **Risk:** a subagent returns an over-confident "delete" verdict based on a grep match that isn't really the same behavior. **Mitigation:** require the subagent's justification to either cite the upstream *implementation* (not just a symbol match) or cite a harness scenario proving the behavior. The reviewer (and me, when aggregating) can sanity-check the citation.
- **Risk:** a paired audit (options + textwidth) produces findings that conflict. **Mitigation:** the paired subagent owns both files and must reconcile in its own report; the main session doesn't need to.
- **Risk:** the audit misses a file because of a grouping error. **Mitigation:** the verdict table in the report must list *all* 13 files; if any row is missing, the audit isn't done.

## References

- Issue: https://github.com/chris-biagini/vi.html/issues/26
- List-continuation audit (the exemplar): commit `9bee602`, `docs/plans/2026-04-19-list-continuation.md`
- Upstream bundle: `node_modules/@replit/codemirror-vim/dist/index.js`
- Memory: `~/.claude/projects/-home-claude-vi-html/memory/cm6_native_coverage.md`
- `CLAUDE.md` → "Architectural Commitments" → "Verify native CM6 behavior *before* planning."
- `CLAUDE.md` → "Browser Testing (Playwright)" for `?test` harness usage.
