import {
  EditorView,
  lineNumbers,
  drawSelection,
  keymap,
} from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { vim, getCM } from '@replit/codemirror-vim';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import {
  bracketMatching,
  indentUnit as indentUnitFacet,
} from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';

import {
  loadBuffers,
  saveBuffers,
  loadSession,
  saveSession,
} from './storage.js';
import {
  initStatusBar,
  updateStatusPos,
  updateBufferName,
  flash,
  updateMode,
  showTab,
  setStatusIndicator,
} from './ui.js';
import {
  handleTextwidthWrap,
  registerGqOperator,
  registerArrowClamp,
  registerVimOptions,
  registerExCommands,
  registerMappings,
  registerAbbreviations,
  createBufferManager,
  executeExrc,
  registerExrc,
  isEditingExrc,
  exrcWrite,
  exrcQuit,
  exrcWriteQuit,
  tildeExtension,
} from './vim/index.js';
import { installTestHarness } from './test-harness.js';

// ── Application state ───────────────────────────────────
var state = {
  textwidth: 0,
  persist: true,
  relativeNumber: false,
  flashTimer: null,
  currentTab: 'editor',
  wrapping: false,
};

// ── Compartments for dynamic options ────────────────────
var lineNumbersCompartment = new Compartment();
var lineWrappingCompartment = new Compartment();
var tabSizeCompartment = new Compartment();
var indentUnitCompartment = new Compartment();
var abbreviationsCompartment = new Compartment();
var spellcheckCompartment = new Compartment();

// Track current values for settings display (compartment.get() is unreliable)
var currentLineNumbers = true;
var currentLineWrapping = true;
var currentTabSize = 4;
var currentIndentUnit = 4;
var currentIndentWithTabs = false;
var currentSpellcheck = false;
var currentSpelllang = 'en';

// Track cursor line for relative number updates
var lastCursorLine = -1;

// ── Line numbers helpers ────────────────────────────────
function makeLineNumbersExtension() {
  if (!currentLineNumbers) return [];
  if (!state.relativeNumber) return lineNumbers();
  return lineNumbers({
    formatNumber: function (lineNo, edState) {
      var cursorLine = edState.doc.lineAt(edState.selection.main.head).number;
      var rel = Math.abs(lineNo - cursorLine);
      return rel === 0 ? String(lineNo) : String(rel);
    },
  });
}

function makeIndentUnitString() {
  if (currentIndentWithTabs) return '\t';
  var s = '';
  for (var i = 0; i < currentIndentUnit; i++) s += ' ';
  return s;
}

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
      indentUnitCompartment.of(indentUnitFacet.of('    ')),
      markdown(),
      history(),
      bracketMatching(),
      drawSelection(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      abbreviationsCompartment.of([]),
      spellcheckCompartment.of([]),
      tildeExtension(),
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
          fontFamily:
            "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
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
        '.cm-tilde-container': {
          position: 'absolute',
          pointerEvents: 'none',
          userSelect: 'none',
        },
        '.cm-tilde-line': {
          color: '#4e5a8a',
          fontSize: '17px',
          lineHeight: '1.55',
          paddingLeft: '6px',
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
  if (isEditingExrc()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    if (state.persist) bufferManager.saveCurrentBuffer();
  }, 1000);
}

// ── Tab callbacks ───────────────────────────────────────
var tabCallbacks = {
  getText: function () {
    return view.state.doc.toString();
  },
  focusEditor: function () {
    view.focus();
    view.requestMeasure();
  },
};

function doShowTab(name) {
  showTab(name, state, tabCallbacks);
}

// ── Editor API for vim modules ───────────────────────────
var editorAPI = {
  setLineNumbers: function (val) {
    currentLineNumbers = val;
    view.dispatch({
      effects: lineNumbersCompartment.reconfigure(makeLineNumbersExtension()),
    });
  },
  setRelativeNumbers: function (val) {
    state.relativeNumber = val;
    view.dispatch({
      effects: lineNumbersCompartment.reconfigure(makeLineNumbersExtension()),
    });
  },
  getTabSize: function () {
    return currentTabSize;
  },
  setTabSize: function (val) {
    currentTabSize = val;
    view.dispatch({
      effects: tabSizeCompartment.reconfigure(EditorState.tabSize.of(val)),
    });
  },
  setIndentUnit: function (val) {
    currentIndentUnit = val;
    view.dispatch({
      effects: indentUnitCompartment.reconfigure(
        indentUnitFacet.of(makeIndentUnitString()),
      ),
    });
  },
  setIndentWithTabs: function (val) {
    currentIndentWithTabs = val;
    view.dispatch({
      effects: indentUnitCompartment.reconfigure(
        indentUnitFacet.of(makeIndentUnitString()),
      ),
    });
  },
  setLineWrapping: function (val) {
    currentLineWrapping = val;
    view.dispatch({
      effects: lineWrappingCompartment.reconfigure(
        val ? EditorView.lineWrapping : [],
      ),
    });
  },
  saveNow: function () {
    bufferManager.saveCurrentBuffer();
  },
  reloadContent: function () {
    var bufs = loadBuffers();
    var name = bufferManager.currentName();
    if (name in bufs) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: bufs[name].content,
        },
      });
      flash('Reloaded');
    } else {
      flash('No saved content');
    }
  },
  clearSaved: function () {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: '' },
    });
    flash('Buffer cleared');
  },
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
  setSpellcheck: function (val) {
    currentSpellcheck = val;
    view.dispatch({
      effects: spellcheckCompartment.reconfigure(
        val
          ? EditorView.contentAttributes.of({
              spellcheck: 'true',
              lang: currentSpelllang,
            })
          : [],
      ),
    });
  },
  setSpelllang: function (val) {
    currentSpelllang = val;
    if (currentSpellcheck) {
      view.dispatch({
        effects: spellcheckCompartment.reconfigure(
          EditorView.contentAttributes.of({
            spellcheck: 'true',
            lang: val,
          }),
        ),
      });
    }
  },
  setStatusIndicator: function (label) {
    setStatusIndicator(label);
  },
  getSettingsDisplay: function () {
    return [
      'number=' + currentLineNumbers,
      'rnu=' + state.relativeNumber,
      'ts=' + currentTabSize,
      'sw=' + currentIndentUnit,
      'et=' + !currentIndentWithTabs,
      'wrap=' + currentLineWrapping,
      'tw=' + state.textwidth,
      'spell=' + currentSpellcheck,
      'spelllang=' + currentSpelllang,
      'persist=' + state.persist,
    ].join('  ');
  },
};

// ── Buffer manager ───────────────────────────────────────
var bufferManager = createBufferManager({
  loadBuffers: loadBuffers,
  saveBuffers: saveBuffers,
  loadSession: loadSession,
  saveSession: saveSession,
  getDoc: function () {
    return view.state.doc.toString();
  },
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
    var info = view.state.doc.line(line + 1);
    var pos = info.from + Math.min(ch, info.length);
    view.dispatch({ selection: { anchor: pos } });
  },
  flash: flash,
  updateBufferDisplay: updateBufferName,
});
editorAPI.bufferManager = bufferManager;

// ── Register vim config ─────────────────────────────────
registerVimOptions(state, flash, editorAPI);
registerExrc(flash, editorAPI);

var exrcAPI = {
  isEditing: isEditingExrc,
  write: function () {
    exrcWrite(editorAPI, flash);
  },
  writeQuit: function () {
    exrcWriteQuit(editorAPI, flash);
  },
  quit: function (bang) {
    exrcQuit(editorAPI, flash, bang);
  },
};

registerExCommands(state, flash, doShowTab, editorAPI, exrcAPI);
registerGqOperator(state);
registerArrowClamp();
registerMappings();

var abbrExtension = registerAbbreviations(flash);
view.dispatch({
  effects: abbreviationsCompartment.reconfigure(abbrExtension),
});

// ── Wire up vim-mode-change ─────────────────────────────
cm.on('vim-mode-change', updateMode);

// ── Wire up textwidth wrapping ──────────────────────────
cm.on('change', function (cmInstance, changeObj) {
  handleTextwidthWrap(cmInstance, changeObj, state);
});

// ── Tab click handlers ──────────────────────────────────
document.getElementById('tab-editor').addEventListener('click', function () {
  doShowTab('editor');
});
document.getElementById('tab-preview').addEventListener('click', function () {
  doShowTab('preview');
});
document.getElementById('tab-help').addEventListener('click', function () {
  doShowTab('help');
});

// ── Backslash to return to editor from preview/help ─────
document.addEventListener('keydown', function (e) {
  if (e.key === '\\' && state.currentTab !== 'editor') {
    e.preventDefault();
    doShowTab('editor');
  }
});

// ── Execute exrc before loading content ──────────────────
executeExrc(cm);

// ── Test harness (vi.html?test) ──────────────────────────
installTestHarness(view, cm, state, editorAPI);

// Set initial cursor position display
var initialPos = view.state.selection.main.head;
var initialLine = view.state.doc.lineAt(initialPos);
updateStatusPos(initialLine.number - 1, initialPos - initialLine.from);
