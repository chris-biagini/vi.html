# Word Count + Reading Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ambient word count and reading-time estimate to the status bar, with selection-aware behavior in visual mode.

**Architecture:** A new pure-functions module `src/wordcount.js` (counter + formatter, both unit-tested in Vitest) is wired through `src/status.js` (DOM update) and `src/main.js` (a debounced CodeMirror `EditorView.updateListener`). A new `<span id="status-words">` is added to the status bar in `src/template.html` with a small CSS rule in `src/style.css`. Help-page docs get a short new "Status Bar" section.

**Tech stack:** CodeMirror 6, `@replit/codemirror-vim`, Vitest. ES modules in `src/`, bundled via esbuild from `build.js`.

**Reference:** Design spec at `docs/plans/2026-04-19-word-count-design.md` (committed earlier on this branch). Read it before starting Task 1 — it captures every behavioral decision and rationale.

---

## File touch list

- **Create:** `src/wordcount.js` — `WPM`, `countWords`, `formatIndicator`.
- **Create:** `src/wordcount.test.js` — Vitest suite for both functions.
- **Modify:** `src/template.html` — add `<span id="status-words">` to the status bar; add a new "Status Bar" help section + TOC entry.
- **Modify:** `src/style.css` — `#status-words` rule.
- **Modify:** `src/status.js` — resolve `#status-words` in `initStatusBar`; export `updateWordCount`.
- **Modify:** `src/main.js` — import `updateWordCount`; add a debounced `EditorView.updateListener` for word-count updates; initial paint after editor init.

No vim modules touched (this isn't a vim feature). No `editorAPI` change needed (the listener lives in `main.js` where `EditorView` is already available).

---

## Task 1: `formatIndicator` (pure formatter, TDD)

**Files:**
- Create: `src/wordcount.js`
- Test: `src/wordcount.test.js`

`formatIndicator` is the simpler of the two pure functions in this module — start here so the module's existence and the test wiring are proven before the more involved `countWords` work.

- [ ] **Step 1: Write failing tests for `formatIndicator`**

Create `src/wordcount.test.js` with the full formatter suite up front (TDD; we'll implement once and watch them all pass):

```js
import { describe, it, expect } from 'vitest';
import { formatIndicator, WPM } from './wordcount.js';

describe('formatIndicator', () => {
  it('shows just words for empty doc', () => {
    expect(formatIndicator(0)).toBe('0w');
  });

  it('hides reading time below 200 words', () => {
    expect(formatIndicator(1)).toBe('1w');
    expect(formatIndicator(199)).toBe('199w');
  });

  it('shows reading time at exactly 200 words (1 min)', () => {
    expect(formatIndicator(200)).toBe('200w · 1m');
  });

  it('rounds reading time up to the nearest minute', () => {
    expect(formatIndicator(201)).toBe('201w · 2m');
    expect(formatIndicator(400)).toBe('400w · 2m');
    expect(formatIndicator(401)).toBe('401w · 3m');
  });

  it('uses sel suffix when isSelection is true (no reading time)', () => {
    expect(formatIndicator(47, { isSelection: true })).toBe('47w sel');
    expect(formatIndicator(0, { isSelection: true })).toBe('0w sel');
    expect(formatIndicator(5000, { isSelection: true })).toBe('5000w sel');
  });

  it('exports WPM as 200', () => {
    expect(WPM).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests; verify all `formatIndicator` cases fail**

Run: `npx vitest run src/wordcount.test.js`
Expected: All 6 tests fail with "Cannot find module './wordcount.js'".

- [ ] **Step 3: Implement `formatIndicator`**

Create `src/wordcount.js`:

```js
// Pure word-count + reading-time formatter for the status bar.
// See docs/plans/2026-04-19-word-count-design.md for behavior spec.

export const WPM = 200;

export function formatIndicator(words, opts) {
  var isSelection = opts && opts.isSelection;
  if (isSelection) return words + 'w sel';
  if (words < WPM) return words + 'w';
  var minutes = Math.max(1, Math.ceil(words / WPM));
  return words + 'w · ' + minutes + 'm';
}
```

Use `var` and `function` style to match the project's existing conventions (see `src/status.js`, `src/preview.js`).

The `· ` is U+00B7 (middle dot) — make sure to copy it from this plan rather than retyping.

- [ ] **Step 4: Run tests; verify all `formatIndicator` cases pass**

Run: `npx vitest run src/wordcount.test.js`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/wordcount.js src/wordcount.test.js
git commit -m "feat(wordcount): add formatIndicator pure formatter

Returns '<n>w', '<n>w · <m>m', or '<n>w sel' depending on count and
selection mode. WPM=200; reading time hidden below threshold; rounded
up with min 1m. Pure function, fully unit-tested."
```

---

## Task 2: `countWords` (markdown-aware counter, TDD)

**Files:**
- Modify: `src/wordcount.js`
- Test: `src/wordcount.test.js`

The "cheap B" markdown-stripping counter from the design spec. Order of regex strips matters and is fixed in the design (fenced → HTML → image → link → inline-code → heading → blockquote → list → emphasis).

- [ ] **Step 1: Write the full failing test suite for `countWords`**

Append to `src/wordcount.test.js`:

```js
import { countWords } from './wordcount.js';

describe('countWords', () => {
  it('returns 0 for empty and whitespace-only input', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('\n\n  \t\n')).toBe(0);
  });

  it('counts plain prose by whitespace splits', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one  two\tthree\nfour')).toBe(4);
  });

  it('strips heading hashes', () => {
    expect(countWords('# Title')).toBe(1);
    expect(countWords('### Three Hash Heading')).toBe(3);
    expect(countWords('# A\n## B\n### C')).toBe(3);
  });

  it('strips emphasis markers, keeps contents', () => {
    expect(countWords('**bold** _italic_ ~~strike~~')).toBe(3);
    expect(countWords('a *b* c')).toBe(3);
    expect(countWords('__under__ score')).toBe(2);
  });

  it('strips link URLs, keeps link text', () => {
    expect(countWords('[link text](https://example.com)')).toBe(2);
    expect(countWords('see [the docs](https://x.io/y) please')).toBe(4);
  });

  it('strips image URLs, keeps alt text', () => {
    expect(countWords('![alt text](url.png)')).toBe(2);
    expect(countWords('![](url.png)')).toBe(0);
  });

  it('strips inline code backticks, keeps contents as one word', () => {
    expect(countWords('use `foo()` here')).toBe(3);
    expect(countWords('`x` `y` `z`')).toBe(3);
  });

  it('strips fenced code blocks entirely', () => {
    expect(countWords('```\nlots of code in here\n```\nreal text')).toBe(2);
    expect(countWords('intro\n```js\nvar a = 1\n```\noutro')).toBe(2);
  });

  it('strips blockquote markers', () => {
    expect(countWords('> quoted text')).toBe(2);
    expect(countWords('> > nested quote')).toBe(2);
  });

  it('strips list markers', () => {
    expect(countWords('- item one\n- item two')).toBe(4);
    expect(countWords('* bullet a\n+ bullet b')).toBe(4);
    expect(countWords('1. first\n2. second')).toBe(2);
  });

  it('strips HTML tags, keeps contents', () => {
    expect(countWords('<br>hello<em>world</em>')).toBe(2);
    expect(countWords('<p>one two three</p>')).toBe(3);
  });

  it('handles a small mixed real-world paragraph', () => {
    var doc =
      '# Notes\n\n' +
      'A **quick** paragraph with a [link](https://x.io) and `code`.\n\n' +
      '- bullet one\n' +
      '- bullet two\n\n' +
      '```\nignored code block\n```\n\n' +
      '> a quote';
    // Words: Notes / A quick paragraph with a link and code / bullet one /
    // bullet two / a quote = 1 + 8 + 2 + 2 + 2 = 15
    expect(countWords(doc)).toBe(15);
  });
});
```

- [ ] **Step 2: Run tests; verify `countWords` cases fail**

Run: `npx vitest run src/wordcount.test.js`
Expected: 12 new tests fail with "countWords is not a function" (or similar export error). The 6 `formatIndicator` tests should still pass.

- [ ] **Step 3: Implement `countWords`**

Add to `src/wordcount.js`, below `formatIndicator`:

```js
// Strip markdown syntax with a small regex pass, then count whitespace-split
// tokens. Cheap on purpose: this runs (debounced) on every keystroke for
// 30-page docs. Order of strips is significant — see design spec.
export function countWords(text) {
  if (!text) return 0;

  var s = text;

  // 1. Fenced code blocks — drop entirely (code is not prose).
  //    Matches ``` (or ~~~) opening to the next matching fence.
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/~~~[\s\S]*?~~~/g, ' ');

  // 2. HTML tags — strip the tag, keep the text inside.
  s = s.replace(/<[^>]+>/g, ' ');

  // 3. Image syntax — replace with the alt text.
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ');

  // 4. Link syntax — replace with the link label.
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, ' $1 ');

  // 5. Inline code — strip backticks, keep contents.
  s = s.replace(/`([^`]*)`/g, ' $1 ');

  // 6. Heading hashes (line-leading).
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, '');

  // 7. Blockquote markers (line-leading, possibly nested).
  s = s.replace(/^[ \t]*(?:>[ \t]*)+/gm, '');

  // 8. List markers (line-leading): -, *, +, or "N.".
  s = s.replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, '');

  // 9. Emphasis markers — doubled forms first so singles don't leave dangles.
  s = s.replace(/\*\*/g, '');
  s = s.replace(/__/g, '');
  s = s.replace(/~~/g, '');
  s = s.replace(/[*_]/g, '');

  // Final: split on whitespace and count non-empty tokens.
  var tokens = s.split(/\s+/);
  var count = 0;
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i].length > 0) count++;
  }
  return count;
}
```

- [ ] **Step 4: Run tests; verify all 18 tests pass**

Run: `npx vitest run src/wordcount.test.js`
Expected: 18/18 pass. If the mixed-paragraph test fails, verify the math by hand against the comment in the test — do not change the implementation to chase a bad expected value.

- [ ] **Step 5: Run full lint+test suite**

Run: `npm run check`
Expected: lint passes, all tests pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add src/wordcount.js src/wordcount.test.js
git commit -m "feat(wordcount): add markdown-aware countWords

Cheap regex-based markdown stripper: drops fenced code blocks, strips
HTML tags, replaces images and links with their visible text, removes
inline-code backticks, and strips heading/blockquote/list/emphasis
markers. Splits the result on whitespace. Designed to run debounced
on every keystroke without re-parsing via marked. Fully unit-tested."
```

---

## Task 3: Status-bar DOM wiring

**Files:**
- Modify: `src/template.html` (status bar markup)
- Modify: `src/style.css` (one rule)
- Modify: `src/status.js` (init + `updateWordCount`)

UI scaffolding only — no editor wiring yet. After this task, `status.js` exports a function that, when called, writes a formatted indicator to the status bar.

- [ ] **Step 1: Add the status-bar span**

Edit `src/template.html` around line 1262. Find:

```html
<div id="status-bar">
  <span id="status-mode">NORMAL</span>
  <span id="status-buffer">[No Name]</span>
  <span id="status-pos">1:1</span>
  <span id="status-flash"></span>
</div>
```

Change to:

```html
<div id="status-bar">
  <span id="status-mode">NORMAL</span>
  <span id="status-buffer">[No Name]</span>
  <span id="status-pos">1:1</span>
  <span id="status-words"></span>
  <span id="status-flash"></span>
</div>
```

- [ ] **Step 2: Add the status-bar style**

Edit `src/style.css`. After the existing `#status-pos { ... }` rule (around line 256-258), insert:

```css
#status-words {
  color: var(--status-fg);
}
```

The status bar already uses `gap: 14px` on the flex container (see `#status-bar`), so no additional margin is needed for spacing.

- [ ] **Step 3: Update `src/status.js` — add element resolution and exported function**

Find the top of `src/status.js`:

```js
// ── Status bar ──────────────────────────────────────────
var modeEl = null,
  posEl = null,
  flashEl = null,
  bufferEl = null;

export function initStatusBar() {
  modeEl = document.getElementById('status-mode');
  posEl = document.getElementById('status-pos');
  flashEl = document.getElementById('status-flash');
  bufferEl = document.getElementById('status-buffer');
}
```

Change to:

```js
// ── Status bar ──────────────────────────────────────────
var modeEl = null,
  posEl = null,
  flashEl = null,
  bufferEl = null,
  wordsEl = null;

// Cached last-rendered tuple to avoid redundant DOM writes.
var lastWordCountKey = null;

export function initStatusBar() {
  modeEl = document.getElementById('status-mode');
  posEl = document.getElementById('status-pos');
  flashEl = document.getElementById('status-flash');
  bufferEl = document.getElementById('status-buffer');
  wordsEl = document.getElementById('status-words');
  lastWordCountKey = null;
}
```

Then add a new exported function at the end of the file:

```js
import { countWords, formatIndicator } from './wordcount.js';

export function updateWordCount(text, opts) {
  var isSelection = !!(opts && opts.isSelection);
  // Cache key keys off both content and selection mode; identical inputs
  // (e.g., a selectionSet update where selection didn't actually move) skip
  // the recount and DOM write.
  var key = (isSelection ? '1\0' : '0\0') + text;
  if (key === lastWordCountKey) return;
  lastWordCountKey = key;
  var words = countWords(text);
  wordsEl.textContent = formatIndicator(words, { isSelection: isSelection });
}
```

Note: place the `import` at the top of the file with the other imports — JavaScript hoists ES `import` statements, but keep them grouped at the top to match the rest of the codebase. (`src/status.js` currently has no imports; just add the line above the `var modeEl = ...` declaration.)

- [ ] **Step 4: Build and verify it compiles**

Run: `npm run build`
Expected: clean build, `vi.html` regenerates, no esbuild warnings about unresolved imports.

- [ ] **Step 5: Run lint+test**

Run: `npm run check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/template.html src/style.css src/status.js
git commit -m "feat(wordcount): wire word-count indicator into status bar DOM

Adds <span id=\"status-words\"> after status-pos with a calm status-fg
color. status.js exports updateWordCount(text, {isSelection}) that
runs the markdown-aware counter and formatter, caching the last
input/selection tuple to skip redundant DOM writes."
```

---

## Task 4: Editor wiring with debounce + selection awareness

**Files:**
- Modify: `src/main.js`

Hook the existing `EditorView.updateListener` (where `updateStatusPos` already lives) to also drive `updateWordCount`. Doc-change recounts are debounced (~150ms idle); selection changes are unthrottled.

- [ ] **Step 1: Add the import**

Edit `src/main.js`. The existing status import (around lines 23-30) is:

```js
import {
  initStatusBar,
  updateStatusPos,
  updateBufferName,
  flash,
  updateMode,
  setStatusIndicator,
} from './status.js';
```

Add `updateWordCount`:

```js
import {
  initStatusBar,
  updateStatusPos,
  updateBufferName,
  flash,
  updateMode,
  setStatusIndicator,
  updateWordCount,
} from './status.js';
```

- [ ] **Step 2: Add the debounce timer + helper above the editor wiring**

Find the existing `EditorView.updateListener.of(...)` block (around line 141 of `main.js`). Immediately above the EditorView/EditorState construction it lives in (i.e., at the top of the section that builds the editor — search for `EditorView.updateListener.of` to find it), insert:

```js
// ── Word-count indicator wiring ─────────────────────────
// Doc-change recounts are debounced; selection-only updates are immediate.
var wordCountTimer = null;
var WORD_COUNT_DEBOUNCE_MS = 150;

function recomputeWordCount(state) {
  var sel = state.selection.main;
  if (sel.from !== sel.to) {
    updateWordCount(state.doc.sliceString(sel.from, sel.to), {
      isSelection: true,
    });
  } else {
    updateWordCount(state.doc.toString(), { isSelection: false });
  }
}
```

(If there's no obvious "above the editor wiring" anchor, place this block immediately before the `var view = new EditorView(...)` declaration. The function only references `state` which is passed in, so its position is flexible.)

- [ ] **Step 3: Hook the existing updateListener**

Find the existing listener body around line 141 of `main.js`:

```js
EditorView.updateListener.of(function (update) {
  if (update.selectionSet) {
    var pos = update.state.selection.main.head;
    var line = update.state.doc.lineAt(pos);
    updateStatusPos(line.number - 1, pos - line.from);
    // Refresh relative line numbers when cursor line changes
    if (state.relativeNumber && line.number !== lastCursorLine) {
      lastCursorLine = line.number;
      update.view.dispatch({
        effects: lineNumbersCompartment.reconfigure(
          makeLineNumbersExtension(),
        ),
      });
    }
```

Add word-count handling. The listener will end up looking like this (only the additions matter; keep the existing `selectionSet` body intact):

```js
EditorView.updateListener.of(function (update) {
  if (update.selectionSet) {
    var pos = update.state.selection.main.head;
    var line = update.state.doc.lineAt(pos);
    updateStatusPos(line.number - 1, pos - line.from);
    // Refresh relative line numbers when cursor line changes
    if (state.relativeNumber && line.number !== lastCursorLine) {
      lastCursorLine = line.number;
      update.view.dispatch({
        effects: lineNumbersCompartment.reconfigure(
          makeLineNumbersExtension(),
        ),
      });
    }
    // Selection-only updates: refresh word count immediately (cheap;
    // selection cache in updateWordCount short-circuits no-ops).
    if (!update.docChanged) {
      recomputeWordCount(update.state);
    }
  }
  if (update.docChanged) {
    // Debounce doc-change recounts: avoid scanning a 30-page doc on every
    // keystroke during a fast typing burst.
    if (wordCountTimer !== null) clearTimeout(wordCountTimer);
    var stateAtTimer = update.state;
    wordCountTimer = setTimeout(function () {
      wordCountTimer = null;
      recomputeWordCount(stateAtTimer);
    }, WORD_COUNT_DEBOUNCE_MS);
  }
}),
```

Important: the existing listener block likely ends with `}),` to close the `.of(function(update) { ... })` and add a comma for the next array element. Don't touch that closing — only add the two new branches inside the function body.

- [ ] **Step 4: Initial paint after editor init**

Find the line near the bottom of `main.js` (around line 501) that calls `updateStatusPos(initialLine.number - 1, ...)`. Right after it, add:

```js
// Initial word-count paint, so the indicator is populated before the first edit.
recomputeWordCount(view.state);
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 6: Run lint+test**

Run: `npm run check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat(wordcount): wire debounced updateListener in main.js

Doc-change recounts debounce at 150ms idle to keep typing fast on
large docs; selection-only changes refresh immediately. Visual-mode
selections show word count for the selected slice via state.selection.
Initial paint runs once after editor init."
```

---

## Task 5: Help-page documentation

**Files:**
- Modify: `src/template.html`

Per CLAUDE.md ("Adding Custom Vim Features ... add documentation for the feature to the help page"), add a short Status Bar section that explains the indicator. Slot it into the help page near the other UI sections.

- [ ] **Step 1: Add a TOC entry**

Edit `src/template.html`. The TOC section is around lines 50-60. Find:

```html
<li><a href="#s-end-of-buffer">End-of-Buffer Lines</a></li>
<li><a href="#s-folding">Folding</a></li>
```

Change to:

```html
<li><a href="#s-end-of-buffer">End-of-Buffer Lines</a></li>
<li><a href="#s-status-bar">Status Bar</a></li>
<li><a href="#s-folding">Folding</a></li>
```

- [ ] **Step 2: Add the section body**

Around line 1146-1153, find the End-of-Buffer Lines section:

```html
<h2 id="s-end-of-buffer">End-of-Buffer Lines</h2>
<p>
  Lines below the end of the document are marked with
  <code style="color: var(--tilde)">~</code>, matching vim&rsquo;s
  end-of-buffer indicator. These are not part of the document &mdash;
  they show where the file ends and empty screen space begins.
</p>

<h2 id="s-folding">Folding</h2>
```

Insert a new section between End-of-Buffer Lines and Folding:

```html
<h2 id="s-end-of-buffer">End-of-Buffer Lines</h2>
<p>
  Lines below the end of the document are marked with
  <code style="color: var(--tilde)">~</code>, matching vim&rsquo;s
  end-of-buffer indicator. These are not part of the document &mdash;
  they show where the file ends and empty screen space begins.
</p>

<h2 id="s-status-bar">Status Bar</h2>
<p>
  The bar across the bottom of the editor shows the current vim mode,
  the active buffer name, the cursor position (line:column), and a
  word count with an estimated reading time at 200 words per minute
  (e.g.&nbsp;<code>543w &middot; 3m</code>). For documents under 200
  words the reading-time estimate is omitted. When you select text in
  Visual mode, the indicator switches to count just the selection
  (e.g.&nbsp;<code>47w sel</code>).
</p>

<h2 id="s-folding">Folding</h2>
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/template.html
git commit -m "docs(help): document status bar and word-count indicator

New 'Status Bar' help section between End-of-Buffer Lines and
Folding, with TOC entry. Explains mode/buffer/position fields and
the word-count + reading-time indicator including the selection-aware
behavior in Visual mode."
```

---

## Task 6: Browser smoke test (interactive Playwright)

**Files:** none modified — verification only.

Per CLAUDE.md ("After implementation, do an interactive browser test"), run through the design spec's smoke-test list against the built `vi.html`. The test harness on `?test` is the API.

- [ ] **Step 1: Build the app**

Run: `npm run build`
Expected: `vi.html` exists and is recent.

- [ ] **Step 2: Start the local server**

In a separate terminal (or background process):

```bash
python3 -m http.server 9876 --bind 0.0.0.0
```

Per the user's instructions in `/home/claude/CLAUDE.md`: bind to `0.0.0.0` (not `127.0.0.1`) and refer to the host as `rika`, not `localhost`.

- [ ] **Step 3: Drive the test scenarios via Playwright**

Navigate Playwright to `http://rika:9876/vi.html?test`. Then run the following via `mcp__plugin_playwright_playwright__browser_evaluate` (or the equivalent), reading back `document.getElementById('status-words').textContent` after each step. **Doc-change steps must wait at least 200ms after `setDoc` before reading the indicator**, because the listener debounces at 150ms idle. Selection-only steps are immediate — no wait needed.

1. **Empty doc:** `__vi.setDoc('')`, wait 200ms → status-words reads `0w`.
2. **Two words:** `__vi.setDoc('hello world')`, wait 200ms → `2w`.
3. **Below threshold:** `__vi.setDoc(Array.from({length: 199}, (_, i) => 'word' + i).join(' '))`, wait 200ms → `199w` (no minutes).
4. **At threshold:** `__vi.setDoc(Array.from({length: 200}, (_, i) => 'word' + i).join(' '))`, wait 200ms → `200w · 1m`.
5. **Above threshold:** `__vi.setDoc(Array.from({length: 250}, (_, i) => 'word' + i).join(' '))`, wait 200ms → `250w · 2m`.
6. **Visual selection:** with the 250-word doc loaded, run `__vi.pressKeys('gg')` then `__vi.pressKey('V')` then `__vi.pressKeys('5j')`. Indicator should switch to `<n>w sel` for some n. Read back immediately; record actual n.
7. **Leave visual:** `__vi.pressKey('Escape')` → indicator returns to `250w · 2m` immediately.

If any step diverges from the expected output, debug — do not proceed to PR. The most likely failure modes:
- Debounce too short / too long → tweak `WORD_COUNT_DEBOUNCE_MS` only if the design feels wrong, not to chase a flaky test.
- Selection branch not firing → confirm `update.selectionSet` is true when entering Visual; check the selection range read.
- `marked` accidentally counting markdown syntax → see Task 2 strip order.

- [ ] **Step 4: Stop the local server**

Kill the http.server process. (No commit for this task — it's verification.)

---

## Task 7: Verification gate and PR

**Files:** none modified.

- [ ] **Step 1: Final lint + test**

Run: `npm run check`
Expected: clean.

- [ ] **Step 2: Final build**

Run: `npm run build`
Expected: `vi.html` regenerates clean.

- [ ] **Step 3: Push the feature branch**

```bash
git push -u origin feature/word-count
```

(Standing permission per `~/CLAUDE.md` — no need to confirm.)

- [ ] **Step 4: Open the PR**

```bash
gh pr create --title "Word count + reading time in status bar" --body "$(cat <<'EOF'
## Summary

Sprint 1 #2 from the product polish roadmap. Adds an ambient word
count and reading-time estimate to the status bar:

- `<n>w · <m>m` after the cursor position, e.g. `543w · 3m`.
- Reading-time estimate uses 200 wpm; hidden under 200 words.
- Selection-aware in Visual mode: switches to `<n>w sel` for the
  selected range, returns to whole-doc count when selection collapses.
- New pure-functions module `src/wordcount.js` with full Vitest
  coverage of both `countWords` (markdown-aware strip-and-split) and
  `formatIndicator`.
- CodeMirror `EditorView.updateListener` debounced at 150ms idle for
  doc changes; selection updates immediate.
- Help-page section added.

Design spec: `docs/plans/2026-04-19-word-count-design.md`.
Implementation plan: `docs/plans/2026-04-19-word-count.md`.

## Test plan

- [x] `npm run check` clean
- [x] `npm run build` clean
- [x] Browser smoke test via `?test` harness:
  - Empty doc shows `0w`
  - Threshold transitions correctly at 200 words
  - Visual selection shows `<n>w sel`, returns on Escape
EOF
)"
```

- [ ] **Step 5: Report PR URL to the user**

---

## Self-review notes

- **Spec coverage:** every behavioral bullet in the design spec maps to a task. Display format → Task 1; counter rules → Task 2; status-bar markup/style → Task 3; debounce + selection awareness → Task 4; help docs → Task 5; smoke test → Task 6.
- **No `editorAPI` change** because vim modules don't need to call into word-count code — only `main.js` does.
- **No new ESLint globals** needed — no new browser APIs (everything is `setTimeout`, `clearTimeout`, `document.getElementById`, all already in scope).
- **Unicode middle dot** (U+00B7) is used in both code and tests. Make sure your editor preserves it on save (Vitest will catch the mismatch immediately if it gets mangled).
- **No `formatoptions`-style configurability** — by design, per the spec.
