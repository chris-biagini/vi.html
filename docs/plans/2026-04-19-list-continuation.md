# Auto-Continue Lists Implementation Plan

> **⚠ SUPERSEDED 2026-04-19.** This plan was partially executed (Tasks 0, 1, 2 were implemented and reviewed) before browser verification (Task 4) revealed that CM6 + `@codemirror/lang-markdown` already handles list continuation natively &mdash; bullets, ordered-with-increment, task-lists-carry-forward, and indent preservation all work without any custom code. Our custom handler was redundant for every continuation case, and its termination branch *conflicted* with CM6's continuation (producing `- foo\n\n- ` instead of the intended `- foo\n\n`). All three implementation commits were reverted. The only remaining artifact is the refined "List Continuation" section in the help page (`src/template.html`), which documents the already-working native behavior.
>
> **Lesson captured** in the roadmap's architectural commitments: *Verify native CM6 behavior before planning.* Drive scenarios through the `?test` harness before writing a plan that touches Enter/Backspace/Tab/cursor/selection semantics. CM6 does more than expected.
>
> Kept on disk as a record of the pivot. Do not execute.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When pressing Enter in insert mode on a markdown list item, automatically begin the next line with the same marker, indent, and (for ordered lists) incremented number. Pressing Enter on an empty list marker terminates the list and leaves a blank line.

**Architecture:** A pure function `continueListLine(lineText)` returns the prefix to insert on the next line — a string for continuation, the empty string for termination, or `null` for "no list continuation applies." A handler `handleListContinuation(cm, changeObj, state)` hooks into CM5 change events the same way `src/vim/textwidth.js` does — when an Enter character is inserted in insert mode, it inspects the preceding line and either inserts a continuation prefix at the cursor or strips the now-empty marker from the prior line. A `state.continuingList` recursion guard prevents re-entry. All edits are deferred via `setTimeout(..., 0)` to avoid CM6 update-cycle errors.

**Tech Stack:** `@replit/codemirror-vim` CM5 compat layer, plain JavaScript (ESM), Vitest for unit tests, Playwright for browser verification.

---

## Task 0: Create the pure function with full unit tests

**Files:**
- Create: `src/vim/list-continuation.js`
- Create: `src/vim/list-continuation.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/vim/list-continuation.test.js`:

```js
import { describe, test, expect } from 'vitest';
import { continueListLine } from './list-continuation.js';

describe('continueListLine', () => {
  // Bullet lists -----------------------------------------------------------

  test('continues unordered dash list', () => {
    expect(continueListLine('- foo')).toBe('- ');
  });

  test('continues unordered asterisk list', () => {
    expect(continueListLine('* foo')).toBe('* ');
  });

  test('continues unordered plus list', () => {
    expect(continueListLine('+ foo')).toBe('+ ');
  });

  test('preserves leading indentation on bullet list', () => {
    expect(continueListLine('  - foo')).toBe('  - ');
  });

  test('preserves deep indentation on bullet list', () => {
    expect(continueListLine('      - foo')).toBe('      - ');
  });

  // Ordered lists ----------------------------------------------------------

  test('increments single-digit ordered list', () => {
    expect(continueListLine('1. foo')).toBe('2. ');
  });

  test('increments multi-digit ordered list', () => {
    expect(continueListLine('10. foo')).toBe('11. ');
  });

  test('increments ordered list with parenthesis style', () => {
    expect(continueListLine('1) foo')).toBe('2) ');
  });

  test('preserves indentation on ordered list', () => {
    expect(continueListLine('  3. foo')).toBe('  4. ');
  });

  // Checkboxes (GFM) -------------------------------------------------------

  test('continues unchecked task list as unchecked', () => {
    expect(continueListLine('- [ ] task')).toBe('- [ ] ');
  });

  test('continues checked task list as unchecked (new task starts unchecked)', () => {
    expect(continueListLine('- [x] task')).toBe('- [ ] ');
  });

  test('continues indented task list', () => {
    expect(continueListLine('  - [ ] task')).toBe('  - [ ] ');
  });

  // Termination on empty markers ------------------------------------------

  test('terminates on empty bullet marker', () => {
    expect(continueListLine('- ')).toBe('');
  });

  test('terminates on empty asterisk marker', () => {
    expect(continueListLine('* ')).toBe('');
  });

  test('terminates on empty ordered marker', () => {
    expect(continueListLine('1. ')).toBe('');
  });

  test('terminates on empty indented marker', () => {
    expect(continueListLine('    - ')).toBe('');
  });

  test('terminates on empty task marker (unchecked)', () => {
    expect(continueListLine('- [ ] ')).toBe('');
  });

  test('terminates on empty task marker (checked)', () => {
    expect(continueListLine('- [x] ')).toBe('');
  });

  // No-op cases ------------------------------------------------------------

  test('returns null for non-list line', () => {
    expect(continueListLine('foo bar')).toBe(null);
  });

  test('returns null for empty line', () => {
    expect(continueListLine('')).toBe(null);
  });

  test('returns null for whitespace-only line', () => {
    expect(continueListLine('   ')).toBe(null);
  });

  test('returns null for heading', () => {
    expect(continueListLine('# Heading')).toBe(null);
  });

  test('returns null for blockquote (not handled in v1)', () => {
    expect(continueListLine('> quote')).toBe(null);
  });

  test('returns null for line that starts with a digit but no list marker', () => {
    expect(continueListLine('1 foo')).toBe(null);
  });

  test('returns null for line that starts with a dash but no space', () => {
    expect(continueListLine('-foo')).toBe(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/vim/list-continuation.test.js
```

Expected: FAIL with "Failed to load url ./list-continuation.js" (module doesn't exist yet).

- [ ] **Step 3: Implement the pure function**

Create `src/vim/list-continuation.js`:

```js
/**
 * Auto-continue markdown lists.
 *
 * Pure helper that decides what (if anything) should follow when the user
 * presses Enter on a markdown list item. Returns:
 *   - a string to insert as the next line's prefix (continuation), OR
 *   - '' (empty string) to signal termination — the previous marker should
 *     be cleared, the new line stays blank, OR
 *   - null when the line isn't a recognized list item.
 *
 * Closest vim analogue: `formatoptions+=ro`, which is intentionally not
 * implemented project-wide. This is a markdown-aware shim.
 */

// Captures: indent, marker, separator, content
//   - bullets:  - * +  followed by a single space
//   - ordered:  digits followed by . or ) and a single space
//   - tasks:    bullet + "[ ]" or "[x]" + space
var BULLET_RE = /^(\s*)([-*+]) (.*)$/;
var ORDERED_RE = /^(\s*)(\d+)([.)]) (.*)$/;
var TASK_RE = /^(\s*)([-*+]) \[([ xX])\] (.*)$/;

export function continueListLine(lineText) {
  // Task list takes precedence over plain bullet because the bullet RE
  // would otherwise match the "- [ ]" prefix.
  var task = lineText.match(TASK_RE);
  if (task) {
    var taskIndent = task[1];
    var taskBullet = task[2];
    var taskRest = task[4];
    if (taskRest === '') return '';
    return taskIndent + taskBullet + ' [ ] ';
  }

  var ordered = lineText.match(ORDERED_RE);
  if (ordered) {
    var orderedIndent = ordered[1];
    var orderedNum = parseInt(ordered[2], 10);
    var orderedSep = ordered[3];
    var orderedRest = ordered[4];
    if (orderedRest === '') return '';
    return orderedIndent + (orderedNum + 1) + orderedSep + ' ';
  }

  var bullet = lineText.match(BULLET_RE);
  if (bullet) {
    var bulletIndent = bullet[1];
    var bulletMarker = bullet[2];
    var bulletRest = bullet[3];
    if (bulletRest === '') return '';
    return bulletIndent + bulletMarker + ' ';
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/vim/list-continuation.test.js
```

Expected: All 23 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vim/list-continuation.js src/vim/list-continuation.test.js
git commit -m "feat(list-continuation): add pure continueListLine function with tests"
```

---

## Task 1: Add the change-handler that wires the function to insert-mode Enter

**Files:**
- Modify: `src/vim/list-continuation.js`

- [ ] **Step 1: Append the handler to the module**

Add to the bottom of `src/vim/list-continuation.js`:

```js
/**
 * Insert-mode change handler. Hooks the CM5 `change` event the same way
 * src/vim/textwidth.js does. When the user presses Enter in insert mode
 * on a markdown list item, applies continueListLine to either insert a
 * continuation prefix on the new line or strip the empty marker from the
 * line that was just split.
 *
 * Notes:
 *   - We detect Enter by inspecting changeObj.text. CM5 represents a
 *     single newline as ['', '']. Pasted multi-line text has non-empty
 *     entries, so paste is naturally excluded.
 *   - CM6 dispatch from inside a change handler throws; we defer with
 *     setTimeout(..., 0).
 *   - state.continuingList is the recursion guard.
 */
export function handleListContinuation(cm, changeObj, state) {
  if (state.continuingList) return;
  if (!cm.state.vim || !cm.state.vim.insertMode) return;

  // Only react to a single newline insertion (paste excluded).
  var text = changeObj.text;
  if (!text || text.length !== 2 || text[0] !== '' || text[1] !== '') return;

  // The line that was split is one above the cursor's current line.
  var cursor = cm.getCursor();
  var prevLineNo = cursor.line - 1;
  if (prevLineNo < 0) return;

  var prevLineText = cm.getLine(prevLineNo);
  var continuation = continueListLine(prevLineText);
  if (continuation === null) return;

  state.continuingList = true;
  setTimeout(function () {
    cm.operation(function () {
      if (continuation === '') {
        // Termination: strip the empty marker from the previous line.
        cm.replaceRange(
          '',
          { line: prevLineNo, ch: 0 },
          { line: prevLineNo, ch: prevLineText.length },
        );
      } else {
        // Continuation: insert the prefix at the cursor on the new line.
        cm.replaceRange(continuation, cursor, cursor);
      }
    });
    state.continuingList = false;
  }, 0);
}
```

- [ ] **Step 2: Run existing tests to verify no breakage**

```bash
npm test -- src/vim/list-continuation.test.js
```

Expected: All 23 tests still PASS (the new export doesn't affect them).

- [ ] **Step 3: Commit**

```bash
git add src/vim/list-continuation.js
git commit -m "feat(list-continuation): add insert-mode change handler"
```

---

## Task 2: Wire the handler into main.js

**Files:**
- Modify: `src/vim/index.js`
- Modify: `src/main.js`

- [ ] **Step 1: Re-export the handler from the barrel**

Open `src/vim/index.js` and add (placement among the other exports doesn't matter, but keep it grouped near similar insert-mode handlers):

```js
export { handleListContinuation } from './list-continuation.js';
```

- [ ] **Step 2: Locate the existing change-event wiring in main.js**

Use Grep to find the line:

```
pattern: handleTextwidthWrap|cm\.on\('change'
path: src/main.js
```

Identify the change handler that calls `handleTextwidthWrap`. The new handler will be invoked alongside it.

- [ ] **Step 3: Import and invoke the handler**

In `src/main.js`:

1. Add `handleListContinuation` to the import from `./vim/index.js`.
2. In the same `cm.on('change', ...)` callback that calls `handleTextwidthWrap`, add a call to `handleListContinuation(cm, changeObj, state)`. Ensure `state` already carries `continuingList: false` at initialization (alongside `wrapping: false`). If it doesn't, add it.

Example (illustrative — keep the existing structure intact):

```js
// In the state initialization (look for `wrapping: false`):
var state = {
  // ...existing fields...
  wrapping: false,
  continuingList: false,
  // ...existing fields...
};

// In the change handler:
cm.on('change', function (cm, changeObj) {
  handleTextwidthWrap(cm, changeObj, state);
  handleListContinuation(cm, changeObj, state);
});
```

- [ ] **Step 4: Run the full check**

```bash
npm run check
```

Expected: lint clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/vim/index.js src/main.js
git commit -m "feat(list-continuation): wire insert-mode handler into editor"
```

---

## Task 3: Document the feature on the help page

**Files:**
- Modify: `src/template.html`

- [ ] **Step 1: Find a sensible location**

Use Grep with pattern `textwidth|<h2>` on `src/template.html`. Find a section near existing markdown / insert-mode features, or place a new section before the "Persistence" heading.

- [ ] **Step 2: Add documentation**

Add an `<h2>` section like:

```html
<h2>List Continuation</h2>
<p>
  Pressing <kbd>Enter</kbd> in insert mode on a markdown list item
  starts the next line with the same marker and indent. Numbered lists
  increment automatically (<code>1.</code> &rarr; <code>2.</code>),
  and task list checkboxes start unchecked. Pressing <kbd>Enter</kbd>
  on an empty list marker terminates the list and leaves a blank
  line.
</p>
<p>
  Supported markers: <code>-</code>, <code>*</code>, <code>+</code>,
  <code>1.</code> / <code>1)</code>, and GFM task lists
  (<code>- [ ]</code> / <code>- [x]</code>).
</p>
```

- [ ] **Step 3: Commit**

```bash
git add src/template.html
git commit -m "docs(help): document list continuation feature"
```

---

## Task 4: Browser verification with Playwright

**Files:** None (interactive verification).

- [ ] **Step 1: Build and serve**

```bash
npm run build
python3 -m http.server 9876 --bind 0.0.0.0
```

(Per `~/CLAUDE.md`: bind to `0.0.0.0` and reach it at `http://rika:9876/vi.html?test`.)

- [ ] **Step 2: Drive Playwright through the test cases**

Navigate to `http://rika:9876/vi.html?test`. For each scenario, set the document via `__vi.setDoc`, focus the editor, enter insert mode, and use Playwright's `pressSequentially` (per the CLAUDE.md note that insert-mode typing must use `pressSequentially`, not `__vi.pressKeys`):

1. **Bullet continuation:** Set `''`, type `i- foo`, press Enter, type `bar`. Expected: doc is `- foo\n- bar`.
2. **Ordered continuation + increment:** Set `''`, type `i1. foo`, press Enter, type `bar`. Expected: `1. foo\n2. bar`.
3. **Multi-digit ordered:** Set `9. foo`, position cursor at end of line, type `i`, press Enter, type `bar`. Expected: `9. foo\n10. bar`.
4. **Indented bullet:** Set `''`, type `i  - foo`, press Enter, type `bar`. Expected: `  - foo\n  - bar`.
5. **Task list (unchecked):** Set `''`, type `i- [ ] task`, press Enter, type `next`. Expected: `- [ ] task\n- [ ] next`.
6. **Task list (checked carries forward as unchecked):** Set `- [x] done`, position cursor at end, type `i`, press Enter, type `next`. Expected: `- [x] done\n- [ ] next`.
7. **Termination:** Set `''`, type `i- foo`, press Enter, press Enter (empty marker). Expected: `- foo\n\n` and cursor on a blank line ready for normal text.
8. **Non-list line:** Set `''`, type `iHello world`, press Enter, type `next`. Expected: `Hello world\nnext` (no marker injected).
9. **Mid-line split:** Set `- foobar`, position cursor between `o` and `b` (at column 5), type `i`, press Enter. Expected: `- foo\n- bar`.

- [ ] **Step 3: Verify no regressions in adjacent features**

- Type a long sentence at `:set tw=40` &rarr; textwidth wrap still works.
- Set `:ab teh the` then test &rarr; abbreviations still expand on space.
- Press Enter in normal mode (not insert) &rarr; no continuation triggered.
- Paste a multi-line block via clipboard or `__vi.setDoc` &rarr; no continuation injected into pasted lines.

- [ ] **Step 4: Stop the server**

Stop the python http.server with Ctrl-C.

---

## Task 5: Final lint, test, and verification gate

- [ ] **Step 1: Run the full check that CI runs**

```bash
npm run check
```

Expected: lint and all tests pass.

- [ ] **Step 2: Confirm the build still succeeds**

```bash
npm run build
```

Expected: `vi.html` builds without error.

- [ ] **Step 3: Verify git state is clean**

```bash
git status
```

Expected: working tree clean (all earlier task commits already landed).

---

## Self-Review Checklist (filled out by the planner before handoff)

- **Spec coverage:** Goal (auto-continue markdown lists with Enter, terminate on empty marker, preserve indent, increment ordered) — covered by Tasks 0 (function), 1 (handler), 2 (wiring). Help docs &mdash; Task 3. Browser verification &mdash; Task 4.
- **Placeholder scan:** No "TBD"s, no "implement later"s, no "similar to Task N" without code.
- **Type consistency:** `continueListLine` returns `string | null` consistently; `''` is the documented termination sentinel; `state.continuingList` name matches between Tasks 1 and 2.
- **Project conventions honored:** TDD pattern (test first), pure-function-then-handler split (matches `textwidth.js`), `setTimeout(..., 0)` deferral (per CLAUDE.md CM6 dispatch gotcha), `Vim.defineOption`/Ex commands not introduced (always-on, YAGNI), help page updated (per CLAUDE.md custom-vim-feature requirement), browser verification step (per CLAUDE.md browser testing requirement).
