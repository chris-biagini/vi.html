# Build System + CM6 Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Split vi.html into modular source files, bundle dependencies offline via esbuild, and migrate from CodeMirror 5 to CodeMirror 6 — producing a single self-contained `vi.html` as output.

**Architecture:** A `build.js` Node script uses the esbuild API to bundle JS modules and CSS, then inlines everything into an HTML template to produce `vi.html`. Source is split into 6 files: HTML template, CSS, and 4 JS modules (storage, UI, vim customizations, main entry point). CodeMirror 6 with `@replit/codemirror-vim` replaces CM5, using the backward-compatible `Vim`/`getCM()` API.

**Tech Stack:** Node.js, esbuild, CodeMirror 6 (`codemirror`, `@codemirror/lang-markdown`, `@codemirror/view`, `@codemirror/state`), `@replit/codemirror-vim`, `marked`

---

## Source file layout

```
vi.html/
  src/
    template.html    # HTML skeleton with <!-- STYLE --> and <!-- SCRIPT --> placeholders
    style.css        # All CSS (~390 lines)
    storage.js       # localStorage helpers (~35 lines)
    ui.js            # Status bar, tab switching, preview rendering, SmartyPants (~120 lines)
    vim.js           # All vim customizations: reflow, textwidth, line numbers, options, ex commands (~230 lines)
    main.js          # Entry point: CM init, event wiring, state loading (~100 lines)
  build.js           # Node script: esbuild bundle + inline into template
  package.json       # Dependencies and build scripts
  .gitignore         # node_modules/, vi.html (build artifact)
  vi.html            # OUTPUT (not committed)
```

## Key CM5 to CM6 API mappings

The `@replit/codemirror-vim` package provides a backward-compatible API. Most vim customization code transfers directly:

| CM5 | CM6 |
|-----|-----|
| `CodeMirror.Vim.defineOperator(...)` | `import { Vim } from "@replit/codemirror-vim"; Vim.defineOperator(...)` |
| `CodeMirror.Vim.defineEx(...)` | `Vim.defineEx(...)` |
| `CodeMirror.Vim.defineOption(...)` | `Vim.defineOption(...)` |
| `CodeMirror.Vim.mapCommand(...)` | `Vim.mapCommand(...)` |
| `CodeMirror.Vim.map(...)` | `Vim.map(...)` |
| `CodeMirror.Vim.defineAction(...)` | `Vim.defineAction(...)` |
| `cm.on('vim-mode-change', fn)` | `getCM(view).on('vim-mode-change', fn)` |
| `CodeMirror.fromTextArea(el, opts)` | `new EditorView({ extensions: [...], parent: el })` |
| `cm.getValue()` | `view.state.doc.toString()` |
| `cm.setValue(text)` | `view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })` |
| `cm.setOption('lineNumbers', val)` | Reconfigure via compartments |
| `cm.on('change', fn)` | `EditorView.updateListener.of(update => { if (update.docChanged) fn() })` |
| `cm.on('cursorActivity', fn)` | `EditorView.updateListener.of(update => { if (update.selectionSet) fn() })` |

CM6 uses **compartments** for dynamically reconfigurable options (lineNumbers, lineWrapping, tabSize, etc.). Each option that can change at runtime gets its own compartment.

---

## Task 0: Build infrastructure

**Files:**
- Create: `package.json`
- Create: `build.js`
- Create: `.gitignore`

**Step 1: Initialize npm and install dependencies**

```bash
cd /home/claude/vi.html
npm init -y
npm install codemirror @codemirror/lang-markdown @codemirror/view @codemirror/state @replit/codemirror-vim marked
npm install --save-dev esbuild
```

**Step 2: Create `.gitignore`**

```
node_modules/
dist/
vi.html
```

Then remove vi.html from git tracking (keep on disk for reference):
```bash
git rm --cached vi.html
```

**Step 3: Create `build.js`**

```javascript
const esbuild = require('esbuild');
const fs = require('fs');

async function build() {
  // Bundle JS
  const jsResult = await esbuild.build({
    entryPoints: ['src/main.js'],
    bundle: true,
    format: 'iife',
    minify: process.argv.includes('--minify'),
    write: false,
  });

  // Bundle CSS
  const cssResult = await esbuild.build({
    entryPoints: ['src/style.css'],
    bundle: true,
    minify: process.argv.includes('--minify'),
    write: false,
  });

  const js = jsResult.outputFiles[0].text;
  const css = cssResult.outputFiles[0].text;

  // Read template and inline bundles
  let html = fs.readFileSync('src/template.html', 'utf8');
  html = html.replace('/* STYLE */', css);
  html = html.replace('/* SCRIPT */', js);

  fs.writeFileSync('vi.html', html);
  const size = (fs.statSync('vi.html').size / 1024).toFixed(1);
  console.log('Built vi.html (' + size + ' KB)');
}

build().catch(function(err) {
  console.error(err);
  process.exit(1);
});
```

**Step 4: Add build scripts to `package.json`**

```json
{
  "scripts": {
    "build": "node build.js",
    "build:min": "node build.js --minify"
  }
}
```

**Step 5: Commit**

```bash
git add package.json build.js .gitignore
git commit -m "Add build infrastructure (esbuild + build.js)"
```

---

## Task 1: Extract HTML template and CSS

**Files:**
- Create: `src/template.html`
- Create: `src/style.css`
- Create: `src/main.js` (placeholder)

**Step 1: Create `src/template.html`**

Copy the HTML structure from vi.html. Replace the `<style>` block contents with `/* STYLE */` and the `<script>` block contents with `/* SCRIPT */`. Remove all CDN `<script>` and `<link>` tags (dependencies will be bundled).

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>vi.html</title>
  <style>
  /* STYLE */
  </style>
</head>
<body>
  <!-- ... same body HTML as current vi.html (div#app through status bar) ... -->
  <script>
  /* SCRIPT */
  </script>
</body>
</html>
```

The body HTML (from `<div id="app">` through the closing `</div>` including the help content) is copied verbatim.

**Step 2: Create `src/style.css`**

Extract everything between `<style>` and `</style>` from the current vi.html (lines 24-391). Copy verbatim.

**Step 3: Create `src/main.js`** (placeholder to verify build pipeline)

```javascript
console.log('vi.html loaded');
```

**Step 4: Verify build produces valid HTML**

```bash
node build.js
# Expected: "Built vi.html (X KB)"
# Open vi.html in browser — should show the UI with no editor functionality
```

**Step 5: Commit**

```bash
git add src/template.html src/style.css src/main.js
git commit -m "Extract HTML template and CSS into src/"
```

---

## Task 2: Port JS to CM6 modules

This is the main task. We rewrite the JavaScript as ES modules importing from npm packages instead of CDN globals, and migrate from CM5 to CM6 simultaneously.

**Files:**
- Create: `src/storage.js`
- Create: `src/ui.js`
- Create: `src/vim.js`
- Modify: `src/main.js`
- Modify: `src/style.css` (CM6 uses different class names)

### Step 1: Create `src/storage.js`

Direct port of localStorage helpers. No CM dependency — pure functions.

```javascript
var LS_CONTENT  = 'vihtml_content';
var LS_TTL      = 'vihtml_content_ttl';
var LS_SETTINGS = 'vihtml_settings';
var LS_PERSIST  = 'vihtml_persist';
var TTL_MS      = 7 * 24 * 60 * 60 * 1000;

export function lsGet(k) { try { return localStorage.getItem(k); } catch(e) { return null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch(e) {} }
export function lsRemove(k) { try { localStorage.removeItem(k); } catch(e) {} }

export function saveContent(text, persist) {
  if (!persist) return;
  lsSet(LS_CONTENT, text);
  lsSet(LS_TTL, String(Date.now() + TTL_MS));
}

export function loadContent() {
  var ttl = parseInt(lsGet(LS_TTL) || '0', 10);
  if (Date.now() > ttl) {
    lsRemove(LS_CONTENT);
    lsRemove(LS_TTL);
    return null;
  }
  return lsGet(LS_CONTENT);
}

export function saveSettings(settings) {
  lsSet(LS_SETTINGS, JSON.stringify(settings));
}

export function loadSettings() {
  var raw = lsGet(LS_SETTINGS);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
}

export function loadPersistFlag() {
  return lsGet(LS_PERSIST) !== '0';
}

export function savePersistFlag(val) {
  lsSet(LS_PERSIST, val ? '1' : '0');
}

export function clearContent() {
  lsRemove(LS_CONTENT);
  lsRemove(LS_TTL);
}

export function refreshTTL() {
  lsSet(LS_TTL, String(Date.now() + TTL_MS));
}
```

### Step 2: Create `src/ui.js`

Port of status bar, tab switching, SmartyPants, and preview rendering. The `renderPreview` function takes a getText callback to decouple from CM API.

Note: preview rendering uses innerHTML to display parsed markdown output from marked.js. This renders the user's own content (not untrusted external input) — same as the existing vi.html.

```javascript
import { marked } from 'marked';

// -- Status bar --
var flashTimer = null;

export function updateStatusPos(posEl, line, ch) {
  posEl.textContent = (line + 1) + ':' + (ch + 1);
}

export function flash(flashEl, msg, duration) {
  duration = duration || 3000;
  flashEl.textContent = msg;
  flashEl.classList.remove('fade');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(function() {
    flashEl.classList.add('fade');
    setTimeout(function() {
      flashEl.textContent = '';
      flashEl.classList.remove('fade');
    }, 400);
  }, duration);
}

// -- Tab switching --
export function showTab(name, state, callbacks) {
  var containers = {
    editor:  document.getElementById('editor-container'),
    preview: document.getElementById('preview-container'),
    help:    document.getElementById('help-container')
  };
  var tabs = {
    editor:  document.getElementById('tab-editor'),
    preview: document.getElementById('tab-preview'),
    help:    document.getElementById('tab-help')
  };

  state.currentTab = name;

  containers.editor.classList.add('hidden');
  containers.preview.classList.remove('visible');
  containers.help.classList.remove('visible');
  tabs.editor.classList.remove('active');
  tabs.preview.classList.remove('active');
  tabs.help.classList.remove('active');

  if (name === 'preview') {
    renderPreview(callbacks.getText());
    containers.preview.classList.add('visible');
  } else if (name === 'help') {
    containers.help.classList.add('visible');
  } else {
    containers.editor.classList.remove('hidden');
    callbacks.focusEditor();
  }
  tabs[name].classList.add('active');
}

// -- SmartyPants --
function smartyPants(html) {
  var inCode = 0;
  return html.replace(/(<\/?(code|pre)[^>]*>)|(<[^>]*>)|([^<]+)/gi,
    function(match, codeTag, codeTagName, otherTag, text) {
      if (codeTag) {
        if (codeTag[1] === '/') { inCode = Math.max(0, inCode - 1); }
        else { inCode++; }
        return codeTag;
      }
      if (otherTag) return otherTag;
      if (!text || inCode > 0) return text || '';
      return educateText(text);
    });
}

function educateText(t) {
  t = t.replace(/&quot;/g, '"');
  t = t.replace(/&#39;/g, "'");
  t = t.replace(/---/g, '\u2014');
  t = t.replace(/--/g, '\u2013');
  t = t.replace(/\.\.\./g, '\u2026');
  t = t.replace(/(^|[\s(\[{>\u2014\u2013])"(?=\S)/gm, '$1\u201C');
  t = t.replace(/"/g, '\u201D');
  t = t.replace(/(\w)'(\w)/g, '$1\u2019$2');
  t = t.replace(/(^|[\s(\[{>\u2014\u2013])'(?=\S)/gm, '$1\u2018');
  t = t.replace(/'/g, '\u2019');
  return t;
}

// -- Preview rendering --
// Note: uses innerHTML for rendered markdown (user's own content, not untrusted input)
function renderPreview(mdText) {
  var html = marked.parse(mdText);
  html = smartyPants(html);
  document.getElementById('preview-content').innerHTML = html;
}

// -- marked.js configuration --
marked.setOptions({ gfm: true, breaks: false });
```

### Step 3: Create `src/vim.js`

Port all vim customizations. Uses `Vim` from `@replit/codemirror-vim` — same API as CM5.

```javascript
import { Vim } from '@replit/codemirror-vim';

// -- textwidth auto-wrap --
export function handleTextwidthWrap(cm, state, changeObj) {
  if (state.textwidth <= 0) return;
  if (state.wrapping) return;
  if (changeObj.origin !== '+input') return;

  var inserted = changeObj.text.join('');
  if (!inserted) return;

  var cursor = cm.getCursor();
  var lineNo = cursor.line;
  var lineText = cm.getLine(lineNo);

  if (lineText.length <= state.textwidth) return;

  var breakAt = -1;
  for (var i = state.textwidth; i >= 0; i--) {
    if (lineText[i] === ' ') { breakAt = i; break; }
  }
  if (breakAt <= 0) return;

  var indent = lineText.match(/^(\s*)/)[1];
  state.wrapping = true;
  cm.operation(function() {
    cm.replaceRange('\n' + indent,
      { line: lineNo, ch: breakAt },
      { line: lineNo, ch: breakAt + 1 }
    );
  });
  setTimeout(function() { state.wrapping = false; }, 0);
}

// -- gq reflow --
function reflowRange(cm, fromLine, toLine, width) {
  var lines = [];
  for (var i = fromLine; i <= toLine; i++) lines.push(cm.getLine(i));

  var paragraphs = [];
  var current = [];
  for (var j = 0; j < lines.length; j++) {
    if (lines[j].trim() === '') {
      if (current.length > 0) paragraphs.push(current);
      paragraphs.push(['']);
      current = [];
    } else {
      current.push(lines[j]);
    }
  }
  if (current.length > 0) paragraphs.push(current);

  var result = [];
  for (var p = 0; p < paragraphs.length; p++) {
    var para = paragraphs[p];
    if (para.length === 1 && para[0].trim() === '') {
      result.push('');
      continue;
    }
    var paraIndent = para[0].match(/^(\s*)/)[1];
    var joined = para.map(function(l) { return l.trim(); }).join(' ').replace(/\s+/g, ' ');
    result.push(wordWrap(joined, width, paraIndent));
  }

  var text = result.join('\n');
  cm.replaceRange(text,
    { line: fromLine, ch: 0 },
    { line: toLine, ch: cm.getLine(toLine).length }
  );
  return text.split('\n').length;
}

function wordWrap(text, width, indent) {
  var words = text.split(' ');
  var lines = [];
  var cur = indent;
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (!word) continue;
    var test = cur === indent ? indent + word : cur + ' ' + word;
    if (test.length <= width || cur === indent) { cur = test; }
    else { lines.push(cur); cur = indent + word; }
  }
  if (cur !== indent || lines.length === 0) lines.push(cur);
  return lines.join('\n');
}

// -- Register all vim customizations --
export function registerVimConfig(state, flashFn, showTabFn, saveSettingsFn, editorAPI) {
  // Options
  Vim.defineOption('number', true, 'boolean', ['nu'], function(val, cm) {
    if (!cm) return;
    editorAPI.setLineNumbers(val);
    saveSettingsFn();
  });

  Vim.defineOption('relativenumber', false, 'boolean', ['rnu'], function(val, cm) {
    if (!cm) return;
    editorAPI.setRelativeNumbers(val);
    state.relativeNumber = val;
    saveSettingsFn();
  });

  Vim.defineOption('tabstop', 4, 'number', ['ts'], function(val, cm) {
    if (!cm) return;
    editorAPI.setTabSize(val);
    saveSettingsFn();
  });

  Vim.defineOption('shiftwidth', 4, 'number', ['sw'], function(val, cm) {
    if (!cm) return;
    editorAPI.setIndentUnit(val);
    saveSettingsFn();
  });

  Vim.defineOption('expandtab', true, 'boolean', ['et'], function(val, cm) {
    if (!cm) return;
    editorAPI.setIndentWithTabs(!val);
    saveSettingsFn();
  });

  Vim.defineOption('wrap', true, 'boolean', [], function(val, cm) {
    if (!cm) return;
    editorAPI.setLineWrapping(val);
    saveSettingsFn();
  });

  Vim.defineOption('textwidth', 0, 'number', ['tw'], function(val, cm) {
    if (!cm) return;
    state.textwidth = val;
    saveSettingsFn();
    flashFn('textwidth=' + val);
  });

  // gq operator
  Vim.defineOperator('hardWrap', function(cm, operatorArgs, ranges) {
    var width = state.textwidth > 0 ? state.textwidth : 79;
    var cursorLine = 0;
    cm.operation(function() {
      for (var i = ranges.length - 1; i >= 0; i--) {
        var range = ranges[i];
        var fromPos = range.anchor.line <= range.head.line ? range.anchor : range.head;
        var toPos = range.anchor.line <= range.head.line ? range.head : range.anchor;
        var from = fromPos.line;
        var to = toPos.line;
        if (to > from && toPos.ch === 0) to--;
        while (to > from && cm.getLine(to).trim() === '') to--;
        var newLines = reflowRange(cm, from, to, width);
        cursorLine = from + newLines - 1;
      }
    });
    var lastLine = cm.lastLine();
    if (cursorLine > lastLine) cursorLine = lastLine;
    var firstNonBlank = cm.getLine(cursorLine).search(/\S/);
    cm.setCursor(cursorLine, firstNonBlank < 0 ? 0 : firstNonBlank);
  });

  Vim.mapCommand('gq', 'operator', 'hardWrap', {}, {});

  // Arrow key clamping
  function clampedArrow(dir) {
    return function(cm) {
      var cur = cm.getCursor();
      if (dir === 'left') {
        if (cur.ch > 0) cm.execCommand('goCharLeft');
      } else if (dir === 'right') {
        var lineLen = cm.getLine(cur.line).length;
        if (cur.ch < lineLen) cm.execCommand('goCharRight');
      } else {
        cm.execCommand(dir === 'up' ? 'goLineUp' : 'goLineDown');
      }
    };
  }
  Vim.defineAction('clampLeft', clampedArrow('left'));
  Vim.defineAction('clampRight', clampedArrow('right'));
  Vim.mapCommand('<Left>', 'action', 'clampLeft', {}, { context: 'insert' });
  Vim.mapCommand('<Right>', 'action', 'clampRight', {}, { context: 'insert' });

  // Ex commands
  Vim.defineEx('preview', 'pre', function() { showTabFn('preview'); });
  Vim.defineEx('editor', 'editor', function() { showTabFn('editor'); });
  Vim.defineEx('help', 'h', function() { showTabFn('help'); });

  Vim.defineEx('write', 'w', function() {
    editorAPI.saveNow();
    flashFn('Saved');
  });

  Vim.defineEx('edit', 'e', function() {
    var loaded = editorAPI.reloadContent();
    flashFn(loaded ? 'Reloaded' : 'No saved content');
  });

  Vim.defineEx('clear', '', function() {
    editorAPI.clearSaved();
    flashFn('Cleared');
  });

  Vim.defineEx('persist', '', function() {
    state.persist = true;
    editorAPI.savePersistFlag(true);
    flashFn('Persist: on');
  });

  Vim.defineEx('nopersist', '', function() {
    state.persist = false;
    editorAPI.savePersistFlag(false);
    flashFn('Persist: off');
  });

  Vim.defineEx('settings', 'settings', function() {
    var s = editorAPI.getSettingsDisplay(state);
    flashFn(s, 8000);
  });

  Vim.defineEx('toggle', 'tog', function() {
    showTabFn(state.currentTab === 'editor' ? 'preview' : 'editor');
  });

  Vim.map('\\p', ':toggle<CR>', 'normal');
}
```

### Step 4: Create `src/main.js`

Entry point. Creates the CM6 editor with compartments for dynamic reconfiguration.

```javascript
import { EditorView, lineNumbers, drawSelection, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { vim, getCM } from '@replit/codemirror-vim';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';

import {
  saveContent, loadContent, saveSettings, loadSettings,
  loadPersistFlag, savePersistFlag as storeSavePersistFlag,
  clearContent, refreshTTL
} from './storage.js';
import { updateStatusPos, flash, showTab } from './ui.js';
import { registerVimConfig, handleTextwidthWrap } from './vim.js';

// -- State --
var state = {
  textwidth: 0,
  persist: true,
  relativeNumber: false,
  currentTab: 'editor',
  wrapping: false
};

// -- DOM elements --
var modeEl  = document.getElementById('status-mode');
var posEl   = document.getElementById('status-pos');
var flashEl = document.getElementById('status-flash');

// -- Compartments for dynamic CM6 options --
var lineNumbersComp  = new Compartment();
var lineWrappingComp = new Compartment();
var tabSizeComp      = new Compartment();

function doFlash(msg, dur) { flash(flashEl, msg, dur); }

// -- Build CM6 editor --
var view = new EditorView({
  doc: '',
  extensions: [
    vim(),
    lineNumbersComp.of(lineNumbers()),
    lineWrappingComp.of(EditorView.lineWrapping),
    tabSizeComp.of(EditorState.tabSize.of(4)),
    markdown(),
    history(),
    drawSelection(),
    bracketMatching(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.updateListener.of(function(update) {
      if (update.selectionSet) {
        var pos = update.state.selection.main.head;
        var line = update.state.doc.lineAt(pos);
        updateStatusPos(posEl, line.number - 1, pos - line.from);
      }
      if (update.docChanged) {
        scheduleContentSave();
      }
    }),
  ],
  parent: document.getElementById('editor-container'),
});

// -- getCM adapter for vim API --
var cm = getCM(view);

// Vim mode change display
cm.on('vim-mode-change', function(modeObj) {
  if (!modeObj) return;
  var mode = modeObj.mode || 'normal';
  var sub = modeObj.subMode || '';
  var display = mode.toUpperCase();
  if (sub) display += ' ' + sub.toUpperCase();
  modeEl.textContent = display;
  modeEl.className = mode;
});

// textwidth wrapping via getCM change event
cm.on('change', function(cmInst, changeObj) {
  handleTextwidthWrap(cmInst, state, changeObj);
});

// -- Debounced content save --
var saveTimer = null;
function scheduleContentSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    saveContent(view.state.doc.toString(), state.persist);
  }, 1000);
}

// -- Editor API for vim.js callbacks --
var editorAPI = {
  setLineNumbers: function(val) {
    view.dispatch({ effects: lineNumbersComp.reconfigure(val ? lineNumbers() : []) });
  },
  setRelativeNumbers: function(val) {
    state.relativeNumber = val;
    // TODO: implement relative line numbers via custom gutter
  },
  setTabSize: function(val) {
    view.dispatch({ effects: tabSizeComp.reconfigure(EditorState.tabSize.of(val)) });
  },
  setIndentUnit: function(val) {
    // TODO: use @codemirror/language indentUnit facet
  },
  setIndentWithTabs: function(val) {
    // TODO: use indentUnit extension
  },
  setLineWrapping: function(val) {
    view.dispatch({ effects: lineWrappingComp.reconfigure(val ? EditorView.lineWrapping : []) });
  },
  saveNow: function() {
    saveContent(view.state.doc.toString(), true);
    refreshTTL();
  },
  reloadContent: function() {
    var saved = loadContent();
    if (saved !== null) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: saved } });
      return true;
    }
    return false;
  },
  clearSaved: function() { clearContent(); },
  savePersistFlag: storeSavePersistFlag,
  getSettingsDisplay: function(st) {
    return [
      'tw=' + st.textwidth,
      'persist=' + st.persist,
      'rnu=' + st.relativeNumber
    ].join('  ');
  },
};

// -- Tab switching --
var tabCallbacks = {
  getText: function() { return view.state.doc.toString(); },
  focusEditor: function() { view.focus(); },
};

function doShowTab(name) { showTab(name, state, tabCallbacks); }

// -- Register vim config --
registerVimConfig(state, doFlash, doShowTab, function() {
  saveSettings({
    textwidth: state.textwidth,
    relativeNumber: state.relativeNumber,
    persist: state.persist,
    tabSize: view.state.tabSize,
  });
}, editorAPI);

// -- Tab click handlers --
document.getElementById('tab-editor').addEventListener('click', function() { doShowTab('editor'); });
document.getElementById('tab-preview').addEventListener('click', function() { doShowTab('preview'); });
document.getElementById('tab-help').addEventListener('click', function() { doShowTab('help'); });

document.addEventListener('keydown', function(e) {
  if (e.key === '\\' && state.currentTab !== 'editor') {
    e.preventDefault();
    doShowTab('editor');
  }
});

// -- Load persisted state --
state.persist = loadPersistFlag();

var settings = loadSettings();
if (settings) {
  if (settings.tabSize) editorAPI.setTabSize(settings.tabSize);
  if (settings.textwidth) state.textwidth = settings.textwidth;
  if (settings.relativeNumber) editorAPI.setRelativeNumbers(true);
  if (settings.lineWrapping === false) editorAPI.setLineWrapping(false);
}

var savedContent = loadContent();
if (savedContent !== null) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: savedContent } });
}

updateStatusPos(posEl, 0, 0);
view.focus();
```

### Step 5: Update `src/style.css` for CM6

CM6 uses different CSS class names. Key replacements:

| CM5 class | CM6 class |
|-----------|-----------|
| `.CodeMirror` | `.cm-editor` |
| `.CodeMirror-gutters` | `.cm-gutters` |
| `.CodeMirror-linenumber` | `.cm-lineNumbers .cm-gutterElement` |
| `.CodeMirror-cursor` | `.cm-cursor` |
| `.cm-fat-cursor .CodeMirror-cursor` | `.cm-fat-cursor .cm-cursor` |
| `.CodeMirror-selected` | `.cm-selectionBackground` |
| `.CodeMirror-focused .CodeMirror-selected` | `.cm-focused .cm-selectionBackground` |
| `.CodeMirror-dialog` | `.cm-panels` (or custom vim panel) |

Markdown syntax token classes may also differ. Test and adjust.

### Step 6: Verify everything works

```bash
node build.js
# Open vi.html in browser
# Test: typing, vim motions, :w, :preview, gq, :set tw=72, tabs
```

### Step 7: Commit

```bash
git add src/
git commit -m "Port to CM6 modules with esbuild bundling"
```

---

## Task 3: Polish CM6-specific issues

After the initial port, several things will need attention.

**Files:**
- Modify: `src/main.js`
- Modify: `src/vim.js`
- Modify: `src/style.css`

### Step 1: Implement relative line numbers for CM6

CM6 needs a custom gutter extension. Use `lineNumbers()` with a custom `formatNumber` function, or build a custom `gutter()` that tracks cursor position. The gutter must update on cursor movement.

### Step 2: Fix indentUnit / expandtab / shiftwidth

Use `@codemirror/language`'s `indentUnit` facet with a compartment.

### Step 3: Fix settings display

Read actual values from CM6 state for accurate `:settings` output.

### Step 4: Fix CSS styling

Adjust remaining CM6 class names. Test dark theme. Fix dialog/command-line/search styling for the vim panel.

### Step 5: Test all vim features

Systematic check:
- Normal mode motions (hjkl, w/b/e, gg/G, {/}, f/F/t/T)
- Insert mode entry (i/a/o/A/O/I)
- Visual mode (v, V)
- Operators (d, c, y, gq)
- Text objects (iw, aw, ip, ap, i", a")
- Search (/, ?, n, N, *, #)
- Ex commands (:w, :e, :preview, :help, :settings, :set tw=72, :s/old/new/g, :noh)
- Options (:set nu, :set rnu, :set ts=2, :set sw=2, :set et, :set wrap, :set tw=72)
- Textwidth auto-wrap in insert mode
- gq reflow (gqq, gqap, gq}, visual+gq)
- Status bar (mode display, cursor position, flash messages)
- Tab switching (click, \p, :toggle, :preview, :help, :editor)
- Persistence (content auto-save, :w, :e, :clear, :persist/:nopersist, settings)
- Preview (markdown rendering, SmartyPants typography)
- Arrow key clamping in insert mode

### Step 6: Commit

```bash
git add src/
git commit -m "Fix CM6 styling, relative numbers, and indent settings"
```

---

## Task 4: Add watch mode to build.js

**Files:**
- Modify: `build.js`
- Modify: `package.json`

### Step 1: Add file watcher

Simplest approach — add a dev script using `nodemon`:

```json
{
  "scripts": {
    "dev": "npx -y nodemon --watch src -e js,css,html --exec 'node build.js'"
  }
}
```

Or add native watch support to build.js using Node's `fs.watch`:

```javascript
if (process.argv.includes('--watch')) {
  const fs = require('fs');
  build();
  console.log('Watching src/ for changes...');
  fs.watch('src', { recursive: true }, function() {
    build().catch(console.error);
  });
} else {
  build();
}
```

### Step 2: Commit

```bash
git add build.js package.json
git commit -m "Add watch mode for development"
```

---

## Task 5: GitHub Action for Pages deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

### Step 1: Create workflow

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: node build.js --minify
      - run: mkdir _site && cp vi.html _site/index.html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Step 2: Commit and push

```bash
mkdir -p .github/workflows
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Pages deployment workflow"
```

### Step 3: Enable GitHub Pages

In the repo settings, set Pages source to "GitHub Actions".

---

## Risk notes

1. **CM6 vim keymap compatibility** — `@replit/codemirror-vim` maintains the CM5 API via `getCM()`, but subtle behavioral differences may exist in operator/motion interactions. Test thoroughly.

2. **CSS migration** — CM6 uses a completely different DOM structure and class names. The dark theme CSS needs significant rework, not just class name find-and-replace.

3. **Relative line numbers** — No direct CM6 equivalent to CM5's `lineNumberFormatter`. Requires a custom gutter or overriding `lineNumbers()` behavior. Most likely feature to need substantial new code.

4. **textwidth wrap change event** — The `cm.on('change', ...)` event through `getCM()` may not fire with the same `changeObj` shape as CM5. The `origin` field needs verification.

5. **Build output size** — Bundling CM6 + marked produces a larger file (~300-500KB minified vs near-zero with CDN). This is the trade-off for offline capability.

6. **localStorage key compatibility** — The same localStorage keys are used. Users' saved content and settings carry over from the old CDN version to the bundled version seamlessly.
