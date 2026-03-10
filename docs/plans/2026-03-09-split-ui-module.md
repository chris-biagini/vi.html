# Split ui.js Module — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Split `src/ui.js` into `src/status.js` (status bar) and `src/preview.js` (preview/help/tab rendering + SmartyPants) to improve cohesion.

**Architecture:** `ui.js` currently bundles four unrelated concerns. We extract status bar functions into `status.js` and rename the remainder to `preview.js`. The only cross-dependency is `preview.js` importing `flash` from `status.js` (used by the copy button). `main.js` updates its imports to pull from both modules.

---

### Task 1: Create `status.js` with status bar functions

**Files:**
- Create: `src/status.js`

**Step 1: Create `src/status.js`**

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

export function updateStatusPos(line, ch) {
  posEl.textContent = line + 1 + ':' + (ch + 1);
}

export function updateBufferName(name) {
  bufferEl.textContent = name;
}

export function flash(msg, duration) {
  duration = duration || 3000;
  flashEl.textContent = msg;
  flashEl.classList.remove('fade');
  clearTimeout(flash._timer);
  flash._timer = setTimeout(function () {
    flashEl.classList.add('fade');
    setTimeout(function () {
      flashEl.textContent = '';
      flashEl.classList.remove('fade');
    }, 400);
  }, duration);
}
flash._timer = null;

export function setStatusIndicator(label) {
  var el = document.getElementById('status-indicator');
  if (!el) {
    el = document.createElement('span');
    el.id = 'status-indicator';
    el.style.cssText =
      'color: var(--accent); margin-left: 8px; font-weight: bold;';
    modeEl.parentNode.insertBefore(el, modeEl.nextSibling);
  }
  el.textContent = label ? '[' + label + ']' : '';
}

export function updateMode(modeObj) {
  if (!modeObj) return;
  var mode = modeObj.mode || 'normal';
  var sub = modeObj.subMode || '';
  var display = mode.toUpperCase();
  if (sub) display += ' ' + sub.toUpperCase();
  modeEl.textContent = display;
  modeEl.className = mode;
}
```

**Step 2: Verify file was created correctly**

Run: `node -e "import('./src/status.js')" 2>&1 || echo "syntax ok (ESM parse expected to fail in CJS mode)"`

---

### Task 2: Rename `ui.js` to `preview.js`, remove status bar code

**Files:**
- Rename: `src/ui.js` → `src/preview.js`
- Rename: `src/ui.test.js` → `src/preview.test.js`

**Step 1: Rename files**

```bash
git mv src/ui.js src/preview.js
git mv src/ui.test.js src/preview.test.js
```

**Step 2: Edit `src/preview.js`**

Remove lines 6-64 (the entire status bar section: variable declarations, `initStatusBar`, `updateStatusPos`, `updateBufferName`, `flash`, `flash._timer`, `setStatusIndicator`, `updateMode`).

Add import at top (after the `marked` import):

```js
import { flash } from './status.js';
```

This is needed because `initPreviewCopy()` calls `flash('Copied to clipboard')` and `flash('Copied as plain text')`.

The file should now export: `showTab`, `smartyPants`, `educateText`, `renderPreview`, `renderClipboardHTML`.

**Step 3: Edit `src/preview.test.js`**

Change the import line from:
```js
import { educateText, smartyPants, renderClipboardHTML } from './ui.js';
```
to:
```js
import { educateText, smartyPants, renderClipboardHTML } from './preview.js';
```

---

### Task 3: Update `main.js` imports

**Files:**
- Modify: `src/main.js:23-31`

**Step 1: Replace the ui.js import block**

Change:
```js
import {
  initStatusBar,
  updateStatusPos,
  updateBufferName,
  flash,
  updateMode,
  showTab,
  setStatusIndicator,
} from './ui.js';
```

To:
```js
import {
  initStatusBar,
  updateStatusPos,
  updateBufferName,
  flash,
  updateMode,
  setStatusIndicator,
} from './status.js';
import { showTab } from './preview.js';
```

---

### Task 4: Run tests and lint, verify build

**Step 1: Run check (lint + tests)**

Run: `npm run check`
Expected: All tests pass, no lint errors.

**Step 2: Run build**

Run: `npm run build`
Expected: `vi.html` builds successfully.

**Step 3: Commit**

```bash
git add src/status.js src/preview.js src/preview.test.js src/main.js
git commit -m "refactor: split ui.js into status.js and preview.js

Extract status bar functions (initStatusBar, updateStatusPos, flash,
updateMode, etc.) into status.js. Rename remainder to preview.js
(tab switching, preview rendering, SmartyPants, help TOC tracking).

Improves module cohesion — status bar and preview rendering are
unrelated concerns that happened to share a file."
```
