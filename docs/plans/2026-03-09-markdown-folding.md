# Markdown Folding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add vim-style markdown folding using CM6's built-in fold support, with `zo`/`zc`/`za`/`zR`/`zM` commands and a toggleable fold gutter.

**Architecture:** CM6 already supports markdown heading folding via `codeFolding()` + `foldGutter()` from `@codemirror/language`. We add a new `src/vim/fold.js` module that: (1) exports CM6 extensions for folding + gutter, (2) registers vim `z` commands via `Vim.defineAction`/`Vim.mapCommand`, and (3) provides a `:set foldgutter` toggle. The fold gutter uses a compartment for runtime toggling.

**Tech Stack:** `@codemirror/language` (already installed — `codeFolding`, `foldGutter`, `foldCode`, `unfoldCode`, `toggleFold`, `foldAll`, `unfoldAll`), `@replit/codemirror-vim` (Vim API)

---

### Task 1: Create fold.js with CM6 folding extensions

**Files:**
- Create: `src/vim/fold.js`

**Step 1: Create the module with folding extensions**

```js
/**
 * Markdown folding
 *
 * Provides vim-style fold commands (zo, zc, za, zR, zM) backed by CM6's
 * built-in markdown heading fold support. Fold gutter is on by default
 * and toggleable via :set foldgutter.
 *
 * See: https://vimhelp.org/fold.txt.html
 */
import { Vim } from '@replit/codemirror-vim';
import {
  codeFolding,
  foldGutter,
  foldCode,
  unfoldCode,
  toggleFold,
  foldAll,
  unfoldAll,
} from '@codemirror/language';

/**
 * Returns the CM6 codeFolding() extension with a styled placeholder.
 */
export function foldExtension() {
  return codeFolding({
    placeholderText: '\u2026',
  });
}

/**
 * Returns the CM6 foldGutter() extension.
 */
export function foldGutterExtension() {
  return foldGutter({
    openText: '\u25BE',
    closedText: '\u25B8',
  });
}

/**
 * Register vim fold commands: zo, zc, za, zR, zM.
 * Must be called after the EditorView is created.
 */
export function registerFoldCommands() {
  // zo — open fold at cursor
  // :help zo
  Vim.defineAction('foldOpen', function (_cm, _args, vim) {
    unfoldCode(vim.cm6);
  });
  Vim.mapCommand('zo', 'action', 'foldOpen');

  // zc — close fold at cursor
  // :help zc
  Vim.defineAction('foldClose', function (_cm, _args, vim) {
    foldCode(vim.cm6);
  });
  Vim.mapCommand('zc', 'action', 'foldClose');

  // za — toggle fold at cursor
  // :help za
  Vim.defineAction('foldToggle', function (_cm, _args, vim) {
    toggleFold(vim.cm6);
  });
  Vim.mapCommand('za', 'action', 'foldToggle');

  // zR — open all folds
  // :help zR
  Vim.defineAction('foldOpenAll', function (_cm, _args, vim) {
    unfoldAll(vim.cm6);
  });
  Vim.mapCommand('zR', 'action', 'foldOpenAll');

  // zM — close all folds
  // :help zM
  Vim.defineAction('foldCloseAll', function (_cm, _args, vim) {
    foldAll(vim.cm6);
  });
  Vim.mapCommand('zM', 'action', 'foldCloseAll');
}
```

**Notes:**
- The `vim` parameter passed to `defineAction` callbacks has a `cm6` property that is the CM6 `EditorView`. The CM6 fold commands (`foldCode`, `unfoldCode`, etc.) take an `EditorView` as their argument.
- If `vim.cm6` is not available, we need to find an alternative way to get the view. Check `@replit/codemirror-vim` source to confirm the action callback signature. The callback receives `(cm, actionArgs, vim)` where `vim` is the vim state object. The `cm6` property on the vim state gives us the EditorView. If this doesn't work, pass the view through `editorAPI` instead.

**Step 2: Verify it exists**

Run: `head -5 src/vim/fold.js`
Expected: The module header comment.

---

### Task 2: Integrate fold extensions into main.js

**Files:**
- Modify: `src/vim/fold.js` (if action callback signature needs adjustment)
- Modify: `src/vim/index.js`
- Modify: `src/main.js`

**Step 1: Add exports to barrel file**

In `src/vim/index.js`, add:
```js
export { foldExtension, foldGutterExtension, registerFoldCommands } from './fold.js';
```

**Step 2: Add fold gutter compartment and extensions to main.js**

In `src/main.js`:

1. Add imports — alongside existing `bracketMatching, indentUnit` import from `@codemirror/language`, there's nothing extra needed (fold.js handles its own imports). Import from the barrel:
   ```js
   // Add to existing vim/index.js imports:
   foldExtension,
   foldGutterExtension,
   registerFoldCommands,
   ```

2. Add a new compartment:
   ```js
   var foldGutterCompartment = new Compartment();
   ```

3. Add a tracking variable:
   ```js
   var currentFoldGutter = true;
   ```

4. Add extensions to the EditorView (after `tildeExtension()`):
   ```js
   foldExtension(),
   foldGutterCompartment.of(foldGutterExtension()),
   ```

5. Add `editorAPI` methods:
   ```js
   setFoldGutter: function (val) {
     currentFoldGutter = val;
     view.dispatch({
       effects: foldGutterCompartment.reconfigure(
         val ? foldGutterExtension() : [],
       ),
     });
   },
   getFoldGutter: function () {
     return currentFoldGutter;
   },
   ```

6. Add `foldgutter` to `getSettingsDisplay`:
   ```js
   'foldgutter=' + currentFoldGutter,
   ```

7. Register fold commands (after `registerMappings()`):
   ```js
   registerFoldCommands();
   ```

**Step 3: Build and verify no errors**

Run: `npm run build`
Expected: Clean build, no errors.

---

### Task 3: Add :set foldgutter option

**Files:**
- Modify: `src/vim/options.js`

**Step 1: Add the foldgutter option**

After the `spelllang` option in `registerVimOptions`, add:

```js
// :help 'foldcolumn' — we use foldgutter as a more intuitive name
Vim.defineOption('foldgutter', true, 'boolean', ['fdc'], function (val, cm) {
  if (!cm) return;
  editorAPI.setFoldGutter(val);
});
```

**Step 2: Verify option works**

Run: `npm run build`
Expected: Clean build.

---

### Task 4: Add fold placeholder CSS

**Files:**
- Modify: `src/style.css`

**Step 1: Add fold styling**

After the `.cm-searchMatch` rule (around line 161), add:

```css
/* ── Fold placeholder ────────────────────────────────── */
.cm-foldPlaceholder {
  background: #1a1e14;
  border: 1px solid #2a3a2a;
  color: var(--fg-dim);
  padding: 0 6px;
  border-radius: 3px;
  font-size: 0.85em;
  cursor: pointer;
}

/* Fold gutter markers */
.cm-foldGutter .cm-gutterElement {
  color: var(--fg-dim);
  font-size: 12px;
  padding: 0 2px;
  cursor: pointer;
  transition: color 0.15s;
}
.cm-foldGutter .cm-gutterElement:hover {
  color: var(--fg);
}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Clean build.

---

### Task 5: Add help documentation

**Files:**
- Modify: `src/template.html`

**Step 1: Add folding section to help page**

After the "End-of-Buffer Lines" section (`<h2 id="s-end-of-buffer">`), add a new section:

```html
<h2 id="s-folding">Folding</h2>
<p>
  Markdown headings can be folded to hide their content. Folding is
  <em>nested</em>: closing a heading hides everything under it,
  including sub-headings.
</p>
<table>
  <thead>
    <tr>
      <th>Command</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><kbd>zo</kbd></td>
      <td>Open fold at cursor</td>
    </tr>
    <tr>
      <td><kbd>zc</kbd></td>
      <td>Close fold at cursor</td>
    </tr>
    <tr>
      <td><kbd>za</kbd></td>
      <td>Toggle fold at cursor</td>
    </tr>
    <tr>
      <td><kbd>zR</kbd></td>
      <td>Open all folds in buffer</td>
    </tr>
    <tr>
      <td><kbd>zM</kbd></td>
      <td>Close all folds in buffer</td>
    </tr>
  </tbody>
</table>
<div class="tip">
  <b>Fold gutter:</b> Clickable fold indicators appear in the gutter
  by default. Toggle with <code>:set nofoldgutter</code> /
  <code>:set foldgutter</code>.
</div>
```

**Step 2: Add foldgutter to options table**

In the options table (around line 911, after the `spelllang` row), add:

```html
<tr>
  <td><code>foldgutter</code></td>
  <td><code>fdc</code></td>
  <td>bool</td>
  <td>on</td>
  <td>Show fold indicators in gutter</td>
</tr>
```

**Step 3: Add "Folding" to TOC**

In the `#help-toc` `<ul>`, add an entry for folding in the appropriate position (after end-of-buffer):

```html
<li><a href="#s-folding">Folding</a></li>
```

**Step 4: Build and verify**

Run: `npm run build`
Expected: Clean build.

---

### Task 6: Add ESLint globals if needed

**Files:**
- Check: `eslint.config.mjs`

**Step 1: Check if any new browser globals are used**

The fold module only uses imports from `@codemirror/language` and `@replit/codemirror-vim` — no new browser APIs. This task is likely a no-op, but verify:

Run: `npm run lint`
Expected: No new lint errors.

---

### Task 7: Browser test — verify fold commands work

**Step 1: Build and serve**

```bash
npm run build
python3 -m http.server 9876 &
```

**Step 2: Navigate Playwright to test page**

Navigate to `http://localhost:9876/vi.html?test`

**Step 3: Test fold commands**

Set up a document with headings:
```js
__vi.setDoc('# Title\n\nParagraph 1\n\n## Section A\n\nContent A\n\n## Section B\n\nContent B\n');
```

Test `zM` (close all folds):
```js
__vi.pressKeys('zM');
```
Verify: fold placeholders appear, content is hidden.

Test `zR` (open all folds):
```js
__vi.pressKeys('zR');
```
Verify: all content visible again.

Move cursor to a heading line and test `zc`/`zo`/`za`:
```js
__vi.pressKeys('gg');  // go to line 1 (# Title)
__vi.pressKeys('zc');  // close fold
// Verify fold is closed
__vi.pressKeys('zo');  // open fold
// Verify fold is open
__vi.pressKeys('za');  // toggle
// Verify fold toggles
```

Test `:set nofoldgutter` — gutter indicators should disappear.
Test `:set foldgutter` — gutter indicators should reappear.

**Step 4: Stop server**

```bash
kill %1
```

---

### Task 8: Verify action callback signature

**This is a critical verification step.** The plan assumes `Vim.defineAction` callbacks receive `(cm, actionArgs, vim)` where `vim.cm6` is the EditorView. This must be confirmed.

**Step 1: Check @replit/codemirror-vim source**

Search for `defineAction` in the installed package to understand the callback signature:

```bash
grep -n 'defineAction' node_modules/@replit/codemirror-vim/dist/index.js | head -20
```

If `vim.cm6` is NOT available, the fallback is:
1. Pass the `view` via `editorAPI.getView()` (add a `getView` method to editorAPI)
2. Use that in the action callbacks instead of `vim.cm6`

**This task should be done FIRST, before Task 1, to de-risk the implementation.**

---

### Task 9: Run full CI check

**Step 1: Run check**

```bash
npm run check
```

Expected: Lint + test + build all pass.

**Step 2: Commit**

```bash
git add src/vim/fold.js src/vim/index.js src/main.js src/vim/options.js src/style.css src/template.html
git commit -m "feat(fold): add vim-style markdown folding with zo/zc/za/zR/zM"
```

---

## Execution Order

**Do Task 8 first** (verify action callback signature), then Tasks 1–7 in order, then Task 9.

The adjusted order is: **8 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9**
