# Vim File Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Split `src/vim.js` into separate files per feature under `src/vim/`, each with a comment header and vim doc links.

**Architecture:** Create `src/vim/` directory with one file per feature. A barrel `src/vim/index.js` re-exports the public API so `main.js` imports remain unchanged. No behavior changes — pure refactor.

**Tech Stack:** ES modules, esbuild (already handles directory imports via barrel files)

---

### Task 0: Create `src/vim/textwidth.js`

**Files:**
- Create: `src/vim/textwidth.js`

**Step 1: Create the file**

Extract `handleTextwidthWrap` from `src/vim.js` (lines 1–40) into `src/vim/textwidth.js` with this header and content:

```js
/**
 * textwidth auto-wrap
 *
 * Automatically wraps lines at the configured textwidth during insert mode.
 * When a line exceeds textwidth, breaks at the last space at or before the
 * limit and preserves indentation on the new line.
 *
 * See: https://vimhelp.org/options.txt.html#%27textwidth%27
 * See: https://vimhelp.org/change.txt.html#auto-format
 */

export function handleTextwidthWrap(cm, changeObj, state) {
  // ... existing implementation verbatim from vim.js lines 5-39
}
```

No imports needed — this function only uses the `cm` and `state` arguments.

---

### Task 1: Create `src/vim/gq.js`

**Files:**
- Create: `src/vim/gq.js`

**Step 1: Create the file**

Extract `reflowRange`, `wordWrap`, and the `hardWrap` operator registration + `gq` mapping from `src/vim.js` into `src/vim/gq.js`:

```js
/**
 * gq reflow operator
 *
 * Implements the gq operator for reformatting/reflowing text to a given width.
 * Uses textwidth if set, otherwise defaults to 79 columns. Handles multiple
 * paragraphs separated by blank lines, preserves indentation.
 *
 * See: https://vimhelp.org/change.txt.html#gq
 * See: https://vimhelp.org/options.txt.html#%27textwidth%27
 */
import { Vim } from '@replit/codemirror-vim';
```

Contains:
- `reflowRange(cm, fromLine, toLine, width)` — module-private helper
- `wordWrap(text, width, indent)` — module-private helper
- `export function registerGqOperator(state)` — wraps the `Vim.defineOperator('hardWrap', ...)` and `Vim.mapCommand('gq', ...)` calls. Takes `state` to read `state.textwidth`.

---

### Task 2: Create `src/vim/arrow-clamp.js`

**Files:**
- Create: `src/vim/arrow-clamp.js`

**Step 1: Create the file**

Extract the arrow key clamping logic from `src/vim.js` (lines 229–246):

```js
/**
 * Arrow key clamping
 *
 * Prevents left/right arrow keys from wrapping across lines in insert mode,
 * matching vim's default behavior. In vim, left arrow at column 0 stays put
 * and right arrow at end of line stays put (unless whichwrap is configured).
 *
 * See: https://vimhelp.org/options.txt.html#%27whichwrap%27
 */
import { Vim } from '@replit/codemirror-vim';
```

Contains:
- `clampedArrow(dir)` — module-private helper
- `export function registerArrowClamp()` — wraps the `Vim.defineAction` and `Vim.mapCommand` calls

---

### Task 3: Create `src/vim/options.js`

**Files:**
- Create: `src/vim/options.js`

**Step 1: Create the file**

Extract all `Vim.defineOption` calls from `src/vim.js` (lines 109–151):

```js
/**
 * Vim options
 *
 * Registers vim-compatible :set options (number, relativenumber, tabstop,
 * shiftwidth, expandtab, wrap, textwidth) using Vim.defineOption. Each option
 * dispatches to the editor API to reconfigure CodeMirror compartments and
 * persists settings to localStorage.
 *
 * See: https://vimhelp.org/options.txt.html
 */
import { Vim } from '@replit/codemirror-vim';
```

Contains:
- `export function registerVimOptions(state, flashFn, saveSettingsFn, editorAPI)` — wraps all `Vim.defineOption` calls

---

### Task 4: Create `src/vim/commands.js`

**Files:**
- Create: `src/vim/commands.js`

**Step 1: Create the file**

Extract all `Vim.defineEx` calls from `src/vim.js` (lines 153–199):

```js
/**
 * Ex commands
 *
 * Registers custom Ex commands for the editor. These are app-specific commands
 * (not standard vim) that provide editor functionality through the : command line.
 * Includes :write, :edit, :preview, :help, :clear, :persist, :settings, :toggle.
 *
 * See: https://vimhelp.org/map.txt.html#%3Acommand
 */
import { Vim } from '@replit/codemirror-vim';
```

Contains:
- `export function registerExCommands(state, flashFn, showTabFn, editorAPI)` — wraps all `Vim.defineEx` calls

---

### Task 5: Create `src/vim/mappings.js`

**Files:**
- Create: `src/vim/mappings.js`

**Step 1: Create the file**

Extract the `\p` mapping from `src/vim.js` (line 249):

```js
/**
 * Custom key mappings
 *
 * Registers custom normal-mode key mappings. Currently maps \p to :toggle
 * for quickly switching between editor and preview.
 *
 * See: https://vimhelp.org/map.txt.html#%3Amap
 */
import { Vim } from '@replit/codemirror-vim';

export function registerMappings() {
  Vim.map('\\p', ':toggle<CR>', 'normal');
}
```

---

### Task 6: Create `src/vim/index.js` barrel and update `main.js`

**Files:**
- Create: `src/vim/index.js`
- Modify: `src/main.js:11` (update import path)
- Delete: `src/vim.js`

**Step 1: Create barrel file**

```js
/**
 * Vim customizations barrel
 *
 * Re-exports all vim feature modules. main.js imports from here.
 */
export { handleTextwidthWrap } from './textwidth.js';
export { registerGqOperator } from './gq.js';
export { registerArrowClamp } from './arrow-clamp.js';
export { registerVimOptions } from './options.js';
export { registerExCommands } from './commands.js';
export { registerMappings } from './mappings.js';
```

**Step 2: Update `main.js` import**

Change line 11 from:
```js
import { handleTextwidthWrap, registerVimConfig } from './vim.js';
```
to:
```js
import { handleTextwidthWrap, registerGqOperator, registerArrowClamp, registerVimOptions, registerExCommands, registerMappings } from './vim/index.js';
```

**Step 3: Update `main.js` registration call**

Replace the single `registerVimConfig(...)` call (line 265) with individual calls:
```js
registerVimOptions(state, flash, doSaveSettings, editorAPI);
registerExCommands(state, flash, doShowTab, editorAPI);
registerGqOperator(state);
registerArrowClamp();
registerMappings();
```

**Step 4: Delete `src/vim.js`**

Remove the old monolithic file.

---

### Task 7: Build and verify

**Step 1: Run build**

```bash
npm run build
```

Expected: Successful build, no errors.

**Step 2: Verify output size is similar**

The output `vi.html` should be approximately the same size (~880KB).

**Step 3: Commit**

```bash
git add src/vim/ src/main.js
git rm src/vim.js
git commit -m "refactor: split vim.js into separate feature files

Organize vim enhancements into separate files under src/vim/,
each with a comment header and links to vim documentation.

Closes #1"
```
