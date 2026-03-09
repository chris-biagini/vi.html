# exrc Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Replace per-feature settings/abbreviation persistence with a single exrc — a list of Ex commands in localStorage, executed on startup, edited via `:exrc`.

**Architecture:** New `src/vim/exrc.js` module handles storage, execution, and the `:exrc` editing flow. Remove persistence logic from `options.js`, `abbreviations.js`, and `storage.js`. The exrc is a plain text string in `vihtml_exrc`, parsed line-by-line and executed via `Vim.handleEx()`.

**Tech Stack:** Same as existing — `@replit/codemirror-vim` (Vim.handleEx), localStorage, vitest.

---

### Task 1: Add exrc storage helpers to storage.js

**Files:**
- Modify: `src/storage.js`
- Modify: `src/storage.test.js`

**Step 1: Write the failing tests**

Add to `src/storage.test.js`:

```javascript
describe('saveExrc / loadExrc', () => {
  test('saves and loads exrc string', () => {
    saveExrc('set ts=2\nset sw=2');
    expect(loadExrc()).toBe('set ts=2\nset sw=2');
  });

  test('returns empty string when no exrc saved', () => {
    expect(loadExrc()).toBe('');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/storage.test.js`
Expected: FAIL — `saveExrc` and `loadExrc` not exported

**Step 3: Implement saveExrc / loadExrc in storage.js**

Add to `src/storage.js`:

```javascript
var LS_EXRC = 'vihtml_exrc';

export function saveExrc(text) {
  if (!text) {
    lsRemove(LS_EXRC);
  } else {
    lsSet(LS_EXRC, text);
  }
}

export function loadExrc() {
  return lsGet(LS_EXRC) || '';
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/storage.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/storage.js src/storage.test.js
git commit -m "feat(exrc): add saveExrc/loadExrc storage helpers"
```

---

### Task 2: Remove settings and persist flag persistence from storage.js

**Files:**
- Modify: `src/storage.js`
- Modify: `src/storage.test.js`

**Step 1: Remove the functions and constants**

In `src/storage.js`, remove:
- `LS_SETTINGS` constant
- `LS_PERSIST` constant
- `saveSettings()` function
- `loadSettings()` function
- `loadPersistFlag()` function
- `savePersistFlag()` function

**Step 2: Remove the corresponding tests**

In `src/storage.test.js`, remove:
- The `saveSettings / loadSettings` describe block
- The `savePersistFlag / loadPersistFlag` describe block
- The imports for those removed functions

**Step 3: Run tests to verify they pass**

Run: `npm test -- src/storage.test.js`
Expected: PASS

**Step 4: Commit**

```bash
git add src/storage.js src/storage.test.js
git commit -m "refactor(exrc): remove settings/persist persistence from storage"
```

---

### Task 3: Remove persistence from abbreviations.js

**Files:**
- Modify: `src/vim/abbreviations.js`
- Modify: `src/vim/abbreviations.test.js`

**Step 1: Remove persistence code from abbreviations.js**

- Remove the `LS_KEY` constant
- Remove the `import { lsGet, lsSet, lsRemove } from '../storage.js'` import
- Remove `saveAbbreviations()` function
- Remove `loadAbbreviations()` function
- Remove the `loadAbbreviations()` call inside `registerAbbreviations()`
- Remove all `saveAbbreviations()` calls from the Ex command handlers (in `:abbreviate`, `:unabbreviate`, `:abclear`)

**Step 2: Update abbreviations.test.js**

- Remove the localStorage mock setup (the `store`, `mockLocalStorage`, and `beforeEach` stubGlobal)
- Remove tests: "abbreviations persist to localStorage" and ":abc removes localStorage key"
- Keep all other tests (isKeyword, extractWord, Ex command behavior tests)
- The `beforeEach` for Ex commands still needs `flashFn = vi.fn()` and `registerAbbreviations(flashFn)` and `commands.abclear()` cleanup

**Step 3: Run tests to verify they pass**

Run: `npm test -- src/vim/abbreviations.test.js`
Expected: PASS

**Step 4: Commit**

```bash
git add src/vim/abbreviations.js src/vim/abbreviations.test.js
git commit -m "refactor(exrc): remove persistence from abbreviations"
```

---

### Task 4: Remove saveSettingsFn from options.js

**Files:**
- Modify: `src/vim/options.js`

**Step 1: Remove saveSettingsFn parameter and all calls**

Change the function signature from:
```javascript
export function registerVimOptions(state, flashFn, saveSettingsFn, editorAPI) {
```
to:
```javascript
export function registerVimOptions(state, flashFn, editorAPI) {
```

Remove every `saveSettingsFn()` call from all option callbacks (number, relativenumber, tabstop, shiftwidth, expandtab, wrap, textwidth).

**Step 2: Run lint to verify**

Run: `npm run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/vim/options.js
git commit -m "refactor(exrc): remove saveSettingsFn from options"
```

---

### Task 5: Create exrc.js module with executeExrc and editing flow

**Files:**
- Create: `src/vim/exrc.js`
- Create: `src/vim/exrc.test.js`

**Step 1: Write the failing tests**

Create `src/vim/exrc.test.js`:

```javascript
import { describe, test, expect } from 'vitest';
import { parseExrc } from './exrc.js';

describe('parseExrc', () => {
  test('splits lines and trims', () => {
    expect(parseExrc('set ts=2\nset sw=2')).toEqual(['set ts=2', 'set sw=2']);
  });

  test('skips blank lines', () => {
    expect(parseExrc('set ts=2\n\nset sw=2\n')).toEqual([
      'set ts=2',
      'set sw=2',
    ]);
  });

  test('skips comment lines starting with "', () => {
    expect(parseExrc('" This is a comment\nset ts=2')).toEqual(['set ts=2']);
  });

  test('returns empty array for empty string', () => {
    expect(parseExrc('')).toEqual([]);
  });

  test('handles whitespace-only lines', () => {
    expect(parseExrc('  \n\tset ts=2\n  ')).toEqual(['set ts=2']);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/vim/exrc.test.js`
Expected: FAIL — `parseExrc` not found

**Step 3: Implement exrc.js**

Create `src/vim/exrc.js`:

```javascript
/**
 * Vim exrc
 *
 * Persistent configuration via Ex commands stored in localStorage.
 * On startup, exrc lines are executed via Vim.handleEx().
 * Edited via :exrc which opens the exrc text in the main editor.
 *
 * See: https://vimhelp.org/starting.txt.html#exrc
 */
import { Vim } from '@replit/codemirror-vim';
import { saveExrc, loadExrc } from '../storage.js';

// ── Parse exrc text into executable lines ────────────────
export function parseExrc(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map(function (line) {
      return line.trim();
    })
    .filter(function (line) {
      return line.length > 0 && line[0] !== '"';
    });
}

// ── Execute exrc lines ──────────────────────────────────
export function executeExrc(cm) {
  var text = loadExrc();
  var lines = parseExrc(text);
  for (var i = 0; i < lines.length; i++) {
    Vim.handleEx(cm, lines[i]);
  }
}

// ── Exrc editing state ──────────────────────────────────
var exrcState = {
  active: false,
  savedDoc: null,
};

export function isEditingExrc() {
  return exrcState.active;
}

// ── Register :exrc command and override :w/:q during editing ─
export function registerExrc(flashFn, editorAPI) {
  Vim.defineEx('exrc', 'exrc', function () {
    if (exrcState.active) {
      flashFn('Already editing exrc');
      return;
    }
    exrcState.active = true;
    exrcState.savedDoc = editorAPI.getDoc();
    editorAPI.setDoc(loadExrc());
    editorAPI.setStatusIndicator('exrc');
    flashFn(':wq to save, :q! to discard');
  });

  Vim.defineEx('exrcwrite', '', function () {
    if (!exrcState.active) return;
    saveExrc(editorAPI.getDoc());
    flashFn('exrc saved');
  });

  Vim.defineEx('exrcquit', '', function (_cm, params) {
    if (!exrcState.active) return;
    var bang = params && params.argString && params.argString.includes('!');
    if (!bang) {
      // :q — save first
      saveExrc(editorAPI.getDoc());
    }
    // Restore original document
    editorAPI.setDoc(exrcState.savedDoc);
    exrcState.active = false;
    exrcState.savedDoc = null;
    editorAPI.setStatusIndicator(null);
    // Re-execute exrc to apply any changes
    if (!bang) {
      executeExrc(editorAPI.getCM());
    }
  });

  Vim.defineEx('exrcwritequit', '', function (_cm) {
    if (!exrcState.active) return;
    saveExrc(editorAPI.getDoc());
    editorAPI.setDoc(exrcState.savedDoc);
    exrcState.active = false;
    exrcState.savedDoc = null;
    editorAPI.setStatusIndicator(null);
    executeExrc(editorAPI.getCM());
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/vim/exrc.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/vim/exrc.js src/vim/exrc.test.js
git commit -m "feat(exrc): add exrc module with parseExrc, executeExrc, and editing flow"
```

---

### Task 6: Wire :w/:wq/:q into exrc-aware routing in commands.js

**Files:**
- Modify: `src/vim/commands.js`

**Step 1: Update registerExCommands to accept isEditingExrc callback**

Change signature to add `exrcAPI` parameter:
```javascript
export function registerExCommands(state, flashFn, showTabFn, editorAPI, exrcAPI) {
```

**Step 2: Make :w, :wq, :q route to exrc handlers when editing exrc**

Replace the `:write` handler:
```javascript
Vim.defineEx('write', 'w', function (_cm, params) {
  if (exrcAPI && exrcAPI.isEditing()) {
    exrcAPI.write();
    return;
  }
  editorAPI.saveNow();
  flashFn('Saved');
});
```

Add `:wq` handler:
```javascript
Vim.defineEx('wq', 'wq', function (_cm) {
  if (exrcAPI && exrcAPI.isEditing()) {
    exrcAPI.writeQuit();
    return;
  }
  editorAPI.saveNow();
  flashFn('Saved');
});
```

Add `:q` and `:q!` handler:
```javascript
Vim.defineEx('quit', 'q', function (_cm, params) {
  if (exrcAPI && exrcAPI.isEditing()) {
    var bang = params && params.argString && params.argString.includes('!');
    exrcAPI.quit(bang);
    return;
  }
});
```

**Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/vim/commands.js
git commit -m "feat(exrc): route :w/:wq/:q to exrc handlers during editing"
```

---

### Task 7: Wire everything into main.js

**Files:**
- Modify: `src/vim/index.js`
- Modify: `src/main.js`

**Step 1: Export from barrel**

In `src/vim/index.js`, add:
```javascript
export { executeExrc, registerExrc, isEditingExrc } from './exrc.js';
```

**Step 2: Update main.js imports**

Remove `saveSettings`, `loadSettings`, `loadPersistFlag`, `savePersistFlag` from storage imports.
Add `saveExrc`, `loadExrc` to storage imports.
Add `executeExrc`, `registerExrc`, `isEditingExrc` to vim imports.

**Step 3: Add editorAPI methods needed by exrc**

Add to `editorAPI`:
```javascript
getDoc: function () {
  return view.state.doc.toString();
},
setDoc: function (text) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
},
getCM: function () {
  return cm;
},
setStatusIndicator: function (label) {
  // Update status bar to show exrc indicator (or clear it)
  // Implementation depends on ui.js — may add a simple function
},
```

**Step 4: Update registerVimOptions call**

Change from:
```javascript
registerVimOptions(state, flash, doSaveSettings, editorAPI);
```
to:
```javascript
registerVimOptions(state, flash, editorAPI);
```

Remove the `doSaveSettings` function entirely.

**Step 5: Register exrc and build exrcAPI for commands.js**

```javascript
registerExrc(flash, editorAPI);

var exrcAPI = {
  isEditing: isEditingExrc,
  write: function () { Vim.handleEx(cm, 'exrcwrite'); },
  writeQuit: function () { Vim.handleEx(cm, 'exrcwritequit'); },
  quit: function (bang) { Vim.handleEx(cm, 'exrcquit' + (bang ? '!' : '')); },
};

registerExCommands(state, flash, doShowTab, editorAPI, exrcAPI);
```

**Step 6: Replace settings restore block with executeExrc**

Remove lines 353-367 (the `loadPersistFlag` / `loadSettings` / apply settings block).
Replace with:
```javascript
// Execute exrc before loading content
executeExrc(cm);
```

Keep `state.persist = true` as the default (no longer loaded from flag).

**Step 7: Update persist commands to just set state (no storage)**

The `:persist` and `:nopersist` commands in commands.js — remove the `editorAPI.savePersistFlag()` calls. They just set `state.persist` now. Persistence is via exrc.

**Step 8: Also prevent content save while editing exrc**

In the `scheduleContentSave` function, add a guard:
```javascript
function scheduleContentSave() {
  if (isEditingExrc()) return;
  clearTimeout(saveTimer);
  // ...existing code...
}
```

**Step 9: Run full check**

Run: `npm run check`
Expected: PASS

**Step 10: Commit**

```bash
git add src/vim/index.js src/main.js src/vim/commands.js
git commit -m "feat(exrc): wire exrc into main.js, remove old persistence"
```

---

### Task 8: Add status bar indicator for exrc editing

**Files:**
- Modify: `src/ui.js`

**Step 1: Read ui.js to understand status bar structure**

**Step 2: Add setStatusIndicator function**

Add an exported function that shows/hides an "exrc" label in the status bar. This can be as simple as updating the mode display area or adding a small indicator span.

**Step 3: Wire editorAPI.setStatusIndicator to it in main.js**

**Step 4: Run lint**

Run: `npm run lint`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ui.js src/main.js
git commit -m "feat(exrc): add status bar indicator during exrc editing"
```

---

### Task 9: Update help page

**Files:**
- Modify: `src/template.html`

**Step 1: Add :exrc to the Ex commands table**

In the commands table, add a row for `:exrc`:
```html
<tr>
  <td><code>:exrc</code></td>
  <td>Edit startup commands (exrc)</td>
</tr>
```

Also add `:wq` and `:q` rows if not already present.

**Step 2: Add exrc section**

Add a new section after the Abbreviations section:

```html
<h2>exrc (Startup Commands)</h2>
<p>
  vi.html supports an <code>exrc</code> — a list of Ex commands
  that run on startup. Use it to persist your <code>:set</code>
  options, abbreviations, and other configuration.
</p>
<p>
  Type <code>:exrc</code> to edit your startup commands.
  The editor switches to your exrc text. Use <code>:wq</code>
  to save and apply, or <code>:q!</code> to discard changes.
</p>
<p>
  Lines starting with <code>"</code> are comments. Blank lines
  are ignored. Example:
</p>
<pre>
" My vi.html config
set ts=2
set sw=2
set noet
ab teh the
ab dont don't
</pre>
<p>
  Any valid Ex command works. Changes take effect immediately
  after saving.
</p>
```

**Step 3: Update the Persistence section**

Replace the settings persistence bullet with:
```html
<li>
  <b>Settings</b> are not auto-persisted. Use <code>:exrc</code>
  to save <code>:set</code> commands that run on startup.
</li>
```

Remove the "All settings auto-persist across sessions" text from the Options section.

**Step 4: Run build to verify HTML is valid**

Run: `npm run build`
Expected: builds without error

**Step 5: Commit**

```bash
git add src/template.html
git commit -m "docs: add exrc section to help page"
```

---

### Task 10: Final verification

**Step 1: Run full check**

Run: `npm run check`
Expected: lint + tests all pass

**Step 2: Run build**

Run: `npm run build`
Expected: `vi.html` builds successfully

**Step 3: Verify no references to old storage keys remain**

Search for `vihtml_settings`, `vihtml_abbreviations`, `vihtml_persist` in src/ — should find nothing.

**Step 4: Commit any remaining fixes, if needed**
