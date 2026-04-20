# gq/gw Upstream Parity Evaluation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** [#27](https://github.com/chris-biagini/vi.html/issues/27)
**Branch:** `feature/gq-upstream-parity-27`
**Date:** 2026-04-19

**Goal:** Empirically compare our `src/vim/gq.js` operator against upstream `@replit/codemirror-vim`'s built-in `hardWrap`, then delete / slim / close based on observed divergence.

**Architecture:** Vitest + jsdom test harness that drives a *real* CM6 + vim editor with our `gq.js` registration bypassed, so `gq`/`gw` resolve to upstream. For each of the eight scenarios called out in the issue, capture upstream's output and compare against the output our `reflowRange` produces for the same input. Record both outputs in a parity report appended to this doc. The decision — delete, slim, or close verified-negative — is driven mechanically by that table.

**Tech Stack:** Vitest (jsdom environment), `@codemirror/view`, `@codemirror/state`, `@replit/codemirror-vim`. No new dependencies.

---

## Non-goals / explicitly out of scope

- Changing behavior of `textwidth.js` (insert-mode auto-wrap) — that file is orthogonal and already verdicted `keep` by audit #26.
- Fixing `options.js`'s `textwidth` registration — tracked separately by [#28](https://github.com/chris-biagini/vi.html/issues/28).
- Changing `gq` semantics. We are comparing existing behavior against upstream existing behavior; any divergence drives the keep/slim/delete decision, not a new feature.

## Prior art consulted

- `docs/plans/2026-04-19-vim-audit.md` — the gq/options audit entries (`src/vim/gq.js (slim)`) — line-by-line upstream algorithm vs our paragraph-join rationale.
- `node_modules/@replit/codemirror-vim/dist/index.js`:
  - `189–190` — default keymap entries for `gq` / `gw`
  - `2859–2867` — `hardWrap` operator definition (gates on `cm.hardWrap`, calls it, returns `new Pos(endRow, 0)` or `oldAnchor`)
  - `7841–7843` — `hardWrap(options)` method on the `CodeMirror5` compat class (just delegates to the pure function)
  - `8096–8131` — pure `hardWrap(cm, options)` function, reading `cm.getOption('textwidth')`, calling `cm.replaceRange` in-line
  - `8132–8169` — `findSpace(line, max, min)` — regex-driven break-point finder
- `src/vim/gq.js` — our paragraph-join-then-wrap operator + `Vim.mapCommand('gq'|'gw', ...)` overrides that shadow upstream

## File structure

- **Create:** `src/vim/gq-parity.test.js` — jsdom-backed parity harness. Test file is disposable — it lives only long enough to produce the report in this plan; either kept as a regression guard if we slim, or deleted with the rest of `gq.js` if parity is full.
- **Modify:** `docs/plans/2026-04-19-gq-upstream-parity.md` (this file) — append the parity report table under **Parity Report** once Task 3 runs.
- **Eventually modify** (Task 5, based on decision):
  - If **delete**: remove `src/vim/gq.js`, `src/vim/gq.test.js`, the `registerGqOperator` export from `src/vim/index.js`, and the `registerGqOperator(state)` call in `src/main.js:476`.
  - If **slim**: remove only lines 112 and 143 of `src/vim/gq.js` (the `Vim.mapCommand('gq'|'gw', ...)` calls). Keep `defineOperator` so our operator stays the default, but drop the redundant explicit keymap.
  - If **close verified-negative**: no code changes; update `src/vim/gq.js` header comment to cite this report; close #27 with the parity report as justification.

## Testing strategy

Existing `src/vim/gq.test.js` is a pure-unit test with a tiny mockCm. That stays unchanged.

The new `gq-parity.test.js` is NOT a pure-unit test — it instantiates a real CM6 `EditorView` under jsdom so we can call upstream's real `cm.hardWrap({from, to})` without re-implementing it. This is the single cheapest way to get *authoritative* upstream output without either (a) a browser harness or (b) copy-pasting the bundle function into our repo.

For each scenario we assert **two** things:
1. Upstream's observed output (snapshot — what upstream actually produced today).
2. Divergence class (EQUAL / DIFFER, string compare against our `reflowRange` output on the same input).

The test does not dictate a correct answer for upstream — it documents what upstream does. The decision rule (Task 4) lives in this doc, not in test assertions.

---

## Task 1: Write the failing parity harness skeleton (RED)

**Files:**
- Create: `src/vim/gq-parity.test.js`

- [ ] **Step 1: Scaffold the jsdom test file**

Pseudo-code (actual file content uses real JS):

```
// @vitest-environment jsdom
//
// gq/gw upstream parity — issue #27
//
// Compares upstream @replit/codemirror-vim hardWrap against our
// reflowRange on the scenarios in issue #27. This file documents
// behavior; it does not enforce correctness. Each scenario snapshots
// the output of BOTH implementations, and the plan doc records the
// verdict.

import { describe, test, expect } from 'vitest';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { vim, getCM, Vim } from '@replit/codemirror-vim';
import { reflowRange } from './gq.js';

function makeUpstreamEditor(doc, textwidth) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [vim()] }),
    parent: host,
  });
  const cm = getCM(view);
  Vim.setOption('textwidth', textwidth, cm);
  return { view, cm };
}

function runUpstream(input, textwidth, fromLine, toLine) {
  const { view, cm } = makeUpstreamEditor(input, textwidth);
  cm.hardWrap({ from: fromLine, to: toLine });
  const out = view.state.doc.toString();
  view.destroy();
  return out;
}

function runOurs(input, textwidth, fromLine, toLine) {
  const lines = input.split('\n');
  const state = [...lines];
  const mockCm = {
    getLine(n) { return state[n]; },
    replaceRange(text, from, to) {
      const before = state.slice(0, from.line);
      const after = state.slice(to.line + 1);
      const newLines = text.split('\n');
      state.length = 0;
      state.push(...before, ...newLines, ...after);
    },
  };
  reflowRange(mockCm, fromLine, toLine, textwidth);
  return state.join('\n');
}
```

- [ ] **Step 2: Add one smoke scenario that MUST pass before we trust the harness**

```
describe('gq-parity harness smoke', () => {
  test('short single line is a no-op in both implementations', () => {
    const input = 'short line';
    const tw = 80;
    expect(runUpstream(input, tw, 0, 0)).toBe('short line');
    expect(runOurs(input, tw, 0, 0)).toBe('short line');
  });
});
```

- [ ] **Step 3: Run the test — expect smoke to pass**

Run: `npm test -- gq-parity`
Expected: 1 test passing. If this fails, the harness itself is broken — fix it before moving on.

- [ ] **Step 4: Commit the harness**

```
git add src/vim/gq-parity.test.js
git commit -m "test: add gq parity test harness scaffolding (#27)"
```

---

## Task 2: Add parity scenarios

**Files:**
- Modify: `src/vim/gq-parity.test.js`

Each scenario runs both implementations on identical input and records each output via `toMatchInlineSnapshot()` (Vitest fills these in on first run). The goal is comprehensive coverage, not red/green pass/fail on upstream's output.

- [ ] **Step 1: Add multi-paragraph + blank-line + indentation scenarios**

Append inside the existing test file, after the smoke `describe`:

```
describe('gq-parity: prose', () => {
  const TW = 20;

  test('multi-line paragraph joins and rewraps', () => {
    const input = 'the quick brown\nfox jumps over the lazy dog';
    expect({
      upstream: runUpstream(input, TW, 0, 1),
      ours: runOurs(input, TW, 0, 1),
    }).toMatchInlineSnapshot();
  });

  test('paragraphs separated by blank line', () => {
    const input = 'first paragraph text here\n\nsecond paragraph text here';
    expect({
      upstream: runUpstream(input, TW, 0, 2),
      ours: runOurs(input, TW, 0, 2),
    }).toMatchInlineSnapshot();
  });

  test('leading indentation is preserved', () => {
    const input = '  indented text that should be wrapped properly';
    expect({
      upstream: runUpstream(input, TW, 0, 0),
      ours: runOurs(input, TW, 0, 0),
    }).toMatchInlineSnapshot();
  });

  test('mixed-width input — short line followed by long line', () => {
    const input = 'A short line.\nThis second line is considerably longer than textwidth.';
    expect({
      upstream: runUpstream(input, TW, 0, 1),
      ours: runOurs(input, TW, 0, 1),
    }).toMatchInlineSnapshot();
  });
});
```

- [ ] **Step 2: Add markdown-construct scenarios**

```
describe('gq-parity: markdown constructs', () => {
  const TW = 20;

  test('bullet list — two short items', () => {
    const input = '- first item\n- second item';
    expect({
      upstream: runUpstream(input, TW, 0, 1),
      ours: runOurs(input, TW, 0, 1),
    }).toMatchInlineSnapshot();
  });

  test('blockquote — two lines', () => {
    const input = '> quoted line one here\n> quoted line two here';
    expect({
      upstream: runUpstream(input, TW, 0, 1),
      ours: runOurs(input, TW, 0, 1),
    }).toMatchInlineSnapshot();
  });

  test('fenced code block — should NOT be reflowed', () => {
    const input = '```\nvar longVariableName = computeValueOverTwentyChars();\n```';
    expect({
      upstream: runUpstream(input, TW, 0, 2),
      ours: runOurs(input, TW, 0, 2),
    }).toMatchInlineSnapshot();
  });

  test('setext heading — underline should not merge into the heading', () => {
    const input = 'Heading Text\n============\n\nBody text paragraph here.';
    expect({
      upstream: runUpstream(input, TW, 0, 3),
      ours: runOurs(input, TW, 0, 3),
    }).toMatchInlineSnapshot();
  });
});
```

- [ ] **Step 3: Add the `gw` cursor-preservation scenario**

`gw` differs from `gq` only in that the cursor stays where it was. `keepCursor` logic lives in the operator shim (bundle:2866), not inside `hardWrap`. Test via the operator path (keymap) rather than calling `cm.hardWrap` directly.

```
describe('gq-parity: gw cursor preservation', () => {
  test('gw leaves cursor at pre-motion position', () => {
    const { view, cm } = makeUpstreamEditor(
      'the quick brown\nfox jumps over the lazy dog',
      20,
    );
    cm.setCursor({ line: 0, ch: 5 });
    Vim.handleKey(cm, 'g', 'user');
    Vim.handleKey(cm, 'w', 'user');
    Vim.handleKey(cm, 'a', 'user');
    Vim.handleKey(cm, 'p', 'user');
    const pos = cm.getCursor();
    expect(pos).toEqual({ line: 0, ch: 5 });
    view.destroy();
  });
});
```

If `Vim.handleKey` doesn't work cleanly under jsdom, fall back to calling `cm.hardWrap({from:0, to:1})` directly, capturing cursor before/after, and asserting the cursor is unchanged — but document in the parity report that the test bypasses the operator shim. If even that is flaky, mark gw as "not tested" in the report and proceed; the decision rule still works because gw's keepCursor logic lives in upstream's operator shim and that shim is covered by our standing override (Task 5b preserves it).

- [ ] **Step 4: Run the tests and let inline snapshots populate**

Run: `npm test -- gq-parity`
Expected: Vitest writes actual output into each `toMatchInlineSnapshot()` call. Review the diffs manually before commit — this is the parity data. It's OK if upstream and ours produce different output; that's the whole point.

- [ ] **Step 5: Commit the scenarios**

```
git add src/vim/gq-parity.test.js
git commit -m "test: gq parity scenarios — prose, markdown, gw cursor (#27)"
```

---

## Task 3: Write the parity report

**Files:**
- Modify: `docs/plans/2026-04-19-gq-upstream-parity.md` — append a **Parity Report** section

- [ ] **Step 1: Populate the table below with snapshot outputs**

For each scenario in `gq-parity.test.js`, copy the inline-snapshot result into the table. Format `\n` as visible line breaks inside the cell.

Template to fill in (append to this plan file):

```markdown
## Parity Report

Generated from `src/vim/gq-parity.test.js` on 2026-04-19 against `@replit/codemirror-vim@^6.3.0` (installed version: <fill in from package-lock.json>).

| # | Scenario | tw | Upstream output | Ours output | Verdict |
|---|---|---:|---|---|---|
| 1 | Smoke (short line) | 80 | `short line` | `short line` | EQUAL |
| 2 | Multi-line paragraph | 20 | … | … | EQUAL / DIFFER |
| 3 | Blank-line boundary | 20 | … | … | … |
| 4 | Indentation | 20 | … | … | … |
| 5 | Mixed-width prose | 20 | … | … | … |
| 6 | Bullet list | 20 | … | … | … |
| 7 | Blockquote | 20 | … | … | … |
| 8 | Fenced code block | 20 | … | … | … |
| 9 | Setext heading | 20 | … | … | … |
| 10 | gw cursor preservation | 20 | N/A — cursor-only assertion | Same | EQUAL / DIFFER |

### Divergence summary

- **Equal on:** (list scenarios)
- **Differ on:** (list scenarios + one-sentence diagnosis per item — e.g. "upstream leaves `- ` prefix on each item but merges item text across lines, ours joins item text and loses bullet on the second line")
```

- [ ] **Step 2: Commit the report**

```
git add docs/plans/2026-04-19-gq-upstream-parity.md
git commit -m "docs: gq parity report — snapshot upstream vs ours (#27)"
```

---

## Task 4: Make the Phase 2 decision

**Files:**
- Modify: `docs/plans/2026-04-19-gq-upstream-parity.md` — append a **Decision** section

The decision is mechanical given the table:

- **Full parity (0 DIFFER rows):** → **delete**. Upstream is strictly equivalent, our code is pure duplication.
- **Divergence ONLY on markdown constructs (rows 6–9):** → **slim**. Keep `reflowRange`/`wordWrap` and the `defineOperator` overrides; remove the redundant `Vim.mapCommand('gq'|'gw', ...)` calls. Rationale: our paragraph-join preserves intent on markdown inputs (even if neither is markdown-aware, ours at least doesn't MERGE lines into an existing bullet/quote prefix the way upstream would).
- **Divergence ALSO on prose (rows 2–5):** → **close verified-negative**. Our paragraph-first output is cleaner on the primary use case; upstream is not a drop-in. Keep everything.

- [ ] **Step 1: Pick one of the three verdicts** based on the Task 3 table. Write a 2–3 sentence rationale under a **Decision** heading citing the specific rows that drove the choice.

- [ ] **Step 2: Commit the decision**

```
git add docs/plans/2026-04-19-gq-upstream-parity.md
git commit -m "docs: gq parity verdict — <delete|slim|verified-negative> (#27)"
```

---

## Task 5: Execute the decision

**Files:** depend on the verdict. Exactly one of the three subtasks below applies.

### Task 5a: VERDICT = delete

- [ ] **Step 1: Remove the module**

```
git rm src/vim/gq.js src/vim/gq.test.js
```

- [ ] **Step 2: Remove the export from `src/vim/index.js`**

Edit `src/vim/index.js`, delete line 7:

```
export { registerGqOperator } from './gq.js';
```

- [ ] **Step 3: Remove the call from `src/main.js`**

Edit `src/main.js`:
- Remove `registerGqOperator,` from the import block (around line 35)
- Remove the `registerGqOperator(state);` call at line 476

- [ ] **Step 4: Remove (or repurpose) the parity harness**

Decide:
- If keeping the harness as a "don't drift" regression guard: leave `gq-parity.test.js` in place, but remove the `runOurs` helper and the "ours" assertions (since `reflowRange` no longer exists to import). Rename to `gq-upstream-smoke.test.js`.
- If dropping it: `git rm src/vim/gq-parity.test.js`.

Default: drop it. The upstream behavior is now implicitly covered by our use of the default keymap + vitest won't protect against upstream regressions in a library we don't own anyway.

- [ ] **Step 5: Run full check + build**

```
npm run check && npm run build
```

Expected: all green. If the build fails, we missed a reference to `registerGqOperator` or `gq.js` — grep the repo and remove.

### Task 5b: VERDICT = slim

- [ ] **Step 1: Remove the mapCommand calls from `src/vim/gq.js`**

Edit `src/vim/gq.js`:
- Delete line 112: `Vim.mapCommand('gq', 'operator', 'hardWrap', {}, {});`
- Delete line 143: `Vim.mapCommand('gw', 'operator', 'hardWrapKeepCursor', {}, {});`

Verify upstream's `defaultKeymap` entries at bundle:189–190 still route `gq`→`hardWrap` — our `defineOperator('hardWrap', ...)` continues to override upstream's operator table entry at bundle:2859 (same name), so the default keymap now reaches OUR operator implementation. `gw` upstream maps to `hardWrap` with `operatorArgs: {keepCursor: true}` — our `hardWrapKeepCursor` operator is dead code under this path. Delete it (lines 116–141).

- [ ] **Step 2: Teach our `hardWrap` operator to honor `operatorArgs.keepCursor`**

Our current `hardWrap` at gq.js:85 ignores `operatorArgs`. After the slim, upstream's `gw` default keymap passes `{keepCursor: true}` — we must respect it. Edit the `hardWrap` operator:

```
Vim.defineOperator('hardWrap', function (cm, operatorArgs, ranges, oldAnchor) {
  var width = state.textwidth > 0 ? state.textwidth : 79;
  var cursorLine = 0;
  cm.operation(function () {
    for (var i = ranges.length - 1; i >= 0; i--) {
      var range = ranges[i];
      var fromPos =
        range.anchor.line <= range.head.line ? range.anchor : range.head;
      var toPos =
        range.anchor.line <= range.head.line ? range.head : range.anchor;
      var from = fromPos.line;
      var to = toPos.line;
      if (to > from && toPos.ch === 0) to--;
      while (to > from && cm.getLine(to).trim() === '') to--;
      var newLines = reflowRange(cm, from, to, width);
      cursorLine = from + newLines - 1;
    }
  });
  if (operatorArgs && operatorArgs.keepCursor) {
    var lastLine0 = cm.lastLine();
    var line0 = Math.min(oldAnchor.line, lastLine0);
    var lineLen0 = cm.getLine(line0).length;
    var ch0 = Math.min(oldAnchor.ch, lineLen0);
    cm.setCursor(line0, ch0);
    return;
  }
  var lastLine = cm.lastLine();
  if (cursorLine > lastLine) cursorLine = lastLine;
  var firstNonBlank = cm.getLine(cursorLine).search(/\S/);
  cm.setCursor(cursorLine, firstNonBlank < 0 ? 0 : firstNonBlank);
});
```

Then delete the now-dead `Vim.defineOperator('hardWrapKeepCursor', ...)` block.

- [ ] **Step 3: Update the file header**

Change the lead JSDoc in `gq.js` to cite the parity evidence — paragraph-first override of upstream `hardWrap`; see `docs/plans/2026-04-19-gq-upstream-parity.md`.

- [ ] **Step 4: Update `gq.test.js` if the public API changed**

Nothing moved publicly — `reflowRange` and `wordWrap` exports stay. Tests pass unchanged.

- [ ] **Step 5: Keep or drop the parity harness**

Keep `gq-parity.test.js` as-is — it's now a regression guard that proves we still diverge from upstream *on purpose*. Good documentation value, cheap to run.

- [ ] **Step 6: Run full check + build**

```
npm run check && npm run build
```

### Task 5c: VERDICT = close verified-negative

- [ ] **Step 1: Add a one-paragraph rationale comment to `src/vim/gq.js`**

Prepend to the file header, citing the parity report and the specific rows that drove the decision.

- [ ] **Step 2: Keep the parity harness** as a pinned regression guard.

- [ ] **Step 3: Run full check + build**

```
npm run check && npm run build
```

---

## Task 6: Interactive browser smoke test

**Files:** no code changes — this is verification only.

- [ ] **Step 1: Build and serve**

```
npm run build
python3 -m http.server 9876 --bind 0.0.0.0
```

- [ ] **Step 2: Use Playwright to hit `http://rika:9876/vi.html?test`**

- [ ] **Step 3: Run two gqap scenarios manually via the `?test` harness API** (`window.__vi`, defined in `src/test-harness.js`):

Scenario A (mixed-width prose paragraph):
1. Set the document to `'the quick brown\nfox jumps over the lazy dog'` via `__vi.setDoc(...)`.
2. Run the Ex command `:set tw=20` via the `__vi` harness.
3. Call `__vi.pressKeys('gqap')`.
4. Read `__vi.getDoc()` — expect output wrapped at ≤20 columns, no trailing edits.

Scenario B (`gw` preserves cursor):
1. Set the document to `'the quick brown\nfox jumps over the lazy dog'`.
2. Set tw=20 via the `__vi` harness.
3. `__vi.pressKey('Escape')`; `__vi.pressKeys('0')` (cursor to col 0).
4. `__vi.pressKeys('gwap')`.
5. Read `__vi.getCursor()` — expect `{line: 0, ch: 0}`.

Expected (slim path): outputs still match our paragraph-join wrap; cursor in Scenario B stays at original position.
Expected (delete path): outputs match upstream's line-by-line behavior. Acceptable as long as visually reasonable.

If anything looks wrong, back out Task 5 and re-open the issue with the browser evidence.

---

## Task 7: Open the PR

- [ ] **Step 1: Push the branch**

```
git push -u origin feature/gq-upstream-parity-27
```

- [ ] **Step 2: Open the PR**

Title: `Evaluate gq upstream parity (#27)`

Body template:

```
## Summary
- Built a jsdom-backed Vitest parity harness that drives upstream's hardWrap against the same scenarios as our reflowRange, documented divergences in docs/plans/2026-04-19-gq-upstream-parity.md.
- Based on the parity table, <delete / slim / kept verified-negative> — rationale in the plan doc.

## Test plan
- [ ] npm run check — lint + unit tests (including new parity harness)
- [ ] npm run build — bundle still builds
- [ ] Interactive browser: gqap on mixed-width prose reflows correctly
- [ ] Interactive browser: gwap preserves cursor position

Resolves #27
```

---

## Self-review

- **Spec coverage:** Phase 1 of the issue (parity harness across 8 scenarios) is Tasks 1–3. Phase 2 (delete / slim / close) is Tasks 4–5. Every decision branch has explicit steps. ✓
- **Placeholder scan:** no "TBD" or "add appropriate". Every code step shows actual code or a precise inline description. ✓
- **Type consistency:** `runUpstream`/`runOurs` return strings; `reflowRange` import path matches existing test file; `getCM`/`Vim`/`EditorView`/`EditorState` are all real exports. ✓
- **Open risk:** Task 2 Step 3 (`gw` via `Vim.handleKey`) may not work under jsdom — documented fallbacks. If even the fallbacks are flaky, gw parity gets marked "not tested" in the report, and the decision rule still works because gw's keepCursor logic lives in upstream's operator shim (bundle:2866), not inside `hardWrap` proper, and that shim IS covered by our standing override in Task 5b.
