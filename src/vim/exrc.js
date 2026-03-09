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

// ── Exrc action functions ────────────────────────────────
// These are called by both the internal Vim.defineEx handlers
// and the exrcAPI in main.js for :w/:wq/:q routing.

export function exrcWrite(editorAPI, flashFn) {
  if (!exrcState.active) return;
  saveExrc(editorAPI.getDoc());
  flashFn('exrc saved');
}

export function exrcQuit(editorAPI, _flashFn, bang) {
  if (!exrcState.active) return;
  if (!bang) {
    saveExrc(editorAPI.getDoc());
  }
  editorAPI.setDoc(exrcState.savedDoc);
  exrcState.active = false;
  exrcState.savedDoc = null;
  editorAPI.setStatusIndicator(null);
  if (!bang) {
    executeExrc(editorAPI.getCM());
  }
}

export function exrcWriteQuit(editorAPI, _flashFn) {
  if (!exrcState.active) return;
  saveExrc(editorAPI.getDoc());
  editorAPI.setDoc(exrcState.savedDoc);
  exrcState.active = false;
  exrcState.savedDoc = null;
  editorAPI.setStatusIndicator(null);
  executeExrc(editorAPI.getCM());
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

  // Internal commands for direct exrc-mode operations
  Vim.defineEx('exrcwrite', '', function () {
    exrcWrite(editorAPI, flashFn);
  });

  Vim.defineEx('exrcquit', '', function (_cm, params) {
    var bang = params && params.argString && params.argString.includes('!');
    exrcQuit(editorAPI, flashFn, bang);
  });

  Vim.defineEx('exrcwritequit', '', function () {
    exrcWriteQuit(editorAPI, flashFn);
  });
}
