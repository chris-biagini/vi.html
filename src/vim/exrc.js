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

// ── Register :exrc command and exrc-mode :w/:wq/:q handlers ─
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

  // Internal commands used by the exrc-aware routing in commands.js
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

  Vim.defineEx('exrcwritequit', '', function () {
    if (!exrcState.active) return;
    saveExrc(editorAPI.getDoc());
    editorAPI.setDoc(exrcState.savedDoc);
    exrcState.active = false;
    exrcState.savedDoc = null;
    editorAPI.setStatusIndicator(null);
    executeExrc(editorAPI.getCM());
  });
}
