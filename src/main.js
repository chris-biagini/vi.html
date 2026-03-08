import { EditorView, lineNumbers, drawSelection, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { vim, getCM } from '@replit/codemirror-vim';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';

import { saveContent, loadContent, saveSettings, loadSettings, loadPersistFlag, savePersistFlag, clearContent, refreshTTL } from './storage.js';
import { initStatusBar, updateStatusPos, flash, updateMode, showTab } from './ui.js';
import { handleTextwidthWrap, registerVimConfig } from './vim.js';

// ── Application state ───────────────────────────────────
var state = {
  textwidth: 0,
  persist: true,
  relativeNumber: false,
  flashTimer: null,
  currentTab: 'editor',
  wrapping: false
};

// ── Compartments for dynamic options ────────────────────
var lineNumbersCompartment = new Compartment();
var lineWrappingCompartment = new Compartment();
var tabSizeCompartment = new Compartment();

// ── Build editor ────────────────────────────────────────
initStatusBar();

var view = new EditorView({
  state: EditorState.create({
    doc: '',
    extensions: [
      vim(),
      lineNumbersCompartment.of(lineNumbers()),
      lineWrappingCompartment.of(EditorView.lineWrapping),
      tabSizeCompartment.of(EditorState.tabSize.of(4)),
      markdown(),
      history(),
      bracketMatching(),
      drawSelection(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      EditorView.updateListener.of(function(update) {
        if (update.selectionSet) {
          var pos = update.state.selection.main.head;
          var line = update.state.doc.lineAt(pos);
          updateStatusPos(line.number - 1, pos - line.from);
        }
        if (update.docChanged) {
          scheduleContentSave();
        }
      }),
      EditorView.theme({
        '&': {
          height: '100%',
          backgroundColor: 'var(--bg)',
          color: 'var(--fg)',
        },
        '.cm-content': {
          fontFamily: "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
          fontSize: '17px',
          lineHeight: '1.55',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--bg-alt)',
          borderRight: '1px solid #1e1e1e',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          color: 'var(--fg-dim)',
          fontSize: '14px',
        },
        '.cm-cursor': {
          borderLeft: '2px solid var(--cursor-bg)',
        },
        '.cm-fat-cursor .cm-cursor': {
          backgroundColor: 'var(--cursor-bg)',
          border: 'none',
          opacity: '0.65',
        },
        '.cm-selectionBackground': {
          backgroundColor: 'var(--sel-bg) !important',
        },
        '.cm-focused .cm-selectionBackground': {
          backgroundColor: '#1e3a24 !important',
        },
        '.cm-panels': {
          backgroundColor: 'var(--dialog-bg)',
          color: 'var(--fg)',
          borderTop: '1px solid var(--tab-border) !important',
          borderBottom: 'none !important',
          fontFamily: 'inherit',
          fontSize: '16px',
        },
        '.cm-panels input': {
          backgroundColor: 'var(--bg)',
          color: 'var(--fg)',
          border: '1px solid var(--tab-border)',
          padding: '2px 6px',
          fontFamily: 'inherit',
          fontSize: '16px',
          outline: 'none',
        },
        '.cm-panels input:focus': {
          borderColor: 'var(--accent)',
        },
      }),
    ],
  }),
  parent: document.getElementById('editor-container'),
});

// ── Get CM5-compatible instance ─────────────────────────
var cm = getCM(view);

// ── Debounced content save ──────────────────────────────
var saveTimer = null;
function scheduleContentSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    saveContent(view.state.doc.toString(), state.persist);
  }, 1000);
}

// ── Tab callbacks ───────────────────────────────────────
var tabCallbacks = {
  getText: function() { return view.state.doc.toString(); },
  focusEditor: function() { view.focus(); }
};

function doShowTab(name) {
  showTab(name, state, tabCallbacks);
}

// ── Helper to gather current settings ───────────────────
function gatherSettings() {
  var lineNums = lineNumbersCompartment.get(view.state) !== undefined;
  var ts = view.state.tabSize;
  return {
    lineNumbers: lineNums,
    tabSize: ts,
    indentUnit: ts, // TODO: separate indentUnit in Task 3
    indentWithTabs: false, // TODO: indentWithTabs in Task 3
    lineWrapping: lineWrappingCompartment.get(view.state) !== undefined,
    textwidth: state.textwidth,
    relativeNumber: state.relativeNumber
  };
}

function doSaveSettings() {
  saveSettings(gatherSettings());
}

// ── Editor API for vim.js ───────────────────────────────
var editorAPI = {
  setLineNumbers: function(val) {
    view.dispatch({
      effects: lineNumbersCompartment.reconfigure(val ? lineNumbers() : [])
    });
  },
  setRelativeNumbers: function(val) {
    // TODO: Full relative line number implementation in Task 3
    state.relativeNumber = val;
  },
  setTabSize: function(val) {
    view.dispatch({
      effects: tabSizeCompartment.reconfigure(EditorState.tabSize.of(val))
    });
  },
  setIndentUnit: function(val) {
    // TODO: Full indentUnit compartment in Task 3
  },
  setIndentWithTabs: function(val) {
    // TODO: Full indentWithTabs compartment in Task 3
  },
  setLineWrapping: function(val) {
    view.dispatch({
      effects: lineWrappingCompartment.reconfigure(val ? EditorView.lineWrapping : [])
    });
  },
  saveNow: function() {
    saveContent(view.state.doc.toString(), true);
    refreshTTL();
  },
  reloadContent: function() {
    var saved = loadContent();
    if (saved !== null) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: saved }
      });
      flash('Reloaded');
    } else {
      flash('No saved content');
    }
  },
  clearSaved: function() {
    clearContent();
  },
  savePersistFlag: function(val) {
    savePersistFlag(val);
  },
  getSettingsDisplay: function() {
    // TODO: More accurate settings display in Task 3
    var ts = view.state.tabSize;
    return [
      'number=' + (lineNumbersCompartment.get(view.state) !== undefined),
      'rnu=' + state.relativeNumber,
      'ts=' + ts,
      'sw=' + ts,
      'et=true',
      'wrap=' + (lineWrappingCompartment.get(view.state) !== undefined),
      'tw=' + state.textwidth,
      'persist=' + state.persist
    ].join('  ');
  }
};

// ── Register vim config ─────────────────────────────────
registerVimConfig(state, flash, doShowTab, doSaveSettings, editorAPI);

// ── Wire up vim-mode-change ─────────────────────────────
cm.on('vim-mode-change', updateMode);

// ── Wire up textwidth wrapping ──────────────────────────
cm.on('change', function(cmInstance, changeObj) {
  handleTextwidthWrap(cmInstance, changeObj, state);
});

// ── Tab click handlers ──────────────────────────────────
document.getElementById('tab-editor').addEventListener('click', function() {
  doShowTab('editor');
});
document.getElementById('tab-preview').addEventListener('click', function() {
  doShowTab('preview');
});
document.getElementById('tab-help').addEventListener('click', function() {
  doShowTab('help');
});

// ── Backslash to return to editor from preview/help ─────
document.addEventListener('keydown', function(e) {
  if (e.key === '\\' && state.currentTab !== 'editor') {
    e.preventDefault();
    doShowTab('editor');
  }
});

// ── Load persisted state ────────────────────────────────
state.persist = loadPersistFlag();

var settings = loadSettings();
if (settings) {
  editorAPI.setLineNumbers(settings.lineNumbers !== false);
  editorAPI.setTabSize(settings.tabSize || 4);
  // TODO: indentUnit and indentWithTabs in Task 3
  editorAPI.setLineWrapping(settings.lineWrapping !== false);
  state.textwidth = settings.textwidth || 0;
  if (settings.relativeNumber) {
    state.relativeNumber = true;
    // TODO: Full relative line number implementation in Task 3
  }
}

var savedContent = loadContent();
if (savedContent !== null) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: savedContent }
  });
}

// Set initial cursor position display
var initialPos = view.state.selection.main.head;
var initialLine = view.state.doc.lineAt(initialPos);
updateStatusPos(initialLine.number - 1, initialPos - initialLine.from);
