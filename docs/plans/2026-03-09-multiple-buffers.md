# Multiple Buffers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add vim-like multiple named buffers stored in localStorage, with `:e`, `:b`, `:ls`, `:bd`, `:saveas`, `:f`, `Ctrl-^` commands and persistent buffer name in the status bar.

**Architecture:** Replace the single-document storage model (`vihtml_content`/`vihtml_content_ttl`) with a JSON blob (`vi_buffers`) holding all buffer contents+cursors and a session key (`vi_session`) tracking current/alternate buffer. A new `src/vim/buffers.js` module owns buffer state and switching logic. Existing `storage.js` is gutted and rebuilt. Commands in `commands.js` are updated to delegate to the buffer module.

**Tech Stack:** Same as existing — ES modules bundled by esbuild, Vitest for unit tests, Playwright for browser tests.

---

### Task 0: Rewrite storage.js for multi-buffer persistence

**Files:**
- Modify: `src/storage.js` (complete rewrite)
- Test: `src/storage.test.js` (complete rewrite)

**Step 1: Write the failing tests**

Replace `src/storage.test.js` with tests for the new API:

```js
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  loadBuffers,
  saveBuffers,
  loadSession,
  saveSession,
  saveExrc,
  loadExrc,
  lsGet,
  lsSet,
  lsRemove,
} from './storage.js';

const store = {};
const mockLocalStorage = {
  getItem: vi.fn((k) => (k in store ? store[k] : null)),
  setItem: vi.fn((k, v) => { store[k] = String(v); }),
  removeItem: vi.fn((k) => { delete store[k]; }),
};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', mockLocalStorage);
});

describe('lsGet / lsSet / lsRemove', () => {
  test('lsSet stores and lsGet retrieves', () => {
    lsSet('key', 'value');
    expect(lsGet('key')).toBe('value');
  });
  test('lsGet returns null for missing key', () => {
    expect(lsGet('missing')).toBeNull();
  });
  test('lsRemove deletes key', () => {
    lsSet('key', 'value');
    lsRemove('key');
    expect(lsGet('key')).toBeNull();
  });
});

describe('loadBuffers / saveBuffers', () => {
  test('returns empty object when nothing saved', () => {
    expect(loadBuffers()).toEqual({});
  });
  test('round-trips buffer data', () => {
    const bufs = {
      'notes.md': { content: 'hello', cursor: { line: 0, ch: 0 } },
      '': { content: 'unnamed', cursor: { line: 2, ch: 5 } },
    };
    saveBuffers(bufs);
    expect(loadBuffers()).toEqual(bufs);
  });
  test('returns empty object on corrupt JSON', () => {
    lsSet('vi_buffers', '{bad json');
    expect(loadBuffers()).toEqual({});
  });
});

describe('loadSession / saveSession', () => {
  test('returns default session when nothing saved', () => {
    expect(loadSession()).toEqual({ current: '', alternate: null });
  });
  test('round-trips session data', () => {
    const sess = { current: 'notes.md', alternate: 'todo.md' };
    saveSession(sess);
    expect(loadSession()).toEqual(sess);
  });
});

describe('saveExrc / loadExrc', () => {
  test('saves and loads exrc string', () => {
    saveExrc('set ts=2');
    expect(loadExrc()).toBe('set ts=2');
  });
  test('returns empty string when no exrc saved', () => {
    expect(loadExrc()).toBe('');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/storage.test.js`
Expected: FAIL — `loadBuffers`, `saveBuffers`, `loadSession`, `saveSession` don't exist yet.

**Step 3: Rewrite storage.js**

Replace `src/storage.js` with:

```js
// ── Constants ───────────────────────────────────────────
var LS_BUFFERS = 'vi_buffers';
var LS_SESSION = 'vi_session';
var LS_EXRC = 'vihtml_exrc';

// ── localStorage helpers ────────────────────────────────
export function lsGet(k) {
  try { return localStorage.getItem(k); } catch (_e) { return null; }
}
export function lsSet(k, v) {
  try { localStorage.setItem(k, v); } catch (_e) { /* ignore */ }
}
export function lsRemove(k) {
  try { localStorage.removeItem(k); } catch (_e) { /* ignore */ }
}

// ── Buffer persistence ──────────────────────────────────
export function loadBuffers() {
  var raw = lsGet(LS_BUFFERS);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_e) { return {}; }
}

export function saveBuffers(buffers) {
  lsSet(LS_BUFFERS, JSON.stringify(buffers));
}

// ── Session persistence ─────────────────────────────────
export function loadSession() {
  var raw = lsGet(LS_SESSION);
  if (!raw) return { current: '', alternate: null };
  try { return JSON.parse(raw); } catch (_e) { return { current: '', alternate: null }; }
}

export function saveSession(session) {
  lsSet(LS_SESSION, JSON.stringify(session));
}

// ── Exrc persistence ────────────────────────────────────
export function saveExrc(text) {
  if (!text) { lsRemove(LS_EXRC); } else { lsSet(LS_EXRC, text); }
}

export function loadExrc() {
  return lsGet(LS_EXRC) || '';
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/storage.test.js`
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/storage.js src/storage.test.js
git commit -m "feat(storage): rewrite for multi-buffer persistence"
```

---

### Task 1: Create buffers.js — buffer state manager

**Files:**
- Create: `src/vim/buffers.js`
- Test: `src/vim/buffers.test.js`

This module owns all buffer state (the in-memory buffer list, current/alternate tracking, switching logic). It does NOT import CM6 — it communicates with the editor via callbacks passed at init time.

**Step 1: Write the failing tests**

Create `src/vim/buffers.test.js`:

```js
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createBufferManager } from './buffers.js';

function makeManager(opts = {}) {
  const saved = opts.buffers || {};
  const session = opts.session || { current: '', alternate: null };
  const flashed = [];
  const editorDoc = { text: '' };
  const editorCursor = { line: 0, ch: 0 };

  const mgr = createBufferManager({
    loadBuffers: () => structuredClone(saved),
    saveBuffers: vi.fn(),
    loadSession: () => structuredClone(session),
    saveSession: vi.fn(),
    getDoc: () => editorDoc.text,
    setDoc: vi.fn((t) => { editorDoc.text = t; }),
    getCursor: () => ({ ...editorCursor }),
    setCursor: vi.fn((l, c) => { editorCursor.line = l; editorCursor.ch = c; }),
    flash: vi.fn((msg, dur) => flashed.push(msg)),
    updateBufferDisplay: vi.fn(),
  });

  return { mgr, editorDoc, editorCursor, flashed };
}

describe('init', () => {
  test('starts with [No Name] buffer when no saved state', () => {
    const { mgr } = makeManager();
    expect(mgr.currentName()).toBe('');
    expect(mgr.alternateName()).toBeNull();
  });

  test('restores saved session', () => {
    const { mgr, editorDoc } = makeManager({
      buffers: {
        'notes.md': { content: 'hello', cursor: { line: 1, ch: 0 } },
      },
      session: { current: 'notes.md', alternate: null },
    });
    expect(mgr.currentName()).toBe('notes.md');
    expect(editorDoc.text).toBe('hello');
  });
});

describe('switchBuffer', () => {
  test('creates new buffer on :e newfile', () => {
    const { mgr } = makeManager();
    mgr.switchBuffer('newfile');
    expect(mgr.currentName()).toBe('newfile');
  });

  test('sets alternate to previous buffer', () => {
    const { mgr } = makeManager();
    mgr.switchBuffer('a');
    mgr.switchBuffer('b');
    expect(mgr.alternateName()).toBe('a');
  });

  test('persists previous buffer content on switch', () => {
    const { mgr, editorDoc } = makeManager();
    editorDoc.text = 'content of unnamed';
    mgr.switchBuffer('other');
    const bufs = mgr.getBuffers();
    expect(bufs[''].content).toBe('content of unnamed');
  });
});

describe('switchAlternate', () => {
  test('switches to alternate buffer', () => {
    const { mgr } = makeManager();
    mgr.switchBuffer('a');
    mgr.switchBuffer('b');
    mgr.switchAlternate();
    expect(mgr.currentName()).toBe('a');
    expect(mgr.alternateName()).toBe('b');
  });

  test('flashes error when no alternate', () => {
    const { mgr, flashed } = makeManager();
    mgr.switchAlternate();
    expect(flashed).toContain('E23: No alternate file');
  });
});

describe('saveCurrentBuffer', () => {
  test('persists content to storage', () => {
    const { mgr, editorDoc } = makeManager();
    editorDoc.text = 'updated';
    mgr.saveCurrentBuffer();
    const bufs = mgr.getBuffers();
    expect(bufs[''].content).toBe('updated');
  });
});

describe('writeBuffer (name current buffer)', () => {
  test(':w name on unnamed buffer renames it', () => {
    const { mgr } = makeManager();
    mgr.writeBuffer('myfile');
    expect(mgr.currentName()).toBe('myfile');
    // Old unnamed slot should be gone
    expect(mgr.getBuffers()['']).toBeUndefined();
  });

  test(':w name on named buffer acts as saveas', () => {
    const { mgr, editorDoc } = makeManager();
    editorDoc.text = 'original';
    mgr.switchBuffer('first');
    editorDoc.text = 'first content';
    mgr.writeBuffer('copy');
    expect(mgr.currentName()).toBe('copy');
    expect(mgr.getBuffers()['first'].content).toBe('first content');
    expect(mgr.getBuffers()['copy'].content).toBe('first content');
  });
});

describe('renameBuffer', () => {
  test('renames current buffer', () => {
    const { mgr } = makeManager();
    mgr.switchBuffer('old');
    mgr.renameBuffer('new');
    expect(mgr.currentName()).toBe('new');
    expect(mgr.getBuffers()['old']).toBeUndefined();
  });
});

describe('deleteBuffer', () => {
  test('deletes named buffer and switches to alternate', () => {
    const { mgr } = makeManager();
    mgr.switchBuffer('a');
    mgr.switchBuffer('b');
    mgr.deleteBuffer('b');
    expect(mgr.currentName()).toBe('a');
    expect(mgr.getBuffers()['b']).toBeUndefined();
  });

  test('refuses to delete last buffer', () => {
    const { mgr, flashed } = makeManager();
    mgr.deleteBuffer('');
    expect(flashed).toContain('E84: No modified buffers');
    expect(mgr.currentName()).toBe('');
  });

  test('deletes non-current buffer without switching', () => {
    const { mgr } = makeManager();
    mgr.switchBuffer('a');
    mgr.switchBuffer('b');
    mgr.deleteBuffer('a');
    expect(mgr.currentName()).toBe('b');
    expect(mgr.getBuffers()['a']).toBeUndefined();
  });
});

describe('listBuffers', () => {
  test('returns formatted buffer list', () => {
    const { mgr } = makeManager();
    mgr.switchBuffer('a');
    mgr.switchBuffer('b');
    const list = mgr.listBuffers();
    expect(list).toContain('%');  // current marker
    expect(list).toContain('#');  // alternate marker
    expect(list).toContain('"b"');
    expect(list).toContain('"a"');
  });
});

describe('saveas', () => {
  test('copies current content to new name', () => {
    const { mgr, editorDoc } = makeManager();
    editorDoc.text = 'content';
    mgr.saveas('copy');
    expect(mgr.currentName()).toBe('copy');
    expect(mgr.getBuffers()['copy'].content).toBe('content');
    // Original unnamed buffer still exists
    expect(mgr.getBuffers()['']).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/vim/buffers.test.js`
Expected: FAIL — module doesn't exist.

**Step 3: Implement buffers.js**

Create `src/vim/buffers.js`:

```js
/**
 * Buffer manager
 *
 * Manages multiple named buffers in localStorage. Each buffer has content
 * and cursor position. Communicates with the editor through callback functions
 * passed at init time (no CM6 imports).
 *
 * See: :help buffers
 */

export function createBufferManager(opts) {
  var loadBuffersFn = opts.loadBuffers;
  var saveBuffersFn = opts.saveBuffers;
  var loadSessionFn = opts.loadSession;
  var saveSessionFn = opts.saveSession;
  var getDoc = opts.getDoc;
  var setDoc = opts.setDoc;
  var getCursor = opts.getCursor;
  var setCursor = opts.setCursor;
  var flashFn = opts.flash;
  var updateBufferDisplay = opts.updateBufferDisplay;

  // In-memory state
  var buffers = loadBuffersFn();
  var session = loadSessionFn();
  var currentName = session.current;
  var alternateName = session.alternate || null;

  // Ensure current buffer exists in memory
  if (!(currentName in buffers)) {
    buffers[currentName] = { content: '', cursor: { line: 0, ch: 0 } };
  }

  // Load current buffer into editor
  setDoc(buffers[currentName].content);
  var cur = buffers[currentName].cursor;
  setCursor(cur.line, cur.ch);
  updateBufferDisplay(displayName(currentName));

  function displayName(name) {
    return name === '' ? '[No Name]' : name;
  }

  function persistState() {
    saveBuffersFn(buffers);
    saveSessionFn({ current: currentName, alternate: alternateName });
  }

  function snapshotCurrent() {
    buffers[currentName] = {
      content: getDoc(),
      cursor: getCursor(),
    };
  }

  function loadBuffer(name) {
    var buf = buffers[name];
    if (buf) {
      setDoc(buf.content);
      setCursor(buf.line || buf.cursor.line, buf.ch || buf.cursor.ch);
    } else {
      setDoc('');
      setCursor(0, 0);
    }
  }

  function doSwitch(name) {
    if (name === currentName) return;
    snapshotCurrent();
    var prevName = currentName;
    flashFn('"' + displayName(currentName) + '" written');
    alternateName = prevName;
    currentName = name;
    if (!(name in buffers)) {
      buffers[name] = { content: '', cursor: { line: 0, ch: 0 } };
    }
    loadBuffer(name);
    updateBufferDisplay(displayName(name));
    persistState();
  }

  var mgr = {
    currentName: function () { return currentName; },
    alternateName: function () { return alternateName; },
    getBuffers: function () { return buffers; },

    switchBuffer: function (name) {
      doSwitch(name);
    },

    switchAlternate: function () {
      if (alternateName === null) {
        flashFn('E23: No alternate file');
        return;
      }
      doSwitch(alternateName);
    },

    saveCurrentBuffer: function () {
      snapshotCurrent();
      persistState();
    },

    writeBuffer: function (name) {
      snapshotCurrent();
      if (currentName === '') {
        // Naming an unnamed buffer
        var content = buffers[''];
        delete buffers[''];
        buffers[name] = content;
        currentName = name;
        updateBufferDisplay(displayName(name));
      } else {
        // Named buffer: saveas behavior
        buffers[name] = {
          content: getDoc(),
          cursor: getCursor(),
        };
        alternateName = currentName;
        currentName = name;
        updateBufferDisplay(displayName(name));
      }
      persistState();
      flashFn('"' + displayName(name) + '" written');
    },

    saveas: function (name) {
      snapshotCurrent();
      buffers[name] = {
        content: getDoc(),
        cursor: getCursor(),
      };
      alternateName = currentName;
      currentName = name;
      updateBufferDisplay(displayName(name));
      persistState();
      flashFn('"' + displayName(name) + '" written');
    },

    renameBuffer: function (name) {
      snapshotCurrent();
      var old = currentName;
      var content = buffers[old];
      delete buffers[old];
      buffers[name] = content;
      currentName = name;
      // Update alternate if it pointed to old name
      if (alternateName === old) alternateName = name;
      updateBufferDisplay(displayName(name));
      persistState();
      flashFn('"' + displayName(old) + '" renamed to "' + displayName(name) + '"');
    },

    deleteBuffer: function (name) {
      if (name === undefined || name === null) name = currentName;
      var names = Object.keys(buffers);
      if (names.length <= 1) {
        flashFn('E84: No modified buffers');
        return;
      }
      if (!(name in buffers)) {
        flashFn('E94: No matching buffer for ' + name);
        return;
      }
      if (name === currentName) {
        // Switch to alternate, or first other buffer
        var target = alternateName && alternateName !== name && alternateName in buffers
          ? alternateName
          : names.find(function (n) { return n !== name; });
        delete buffers[name];
        if (alternateName === name) alternateName = null;
        currentName = target;
        loadBuffer(target);
        updateBufferDisplay(displayName(target));
      } else {
        delete buffers[name];
        if (alternateName === name) alternateName = null;
      }
      persistState();
      flashFn('Buffer "' + displayName(name) + '" deleted');
    },

    listBuffers: function () {
      var names = Object.keys(buffers);
      // Snapshot current so line numbers are up to date
      snapshotCurrent();
      var lines = names.map(function (name, i) {
        var num = String(i + 1);
        while (num.length < 3) num = ' ' + num;
        var indicators = '';
        if (name === currentName) indicators += '%a';
        else if (name === alternateName) indicators += '#';
        while (indicators.length < 4) indicators += ' ';
        var dn = '"' + displayName(name) + '"';
        var line = buffers[name].cursor ? buffers[name].cursor.line + 1 : 1;
        return num + ' ' + indicators + dn + '    line ' + line;
      });
      return lines.join('\n');
    },
  };

  return mgr;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/vim/buffers.test.js`
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/vim/buffers.js src/vim/buffers.test.js
git commit -m "feat(buffers): add buffer manager module with tests"
```

---

### Task 2: Add buffer name to status bar

**Files:**
- Modify: `src/template.html:991-994` (add `#status-buffer` span)
- Modify: `src/style.css:162-207` (add `#status-buffer` style)
- Modify: `src/ui.js` (add `updateBufferName` export)

**Step 1: Add the DOM element to template.html**

In `src/template.html`, change the status bar from:

```html
      <div id="status-bar">
        <span id="status-mode">NORMAL</span>
        <span id="status-pos">1:1</span>
        <span id="status-flash"></span>
      </div>
```

to:

```html
      <div id="status-bar">
        <span id="status-mode">NORMAL</span>
        <span id="status-buffer">[No Name]</span>
        <span id="status-pos">1:1</span>
        <span id="status-flash"></span>
      </div>
```

**Step 2: Add CSS for `#status-buffer`**

In `src/style.css`, after the `#status-mode.replace` block (~line 192), add:

```css
#status-buffer {
  color: var(--status-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
```

**Step 3: Add `updateBufferName` to ui.js**

In `src/ui.js`, add a cached ref and export:

```js
var bufferEl = null;

// In initStatusBar():
bufferEl = document.getElementById('status-buffer');

export function updateBufferName(name) {
  bufferEl.textContent = name;
}
```

**Step 4: Verify build works**

Run: `npm run build`
Expected: builds without errors.

**Step 5: Commit**

```bash
git add src/template.html src/style.css src/ui.js
git commit -m "feat(ui): add buffer name display to status bar"
```

---

### Task 3: Integrate buffer manager into main.js

**Files:**
- Modify: `src/main.js` (replace single-doc storage with buffer manager)
- Modify: `src/vim/index.js` (re-export from buffers.js)

This is the main integration task. Replace the old `saveContent`/`loadContent` flow with the buffer manager.

**Step 1: Update imports in main.js**

Remove old imports:
```js
import { saveContent, loadContent, clearContent, refreshTTL } from './storage.js';
```

Add new imports:
```js
import { loadBuffers, saveBuffers, loadSession, saveSession } from './storage.js';
import { updateBufferName } from './ui.js';
```

And add to the vim/index.js imports:
```js
import { createBufferManager } from './vim/buffers.js';
```

**Step 2: Replace the old content save/load with buffer manager**

After the editor view is created and cm is obtained (around line 197), create the buffer manager:

```js
var bufferManager = createBufferManager({
  loadBuffers: loadBuffers,
  saveBuffers: saveBuffers,
  loadSession: loadSession,
  saveSession: saveSession,
  getDoc: function () { return view.state.doc.toString(); },
  setDoc: function (text) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    });
  },
  getCursor: function () {
    var pos = view.state.selection.main.head;
    var line = view.state.doc.lineAt(pos);
    return { line: line.number - 1, ch: pos - line.from };
  },
  setCursor: function (line, ch) {
    var lineInfo = view.state.doc.line(line + 1);
    var pos = lineInfo.from + Math.min(ch, lineInfo.length);
    view.dispatch({ selection: { anchor: pos } });
  },
  flash: flash,
  updateBufferDisplay: updateBufferName,
});
```

**Step 3: Update `scheduleContentSave` to use buffer manager**

Replace:
```js
function scheduleContentSave() {
  if (isEditingExrc()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    saveContent(view.state.doc.toString(), state.persist);
  }, 1000);
}
```

With:
```js
function scheduleContentSave() {
  if (isEditingExrc()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    if (state.persist) bufferManager.saveCurrentBuffer();
  }, 1000);
}
```

**Step 4: Update editorAPI**

Replace the old `saveNow`, `reloadContent`, `clearSaved`, `getDoc`, `setDoc` methods to delegate to bufferManager:

```js
saveNow: function () {
  bufferManager.saveCurrentBuffer();
},
reloadContent: function () {
  // Reload current buffer from storage
  var bufs = loadBuffers();
  var name = bufferManager.currentName();
  if (name in bufs) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: bufs[name].content },
    });
    flash('Reloaded');
  } else {
    flash('No saved content');
  }
},
clearSaved: function () {
  // Not meaningful with buffers — could clear current buffer content
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: '' },
  });
  flash('Buffer cleared');
},
```

Add `bufferManager` to editorAPI so commands.js can access it:

```js
bufferManager: bufferManager,
```

**Step 5: Remove old content load at bottom of main.js**

Remove:
```js
var savedContent = loadContent();
if (savedContent !== null) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: savedContent },
  });
}
```

The buffer manager's constructor already loads the current buffer into the editor.

**Step 6: Update test harness**

In `src/test-harness.js`, the `setDoc`/`getDoc` already go through `editorAPI` indirectly. No changes needed, but expose `bufferManager` on `__vi` for testing:

In `main.js`, pass `bufferManager` to `installTestHarness`. In `test-harness.js`, add:
```js
window.__vi.bufferManager = bufferManager;
```

**Step 7: Verify build works**

Run: `npm run build`
Expected: builds without errors.

**Step 8: Commit**

```bash
git add src/main.js src/vim/index.js src/test-harness.js
git commit -m "feat(main): integrate buffer manager, replace single-doc storage"
```

---

### Task 4: Update Ex commands for buffer operations

**Files:**
- Modify: `src/vim/commands.js`

**Step 1: Update `:edit` to support `:e name`**

Replace the current `:edit` handler:
```js
Vim.defineEx('edit', 'e', function (_cm, params) {
  var name = params && params.argString ? params.argString.trim() : '';
  var mgr = editorAPI.bufferManager;
  if (!name) {
    editorAPI.reloadContent();
  } else {
    mgr.switchBuffer(name);
  }
});
```

**Step 2: Update `:write` to support `:w name`**

Replace the current `:write` handler:
```js
Vim.defineEx('write', 'w', function (_cm, params) {
  if (exrcAPI && exrcAPI.isEditing()) {
    exrcAPI.write();
    return;
  }
  var name = params && params.argString ? params.argString.trim() : '';
  var mgr = editorAPI.bufferManager;
  if (name) {
    mgr.writeBuffer(name);
  } else {
    mgr.saveCurrentBuffer();
    flashFn('"' + (mgr.currentName() || '[No Name]') + '" written');
  }
});
```

**Step 3: Add new buffer commands**

```js
Vim.defineEx('buffer', 'b', function (_cm, params) {
  var arg = params && params.argString ? params.argString.trim() : '';
  var mgr = editorAPI.bufferManager;
  if (arg === '#') {
    mgr.switchAlternate();
  } else if (arg) {
    mgr.switchBuffer(arg);
  } else {
    flashFn('"' + (mgr.currentName() || '[No Name]') + '"');
  }
});

Vim.defineEx('ls', 'ls', function (_cm) {
  flashFn(editorAPI.bufferManager.listBuffers(), 8000);
});

Vim.defineEx('buffers', 'buffers', function (_cm) {
  flashFn(editorAPI.bufferManager.listBuffers(), 8000);
});

Vim.defineEx('bdelete', 'bd', function (_cm, params) {
  var name = params && params.argString ? params.argString.trim() : undefined;
  editorAPI.bufferManager.deleteBuffer(name || undefined);
});

Vim.defineEx('saveas', 'sav', function (_cm, params) {
  var name = params && params.argString ? params.argString.trim() : '';
  if (!name) {
    flashFn('E471: Argument required');
    return;
  }
  editorAPI.bufferManager.saveas(name);
});

Vim.defineEx('file', 'f', function (_cm, params) {
  var name = params && params.argString ? params.argString.trim() : '';
  if (!name) {
    // No arg: show current file name (like vim)
    var mgr = editorAPI.bufferManager;
    flashFn('"' + (mgr.currentName() || '[No Name]') + '"');
    return;
  }
  editorAPI.bufferManager.renameBuffer(name);
});
```

**Step 4: Add `Ctrl-^` mapping**

In `src/vim/mappings.js`, add:
```js
Vim.map('<C-^>', ':b#<CR>', 'normal');
```

Note: `@replit/codemirror-vim` may need `<C-6>` instead — test both.

**Step 5: Verify build + lint**

Run: `npm run check`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/vim/commands.js src/vim/mappings.js
git commit -m "feat(commands): add buffer Ex commands (:e, :b, :ls, :bd, :sav, :f, Ctrl-^)"
```

---

### Task 5: Update `:wq` and `:clear` for buffers

**Files:**
- Modify: `src/vim/commands.js`

**Step 1: Update `:wq`**

```js
Vim.defineEx('wq', 'wq', function (_cm) {
  if (exrcAPI && exrcAPI.isEditing()) {
    exrcAPI.writeQuit();
    return;
  }
  var mgr = editorAPI.bufferManager;
  mgr.saveCurrentBuffer();
  flashFn('"' + (mgr.currentName() || '[No Name]') + '" written');
});
```

**Step 2: Update `:clear`**

`:clear` should delete all buffers and start fresh:

```js
Vim.defineEx('clear', '', function (_cm) {
  // Wipe all buffers and start fresh
  var mgr = editorAPI.bufferManager;
  // Save empty state
  editorAPI.setDoc('');
  // Reset through storage directly
  var emptyBufs = { '': { content: '', cursor: { line: 0, ch: 0 } } };
  editorAPI.bufferManager.reset(emptyBufs);
  flashFn('All buffers cleared');
});
```

This requires adding a `reset` method to `buffers.js`:

```js
reset: function (newBuffers) {
  buffers = newBuffers || { '': { content: '', cursor: { line: 0, ch: 0 } } };
  currentName = '';
  alternateName = null;
  setDoc(buffers[''].content);
  setCursor(0, 0);
  updateBufferDisplay(displayName(''));
  persistState();
},
```

Add a test for `reset` in `buffers.test.js`.

**Step 3: Commit**

```bash
git add src/vim/commands.js src/vim/buffers.js src/vim/buffers.test.js
git commit -m "feat(commands): update :wq and :clear for buffer model"
```

---

### Task 6: Remove old storage code and persist/nopersist TTL references

**Files:**
- Modify: `src/main.js` — remove `refreshTTL` import, remove `persist` state references if TTL-related
- Modify: `src/vim/commands.js` — keep `:persist`/`:nopersist` (they still control auto-save)

**Step 1: Clean up any remaining references to old storage functions**

Search for `refreshTTL`, `loadContent`, `saveContent`, `clearContent`, `LS_CONTENT`, `LS_TTL`, `TTL_MS` across all files and remove them.

**Step 2: Run check**

Run: `npm run check`
Expected: PASS.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old single-doc storage references"
```

---

### Task 7: Update help page with buffer documentation

**Files:**
- Modify: `src/template.html` (help content section)

**Step 1: Add "Buffers" section to help page**

Insert a new `<h2>Buffers</h2>` section after the "vi.html Commands" section (before "vi.html Options"). Include:

- Explanation of the buffer model (multiple named documents in localStorage)
- Table of buffer commands: `:e name`, `:b name`, `:b#`, `:ls`, `:bd`, `:saveas name`, `:f name`, `Ctrl-^`
- Note about auto-persist on switch (divergence from vim's E37)
- Tip about using `:ls` to see all buffers

Also update the "Persistence" section to remove the 7-day TTL mention and describe the new model.

Update the "vi.html Commands" table to include new commands and update `:w` and `:e` descriptions.

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/template.html
git commit -m "docs(help): add buffer documentation to help page"
```

---

### Task 8: Interactive browser test

**Files:** None (verification only)

**Step 1: Build and serve**

```bash
npm run build
python3 -m http.server 9876 &
```

**Step 2: Test via Playwright**

Navigate to `http://localhost:9876/vi.html?test` and verify:

1. **Status bar shows `[No Name]`** on fresh load
2. **`:w notes.md`** — status bar updates to `notes.md`, flash says written
3. **`:e todo.md`** — creates new buffer, status bar shows `todo.md`
4. **Type some text in todo.md** (insert mode)
5. **`:b notes.md`** — flash says `"todo.md" written`, switches back, content preserved
6. **`:ls`** — shows both buffers with `%` and `#` indicators
7. **`Ctrl-^`** — toggles between buffers
8. **`:bd`** — deletes current buffer, switches to other
9. **`:f renamed.md`** — renames buffer
10. **`:saveas copy.md`** — copies to new name
11. **Reload page** — session restored, correct buffer loaded

**Step 3: Commit any fixes found during testing**

---

### Task 9: Final lint + test + build verification

**Step 1: Run full check**

```bash
npm run check
```

**Step 2: Build**

```bash
npm run build
```

**Step 3: Final commit if needed**

Ensure everything is clean and passing.
