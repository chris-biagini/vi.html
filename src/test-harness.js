/**
 * Interactive test harness
 *
 * Exposes editor internals on window.__vi for interactive Playwright testing.
 * Activated by loading vi.html?test — gated to avoid polluting global scope
 * in normal use.
 *
 * Provides:
 *   window.__vi.view       — CM6 EditorView
 *   window.__vi.cm         — CM5-compat instance
 *   window.__vi.Vim        — Vim API (handleEx, defineOption, etc.)
 *   window.__vi.state      — app state (textwidth, persist, etc.)
 *   window.__vi.editorAPI  — editor API used by vim modules
 *   window.__vi.setDoc(text)    — replace entire document
 *   window.__vi.getDoc()        — get document as string
 *   window.__vi.getCursor()     — { line, ch } (0-indexed)
 *   window.__vi.exec(cmd)       — run Ex command via Vim.handleEx
 *   window.__vi.pressKeys(str)  — dispatch key events (e.g. 'gqap', 'dd')
 *   window.__vi.getFlash()      — current status flash text
 *   window.__vi.getMode()       — current vim mode string
 */
import { Vim } from '@replit/codemirror-vim';

export function installTestHarness(view, cm, state, editorAPI) {
  if (!new URLSearchParams(window.location.search).has('test')) return;

  var content = view.contentDOM;

  function pressKey(key) {
    content.dispatchEvent(
      new KeyboardEvent('keydown', { key: key, bubbles: true }),
    );
    content.dispatchEvent(
      new KeyboardEvent('keyup', { key: key, bubbles: true }),
    );
  }

  window.__vi = {
    view: view,
    cm: cm,
    Vim: Vim,
    state: state,
    editorAPI: editorAPI,

    setDoc: function (text) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      });
    },

    getDoc: function () {
      return view.state.doc.toString();
    },

    getCursor: function () {
      var pos = view.state.selection.main.head;
      var line = view.state.doc.lineAt(pos);
      return { line: line.number - 1, ch: pos - line.from };
    },

    exec: function (cmd) {
      Vim.handleEx(cm, cmd);
    },

    pressKeys: function (keys) {
      for (var i = 0; i < keys.length; i++) {
        pressKey(keys[i]);
      }
    },

    pressKey: pressKey,

    bufferManager: editorAPI.bufferManager,

    getFlash: function () {
      return document.getElementById('status-flash').textContent;
    },

    getMode: function () {
      return document.getElementById('status-mode').textContent;
    },
  };
}
