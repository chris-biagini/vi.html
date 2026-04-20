# Vim Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a single audit report covering all 13 files in `src/vim/` with keep/slim/delete verdicts, file follow-up GH issues for each delete/slim verdict, and close #26. No code is deleted or modified in this session.

**Architecture:** Seven parallel Opus subagents perform independent file-by-file audits. Their findings are aggregated into one committed audit report (`docs/plans/2026-04-19-vim-audit.md`). Each delete/slim verdict spawns a follow-up GH issue. The PR is merge-closes #26.

**Tech Stack:** `@replit/codemirror-vim` (bundled at `node_modules/@replit/codemirror-vim/dist/index.js`, ~8,774 lines) + CodeMirror 6 packages (`@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@codemirror/lang-markdown`). Empirical verification via the `?test` harness documented in `CLAUDE.md`.

**Spec:** `docs/plans/2026-04-19-vim-audit-design.md` (committed on this branch at `ceaabe9`).

**Branch:** `feature/vim-audit-26` (already created).

---

## File Structure

No source files are created, modified, or deleted in this session. The audit is strictly diagnostic. Artifacts this plan produces:

- **Create:** `docs/plans/2026-04-19-vim-audit.md` — the audit report (committed, reviewed, merged with the PR).
- **Modify:** `~/.claude/projects/-home-claude-vi-html/memory/cm6_native_coverage.md` — new native-behavior confirmations (not committed; lives outside the repo).
- **Create:** one GH issue per delete/slim verdict (zero or more, depending on findings).
- **Create:** one GH PR that merge-closes #26 via `Resolves #26`.

No changes to `src/`, `package.json`, `build.js`, or tests. If a subagent proposes removing code, that proposal becomes an issue, not a change in this PR.

---

## Task 1: Pre-flight — capture file inventory and confirm bundle location

**Files:**
- Read-only: `src/vim/*.js`, `node_modules/@replit/codemirror-vim/dist/index.js`

- [ ] **Step 1: List `src/vim/` with line counts**

Run:

```bash
wc -l src/vim/*.js | sort -n
```

Expected: 13 `.js` files (excluding `*.test.js`), ranging from ~12 lines (`mappings.js`) to ~184 lines (`buffers.js`).

- [ ] **Step 2: Verify the upstream bundle exists and confirm its size**

Run:

```bash
wc -l node_modules/@replit/codemirror-vim/dist/index.js
```

Expected: ~8,774 lines. If the file is missing, run `npm install` before proceeding — the audit depends on grepping this bundle.

- [ ] **Step 3: Record the file inventory for use in subagent briefs**

Paste the `wc -l` output from Step 1 into a scratch note (kept in this task's TaskOutput) so subsequent audit subagents can reference accurate LoC figures. No file is written here — the output is referenced by later tasks via the task list.

- [ ] **Step 4: No commit** — this task is a read-only inventory.

---

## Tasks 2–8: Parallel audit subagents

> **Dispatch policy:** Tasks 2 through 8 are independent and MUST be dispatched in parallel as Opus subagents (per `~/.interslice-common/subagents.md`). They do not modify any files — each returns a verdict plus evidence in its task output. Do not wait for one to finish before dispatching the next.

Each subagent receives the same **brief template** below, with the `{{FILE}}`, `{{HYPOTHESIS}}`, and any paired-file notes filled in per task.

### Subagent brief template

> You are performing a narrow, one-file (or paired-file) audit of the vi.html project's custom vim code against the upstream `@replit/codemirror-vim` bundle and CodeMirror 6 packages.
>
> **The repo root is `/home/claude/vi.html`. Work only within that directory.** Do not modify any files in `src/`, `node_modules/`, `docs/`, `tests/`, or elsewhere — this is a read-only audit. Do not run `npm install`, `git commit`, `git push`, or any destructive command.
>
> **File(s) under audit:** `{{FILE}}`
>
> **Hypothesis to test:** {{HYPOTHESIS}}
>
> **Method (in this order):**
>
> 1. **Read the target file(s).** Know what each function does and what it touches.
> 2. **Grep the upstream bundle** at `node_modules/@replit/codemirror-vim/dist/index.js` (~8,774 lines) for identifiers relevant to the hypothesis — operator names, option names, registers, `defineOption` calls, `defineOperator` calls, etc. When you find matches, **read the surrounding implementation** — a symbol match isn't a behavior match.
> 3. **Check CM6 packages** in `node_modules/@codemirror/`: `view`, `state`, `language`, `lang-markdown`. Focus on extension/option declarations and markdown-specific helpers relevant to the hypothesis.
> 4. **Only if grep evidence is ambiguous:** run an empirical check via the `?test` harness. Usage notes are in `/home/claude/vi.html/CLAUDE.md` under "Browser Testing (Playwright)". You may `npm run build` and serve locally with `python3 -m http.server 9876 --bind 0.0.0.0`, then navigate Playwright to `http://rika:9876/vi.html?test`. **Do not modify any file to run this test** — if you need to bypass a custom handler to verify upstream alone, describe what you would change rather than actually changing it, unless you can do so in a way that reverts cleanly before returning.
>
> **Required output shape.** Return exactly this structure:
>
> ```markdown
> ## Audit: `{{FILE}}`
>
> **LoC (non-test):** [number]
> **Hypothesis tested:** {{HYPOTHESIS}}
>
> **Verdict:** [keep | slim | delete]
>
> **Justification** (≤3 sentences):
> [Cite specific bundle line numbers (e.g., "see `defineOption('textwidth', ...)` at bundle line 4521") OR cite a harness scenario transcript. A symbol match alone is not acceptable — you must have read the upstream implementation or verified behavior empirically.]
>
> **Evidence:**
> - [bundle line refs or harness transcript]
> - [CM6 package refs if relevant]
>
> **Proposed next step:**
> [If keep: "No follow-up. Justification above is the record."
>  If slim: "Open issue: '<short title>'. Scope: <concrete what-to-remove-or-simplify>, leaving <what-stays> because <reason>."
>  If delete: "Open issue: '<short title>'. Scope: remove the file (and its test, if any), update `src/vim/index.js` to drop the import."]
>
> **Risks / caveats I couldn't resolve:**
> [Anything the main session should double-check before filing the follow-up, or "none".]
> ```
>
> **If you cannot find upstream coverage:** return `Verdict: keep` with the justification being whatever you *did* look for and not find. "Couldn't find X in the bundle" is a valid finding — don't manufacture a delete/slim verdict to feel productive.
>
> Keep your report under 400 words. Cite precise bundle line numbers, not paraphrases.

### Task 2: Audit `gq.js`

**Files:**
- Read: `src/vim/gq.js`, `src/vim/gq.test.js` (for context on behavior), `node_modules/@replit/codemirror-vim/dist/index.js`

- [ ] **Step 1: Dispatch Opus subagent with the brief template**, filling in:
  - `{{FILE}}`: `src/vim/gq.js`
  - `{{HYPOTHESIS}}`: "Upstream `@replit/codemirror-vim` exposes a `hardWrap` operator or paragraph-reflow primitive that could replace our custom gq/gw handler. The codemirror-vim README shows a `hardWrap` extension hook — check whether the bundle now ships the actual operator."

- [ ] **Step 2: Verify the subagent returned the required output shape.** The report must contain the `Verdict:`, `Justification:`, `Evidence:`, and `Proposed next step:` fields. If any is missing or the justification is a bare symbol match (no line numbers, no implementation reading, no harness transcript), bounce it back.

- [ ] **Step 3: Save the subagent's report verbatim as the row for `gq.js`** in the eventual audit report (aggregated in Task 9). No commit at this step.

### Task 3: Audit `options.js` + `textwidth.js` (paired)

**Files:**
- Read: `src/vim/options.js`, `src/vim/textwidth.js`, `src/vim/textwidth.test.js`, `node_modules/@replit/codemirror-vim/dist/index.js`

- [ ] **Step 1: Dispatch Opus subagent with the brief template**, filling in:
  - `{{FILE}}`: `src/vim/options.js` AND `src/vim/textwidth.js` (paired audit — one subagent, both files)
  - `{{HYPOTHESIS}}`: "(a) Upstream plumbs `number`, `relativenumber`, `textwidth`, `tabstop`, `shiftwidth`, `expandtab`, and similar options already — our `Vim.defineOption` calls in `options.js` may duplicate upstream-native ones. (b) For `textwidth` specifically, the upstream may also wrap on insert (not just store the value), making `textwidth.js`'s wrap handler redundant. Reconcile findings across both files — if upstream handles `textwidth` end-to-end, both files may shrink together."

- [ ] **Step 2: Verify the subagent returned the required output shape for BOTH files**, either as two sections or one merged section — the subagent decides based on its findings. If one file's verdict contradicts the other's in a way that doesn't reconcile in the justification, bounce it back.

- [ ] **Step 3: Save the subagent's report verbatim.** No commit.

### Task 4: Audit `clipboard.js`

**Files:**
- Read: `src/vim/clipboard.js` (23 lines), `src/vim/clipboard.test.js`, `node_modules/@replit/codemirror-vim/dist/index.js`

- [ ] **Step 1: Dispatch Opus subagent with the brief template**, filling in:
  - `{{FILE}}`: `src/vim/clipboard.js`
  - `{{HYPOTHESIS}}`: "`@replit/codemirror-vim` now routes the `\"*` register to the OS clipboard without our shim. Our file was added at commit `a15cf4d`. Check whether the bundle's register-handling code aliases `*` to `+` or to the system clipboard natively now."

- [ ] **Step 2: Verify the subagent's report has a bundle line number** for the register-handling code (not just a grep for `"*"`).

- [ ] **Step 3: Save the subagent's report verbatim.** No commit.

### Task 5: Audit `fold.js`

**Files:**
- Read: `src/vim/fold.js`, `node_modules/@codemirror/language/`, `node_modules/@codemirror/lang-markdown/`, `node_modules/@replit/codemirror-vim/dist/index.js`

- [ ] **Step 1: Dispatch Opus subagent with the brief template**, filling in:
  - `{{FILE}}`: `src/vim/fold.js`
  - `{{HYPOTHESIS}}`: "`@codemirror/language` + `@codemirror/lang-markdown` already detect heading fold ranges. Our custom heading-fold implementation may duplicate an upstream `foldInside`/`foldNodeProp` hook. Also check whether `@replit/codemirror-vim` wires `zo`/`zc`/`za`/`zR`/`zM` to CM6's fold service."

- [ ] **Step 2: Verify the subagent's report distinguishes between** (a) "upstream detects fold ranges" and (b) "upstream wires vim fold commands to those ranges" — both must be true for a `delete` verdict.

- [ ] **Step 3: Save the subagent's report verbatim.** No commit.

### Task 6: Audit `arrow-clamp.js`

**Files:**
- Read: `src/vim/arrow-clamp.js` (29 lines), `node_modules/@codemirror/view/`, `node_modules/@replit/codemirror-vim/dist/index.js`

- [ ] **Step 1: Dispatch Opus subagent with the brief template**, filling in:
  - `{{FILE}}`: `src/vim/arrow-clamp.js`
  - `{{HYPOTHESIS}}`: "A CM6 option or extension stops arrow keys from wrapping across line boundaries in insert mode. Issue #26 flagged this as low-probability but cheap to check. Also check whether `@replit/codemirror-vim` itself clamps cursor-via-arrow during insert."

- [ ] **Step 2: Verify the subagent actually checked both CM6 (view-level) and the vim bundle** — not just one or the other.

- [ ] **Step 3: Save the subagent's report verbatim.** No commit.

### Task 7: Audit `highlight.js`

**Files:**
- Read: `src/vim/highlight.js`, `src/vim/highlight.test.js`, `node_modules/@codemirror/lang-markdown/`, `node_modules/@codemirror/language/`

- [ ] **Step 1: Dispatch Opus subagent with the brief template**, filling in:
  - `{{FILE}}`: `src/vim/highlight.js`
  - `{{HYPOTHESIS}}`: "`highlight.js` adds markdown syntax-highlighting tweaks. Some or all of these may duplicate what `@codemirror/lang-markdown` default styles (`markdownLanguage.extension`, `HighlightStyle` from `@codemirror/language`) already cover. A `delete` verdict requires that every token class in `highlight.js` is already styled by default upstream."

- [ ] **Step 2: Verify the subagent enumerated each token rule in `highlight.js`** and matched each against upstream styles — a blanket "upstream has a highlight style" isn't enough.

- [ ] **Step 3: Save the subagent's report verbatim.** No commit.

### Task 8: Quick-skim batch — `abbreviations.js`, `buffers.js`, `commands.js`, `exrc.js`, `mappings.js`, `tilde.js`

**Files:**
- Read: all six target files above, plus `node_modules/@replit/codemirror-vim/dist/index.js`

- [ ] **Step 1: Dispatch Opus subagent with a modified brief.** Use the template above, but override the "required output shape" to allow one short section per file (4 sentences max each). The hypothesis is:
  - `{{FILE}}`: the six files listed above
  - `{{HYPOTHESIS}}`: "These files are hypothesized to address browser/app concerns that `@replit/codemirror-vim` has no reason to handle: abbreviation expansion (vim abstractly defines `:ab` but implementation matters), multi-buffer management in localStorage, custom `:` Ex commands for this app (`:preview`, `:help`, `:write`), persistent exrc via localStorage, a couple of custom key mappings, and a visual-only tilde-gutter. Confirm each is genuinely our-domain — or flag any surprises (e.g., if `@replit/codemirror-vim` already implements `:ab`/`:una`/`:abc` fully, abbreviations.js might shrink)."

- [ ] **Step 2: Require each of the six files to have its own one-liner verdict row** in the subagent's output. If any is missing, bounce it back.

- [ ] **Step 3: Save the subagent's report verbatim.** No commit.

---

## Task 9: Aggregate findings into the audit report

**Files:**
- Create: `docs/plans/2026-04-19-vim-audit.md`

- [ ] **Step 1: Collect the task outputs from Tasks 2–8** (seven subagent reports covering 13 files total).

- [ ] **Step 2: Write the audit report** at `docs/plans/2026-04-19-vim-audit.md` with this structure:

```markdown
# Systematic audit of `src/vim/` — findings

**Issue:** [#26](https://github.com/chris-biagini/vi.html/issues/26)
**Design spec:** `docs/plans/2026-04-19-vim-audit-design.md`
**Date:** 2026-04-19
**Branch:** `feature/vim-audit-26`

## Method

[3-5 sentences recapping: 7 parallel Opus subagents, grep the upstream bundle,
check CM6 packages, harness verification where ambiguous. Link to design spec
for full rationale.]

## Verdict table

| File | LoC | Verdict | Justification (1 sentence) | Follow-up |
|---|---:|---|---|---|
| `gq.js` | ... | keep/slim/delete | ... | #NNN or N/A |
| ... | ... | ... | ... | ... |

(13 rows — one per file. `options.js` and `textwidth.js` are separate rows
even though audited together. Follow-up column is filled in during Task 10.)

## Per-file findings

[For each file, paste the subagent's full returned report verbatim. Use
`### ` headings. Order: priority suspects first (gq, options, textwidth,
clipboard, fold, arrow-clamp, highlight), then quick-skim batch.]

## Follow-ups filed

[Populated during Task 10. Each row: issue #, title, affected file(s), verdict type.]

## Memory updates

[Populated during Task 11. Each row: what was added to
~/.claude/projects/-home-claude-vi-html/memory/cm6_native_coverage.md, why.]

## Closeout

Every file in `src/vim/` has a verdict. Every delete/slim verdict has a
follow-up issue. This report ships as a PR that `Resolves #26`.
```

- [ ] **Step 3: Verify every file in `src/vim/` (excluding `*.test.js` and `index.js`) appears as a row in the verdict table.** Count: 13 source files. If any is missing, the audit isn't done.

- [ ] **Step 4: No commit yet** — the report gets committed in Task 12 alongside the follow-up references. This keeps the PR's single commit readable.

---

## Task 10: File GitHub issues for delete/slim verdicts

**Files:** None. This task creates GH issues only.

- [ ] **Step 1: For each row in the verdict table with verdict `delete` or `slim`**, file a GH issue with:

```bash
gh issue create \
  --title "<short, actionable title — e.g., 'Remove gq.js: upstream hardWrap operator covers it'>" \
  --body "$(cat <<'EOF'
**Verdict from [#26](https://github.com/chris-biagini/vi.html/issues/26) audit:** [delete | slim]

**File(s):** `src/vim/<file>.js` (and `src/vim/<file>.test.js` if present)

**Justification from audit report** (`docs/plans/2026-04-19-vim-audit.md`):

> [paste the subagent's justification sentence]

**Evidence:** [paste bundle line refs or harness transcript]

**Proposed scope:** [paste subagent's "Proposed next step"]

**Risks / caveats:** [paste from subagent report, or "none"]

**Method for the follow-up PR:**
1. Branch `feature/remove-<file>`.
2. Delete (or slim) `src/vim/<file>.js` and its test.
3. Remove the export from `src/vim/index.js`.
4. Run `npm run check` and `npm run build` — must pass.
5. Interactive browser test via `?test` harness — the behavior must still work (upstream now covers it).
6. Open PR `Resolves #NNN`.
EOF
)"
```

- [ ] **Step 2: Record the returned issue number** in the "Follow-up" column of the verdict table in `docs/plans/2026-04-19-vim-audit.md` (in memory — the file hasn't been committed yet; edit in place).

- [ ] **Step 3: Populate the "Follow-ups filed" section** of the audit report with one row per filed issue: `#NNN — <title> — <file> — <verdict type>`.

- [ ] **Step 4: If there are zero delete/slim verdicts**, write a single sentence under "Follow-ups filed" stating so: "No delete or slim verdicts. Every file in `src/vim/` is keeping its current shape; the justifications above are the record." This is a valid audit outcome.

- [ ] **Step 5: No commit** — Task 12 commits everything together.

---

## Task 11: Apply memory updates

**Files:**
- Modify: `~/.claude/projects/-home-claude-vi-html/memory/cm6_native_coverage.md`

- [ ] **Step 1: Read the current memory file** to know its existing shape:

```bash
cat ~/.claude/projects/-home-claude-vi-html/memory/cm6_native_coverage.md
```

- [ ] **Step 2: For each audit that confirmed a new native-upstream behavior** (typically delete/slim verdicts, but "keep with surprising find" also qualifies), add a concise bullet to the memory file. Match the existing memory's tone and structure — do not rewrite the file.

- [ ] **Step 3: In the audit report's "Memory updates" section**, record each bullet that was added, with a one-sentence reason. This is the committed trace — the memory file itself isn't part of the PR.

- [ ] **Step 4: If no new native coverage was confirmed**, write "No additions. The audit either confirmed our-domain status or found gaps where upstream doesn't cover the need." under "Memory updates".

- [ ] **Step 5: No commit to the repo** — the memory file lives outside the repo and is updated directly.

---

## Task 12: Commit the audit report, push branch, open PR

**Files:**
- Commit: `docs/plans/2026-04-19-vim-audit.md`

- [ ] **Step 1: Verify the audit report is complete** — all 13 rows, all justifications filled, follow-up issue numbers populated (or the "no follow-ups" sentence), memory-updates section filled, closeout paragraph present.

- [ ] **Step 2: Run the repo's pre-push check as a sanity pass** (the audit doesn't change code, so this should pass trivially — but confirms we haven't accidentally touched anything):

```bash
cd /home/claude/vi.html && npm run check
```

Expected: lint clean, tests pass (no test files were modified).

- [ ] **Step 3: Stage and commit the audit report**:

```bash
cd /home/claude/vi.html && git add docs/plans/2026-04-19-vim-audit.md && git commit -m "$(cat <<'EOF'
docs: systematic audit of src/vim/ against upstream

Seven parallel subagents audited all 13 files in src/vim/ against
@replit/codemirror-vim and CM6 packages. [N] delete verdicts,
[M] slim verdicts, [K] keep verdicts. Follow-up issues filed per
delete/slim verdict. No code changed in this PR.

Resolves #26

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Fill in [N], [M], [K] with the actual counts from the verdict table before running.

- [ ] **Step 4: Push the branch**:

```bash
cd /home/claude/vi.html && git push -u origin feature/vim-audit-26
```

- [ ] **Step 5: Open the PR**:

```bash
cd /home/claude/vi.html && gh pr create --title "Systematic audit of src/vim/ against upstream" --body "$(cat <<'EOF'
## Summary
- Seven parallel subagents audited all 13 files in `src/vim/` against `@replit/codemirror-vim` and CodeMirror 6 packages.
- Verdicts: [N] delete, [M] slim, [K] keep — full table in `docs/plans/2026-04-19-vim-audit.md`.
- [L] follow-up issues filed for delete/slim verdicts. No code changed in this PR.

## Test plan
- [ ] Verdict table has a row for every file in `src/vim/` (13 total, `*.test.js` and `index.js` excluded).
- [ ] Each delete/slim verdict's justification cites a specific bundle line number or a harness transcript — not just a symbol match.
- [ ] Each delete/slim verdict has a filed GH issue referenced in the "Follow-up" column.
- [ ] `npm run check` passes on this branch (no code touched — should be trivially green).

Resolves #26

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Fill in [N], [M], [K], [L] to match reality before running.

- [ ] **Step 6: Report the PR URL back to the user.** Do not merge — the user merges after review. Do not close #26 manually — the `Resolves #26` in the commit body closes it when the PR merges.

---

## Self-review notes

- **Spec coverage:** every item in the design spec's "Deliverable" section is covered: context (Task 9 step 2), method recap (Task 9 step 2), verdict table (Tasks 2–9), follow-ups (Task 10), memory updates (Task 11). Every item in the design spec's "Scope" (13 files) is covered: Tasks 2–7 cover 8 files, Task 8 covers 6 files — total 14, but `options.js` + `textwidth.js` are paired in Task 3, so 13 unique files. ✓
- **No placeholders:** every step contains the actual command, brief template, or expected content. The `[N]`, `[M]`, `[K]`, `[L]` in Task 12 are intentional fill-in markers that the executor sets from the verdict table — they are not TBD/TODO.
- **Type consistency:** no types or methods are defined in this plan (pure research task). The only "interface" is the subagent brief output shape in Tasks 2–8, and every task references the same template.
- **Branch state:** plan assumes execution starts on `feature/vim-audit-26` with the design spec committed at `ceaabe9`. If the branch state differs, Task 1 will surface it via `wc -l`.
