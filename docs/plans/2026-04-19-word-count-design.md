# Word Count + Reading Time — Design

**Status:** Brainstormed and approved. Implementation plan to follow.
**Roadmap item:** Sprint 1 #2 (`docs/plans/2026-04-19-product-polish-roadmap.md`).

## Goal

Add an ambient word count and reading-time estimate to the status bar. Calm, glanceable, always present — the kind of indicator that helps a writer feel the size of the thing they're building without ever asking for it.

## User-facing behavior

The status bar gains one new field, immediately to the right of the cursor position:

```
NORMAL  draft.md  12:4  543w · 3m
```

- **Format:** `<words>w · <minutes>m`. Middle dot, lowercase letters, no extra spacing.
- **Reading-time math:** `ceil(words / 200)`, minimum `1m`.
- **Reading-time threshold:** for documents under 200 words, the `· Nm` suffix is hidden — short fragments don't need a "1 minute" stamp. Display becomes just `42w`.
- **Empty document:** `0w`. (Not blank — the field is always present, so the column doesn't jump when the user types the first character.)
- **Selection-aware:** when the editor is in visual mode and `from !== to`, the indicator switches to count the selection: `47w sel`. The `sel` suffix replaces the reading-time component to make the mode change unmistakable. Returns to whole-document count when the selection collapses.
- **Always on.** No toggle, no `:set` option, no per-buffer override. The roadmap's "let's walk before we run" applies — we can add controls later if anyone asks.

## Architecture

Three modules touched, one new module added.

### New: `src/wordcount.js`

Pure functions. No DOM, no editor reference. Easily unit-testable in isolation, matching the project's testing convention (see CLAUDE.md → "Pure functions are exported for testability").

```js
export const WPM = 200;

export function countWords(text) { /* ... */ }
export function formatIndicator(words, { isSelection } = {}) { /* ... */ }
```

**`countWords(text)`** — strips markdown syntax with a small regex pass, then splits on whitespace. The cheap version, not a full `marked` parse: we run on every keystroke (debounced), so it has to stay fast on 30-page docs.

Strip order (each a single regex `.replace`):

1. Fenced code blocks (` ```...``` `) — replaced with empty string. Code is not prose.
2. HTML tags (`<[^>]+>`) — stripped, contents kept.
3. Image syntax (`!\[([^\]]*)\]\([^)]*\)`) — replaced with the alt text. Alt text is real prose for accessibility; the URL is noise.
4. Link syntax (`\[([^\]]*)\]\([^)]*\)`) — replaced with the link label. URL stripped.
5. Inline code (`` `([^`]*)` ``) — replaced with contents. Counted as prose; it would be in the rendered preview anyway.
6. Heading hashes (line-leading `#{1,6}\s+`) — stripped.
7. Blockquote markers (line-leading `>\s*`, possibly nested) — stripped.
8. List markers (line-leading `[-*+]\s+` and `\d+\.\s+`) — stripped.
9. Inline emphasis markers (`**`, `*`, `__`, `_`, `~~`) — stripped, contents kept. Order: strip the doubled forms before the singles so `**bold**` doesn't leave dangling `*`s.

After the strip pass: `.split(/\s+/).filter(Boolean).length`.

**`formatIndicator(words, { isSelection } = {})`** — pure formatter:

- `isSelection: true` → `"<n>w sel"`.
- `words < 200` → `"<n>w"`.
- otherwise → `"<n>w · <minutes>m"` where `minutes = Math.max(1, Math.ceil(words / WPM))`.

### Touched: `src/template.html`

Add one span after `status-pos`:

```html
<span id="status-pos">1:1</span>
<span id="status-words"></span>
```

### Touched: `src/style.css`

`#status-words` inherits the dim status-bar text color. Small left margin to separate it from `status-pos`. Same font as the rest of the bar (no fixed-width tabular-numerals tricks needed at this scale).

### Touched: `src/status.js`

```js
export function updateWordCount(text, { isSelection } = {})
```

Calls `countWords` and `formatIndicator`, writes the result to `#status-words`. Caches the last `(text, isSelection)` tuple — back-to-back identical calls (e.g., a selection-set update where selection didn't actually change) are no-ops.

Also: `initStatusBar` resolves and caches `#status-words`.

### Touched: `src/main.js`

Add a CM6 `EditorView.updateListener` that fires when `update.docChanged || update.selectionSet`.

- **Debounce doc-change recounts** with a 150ms idle timer (`setTimeout` + clear). Avoids re-scanning a 30-page doc on every keystroke during a fast typing burst.
- **Selection-only changes are unthrottled** — they're rare and only do a substring + recount. Latency from "release V-line" to "see selection count" should feel instant.
- **Read selection state:** `state.selection.main`. If `from !== to`, slice with `state.doc.sliceString(from, to)` and call with `isSelection: true`. Otherwise use the full doc string.
- **Initial paint:** call once after editor init / content load, so the indicator is populated before the first edit.

Module boundary check: vim modules don't import CM6 directly per the editorAPI pattern. The wordcount listener is wired in `main.js` (which already owns `EditorView`), so no new entry on `editorAPI` is needed.

## Testing

### Unit tests — `src/wordcount.test.js`

`countWords`:

- Plain prose: `"hello world"` → `2`.
- Empty / whitespace-only: `""` → `0`, `"   \n\n  "` → `0`.
- Heading: `"# Title"` → `1`; `"### Three Hash Heading"` → `3`.
- Bold/italic: `"**bold** _italic_ ~~strike~~"` → `3`.
- Links: `"[link text](https://example.com)"` → `2` (URL stripped).
- Images: `"![alt text](url.png)"` → `2` (alt text counted).
- Inline code: `` "use `foo()` here" `` → `3` (`foo()` counted as one word).
- Fenced code blocks: ` "```\nlots of code\n```\nreal text" ` → `2` (only "real text" counted).
- Blockquote: `"> quoted text"` → `2`.
- Nested blockquote: `"> > quoted"` → `1`.
- Unordered list: `"- item one\n- item two"` → `4`.
- Ordered list: `"1. first\n2. second"` → `2`.
- HTML: `"<br>hello<em>world</em>"` → `2` (tags stripped, contents kept).
- Mixed real document: a small representative paragraph with headings, bold, links, and a code block.

`formatIndicator`:

- `formatIndicator(0)` → `"0w"`.
- `formatIndicator(199)` → `"199w"` (under threshold, no minutes).
- `formatIndicator(200)` → `"200w · 1m"`.
- `formatIndicator(201)` → `"201w · 2m"` (rounded up).
- `formatIndicator(400)` → `"400w · 2m"`.
- `formatIndicator(47, { isSelection: true })` → `"47w sel"`.
- `formatIndicator(0, { isSelection: true })` → `"0w sel"`.

### Browser smoke test (`?test` harness)

After `npm run build` and serving locally on `0.0.0.0`, navigate Playwright to `http://rika:9876/vi.html?test`:

1. `__vi.setDoc("")` → indicator reads `0w`.
2. `__vi.setDoc("hello world")` → indicator reads `2w`.
3. Type a 250-word block via `pressSequentially` on the textbox → indicator settles to `250w · 2m` after debounce.
4. `__vi.pressKeys('gg')` then `V` then `j` → indicator switches to `Nw sel` (selection of two lines).
5. `Escape` → indicator returns to whole-document count.
6. Confirm reading-time hides under 200 words and appears at exactly 200.

(Insert-mode typing uses Playwright's `pressSequentially`, not `__vi.pressKeys`, per the known quirk in CLAUDE.md.)

## Help docs

Add a short paragraph to the help page's status-bar section:

> **Word count and reading time.** The status bar shows the document's word count and an estimated reading time (200 wpm). When you select text in visual mode, the indicator switches to count the selection.

## Out of scope

Captured here so we don't re-litigate during implementation:

- **No toggle, no `:set` option.** The indicator is small and ignorable. Add later only if requested.
- **No configurable WPM.** `200` is the consensus average and a fine default.
- **No character/byte/sentence count.** Vim's verbose `g Ctrl-G` line is not the goal — McFetridge calm is.
- **No `marked`-based counting.** Way too expensive on every keystroke for a 30-page doc.
- **No selection-aware reading time.** Selections are typically short; the `sel` suffix is more useful than `0m`.

## File touch list

- `src/wordcount.js` — new
- `src/wordcount.test.js` — new
- `src/template.html` — add `<span id="status-words">`
- `src/style.css` — style for `#status-words`
- `src/status.js` — `updateWordCount`, init
- `src/main.js` — `EditorView.updateListener` with debounce
- Help page section in `template.html` — short docs paragraph
