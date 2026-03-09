/**
 * Vim abbreviations
 *
 * Insert-mode abbreviations that expand when a non-keyword character is typed.
 * Supports :abbreviate, :unabbreviate, and :abclear Ex commands.
 * Abbreviations persist to localStorage across sessions.
 *
 * See: https://vimhelp.org/map.txt.html#Abbreviations
 * Source: https://github.com/vim/vim/blob/master/src/map.c
 */
import { Vim, getCM } from '@replit/codemirror-vim';
import { EditorView } from '@codemirror/view';
import { lsGet, lsSet, lsRemove } from '../storage.js';

var LS_KEY = 'vihtml_abbreviations';

// ── Keyword character test ──────────────────────────────
// :help iskeyword — default is @,48-57,_,192-255
// We simplify to [a-zA-Z0-9_] for ASCII.
var KEYWORD_RE = /[a-zA-Z0-9_]/;

export function isKeyword(ch) {
  return KEYWORD_RE.test(ch);
}

// ── Abbreviation map ────────────────────────────────────
var abbreviations = {};

export function getAbbreviations() {
  return abbreviations;
}

function saveAbbreviations() {
  if (Object.keys(abbreviations).length === 0) {
    lsRemove(LS_KEY);
  } else {
    lsSet(LS_KEY, JSON.stringify(abbreviations));
  }
}

function loadAbbreviations() {
  var raw = lsGet(LS_KEY);
  if (!raw) return;
  try {
    abbreviations = JSON.parse(raw);
  } catch (_e) {
    abbreviations = {};
  }
}

// ── Word extraction ─────────────────────────────────────
// Given a document string and a cursor position (the position just before
// the trigger character), extract the preceding keyword-character word
// and verify it has a word boundary before it.
// Returns { word, from, to } or null.
export function extractWord(docText, pos) {
  if (pos <= 0) return null;
  var to = pos;
  var from = pos;
  // Walk back over keyword characters
  while (from > 0 && isKeyword(docText[from - 1])) {
    from--;
  }
  if (from === to) return null; // no keyword chars found
  // Check word boundary: char before `from` must be non-keyword or start of line
  if (from > 0 && isKeyword(docText[from - 1])) return null;
  return { word: docText.slice(from, to), from: from, to: to };
}

// ── Ex commands and inputHandler ─────────────────────────
export function registerAbbreviations(flashFn) {
  loadAbbreviations();

  Vim.defineEx('abbreviate', 'ab', function (_cm, params) {
    var args = params.args || [];
    if (args.length === 0) {
      // List all abbreviations
      var keys = Object.keys(abbreviations);
      if (keys.length === 0) {
        flashFn('No abbreviations defined', 8000);
      } else {
        var lines = keys.map(function (k) {
          return k + ' ' + abbreviations[k];
        });
        flashFn(lines.join('\n'), 8000);
      }
      return;
    }
    var lhs = args[0];
    if (args.length === 1) {
      // Show single abbreviation
      if (abbreviations[lhs]) {
        flashFn(lhs + ' ' + abbreviations[lhs], 8000);
      } else {
        flashFn('No abbreviation found for ' + lhs, 8000);
      }
      return;
    }
    // Define abbreviation: first arg = lhs, rest = rhs
    var rhs = args.slice(1).join(' ');
    abbreviations[lhs] = rhs;
    saveAbbreviations();
  });

  Vim.defineEx('unabbreviate', 'una', function (_cm, params) {
    var args = params.args || [];
    if (args.length === 0) {
      flashFn('E474: No argument supplied', 8000);
      return;
    }
    var lhs = args[0];
    if (!abbreviations[lhs]) {
      flashFn('E24: No such abbreviation: ' + lhs, 8000);
      return;
    }
    delete abbreviations[lhs];
    saveAbbreviations();
  });

  Vim.defineEx('abclear', 'abc', function () {
    abbreviations = {};
    saveAbbreviations();
    flashFn('All abbreviations cleared', 8000);
  });

  var inputHandler = EditorView.inputHandler.of(
    function (view, from, to, text) {
      // Only expand on single non-keyword character input
      if (text.length !== 1 || isKeyword(text)) return false;

      // Only expand in insert mode
      var cmInstance = getCM(view);
      if (
        !cmInstance ||
        !cmInstance.state.vim ||
        !cmInstance.state.vim.insertMode
      ) {
        return false;
      }

      // No abbreviations defined — fast path
      if (Object.keys(abbreviations).length === 0) return false;

      // Extract the word just before the cursor
      var docText = view.state.doc.toString();
      var result = extractWord(docText, from);
      if (!result) return false;

      // Check if it matches an abbreviation
      var expansion = abbreviations[result.word];
      if (!expansion) return false;

      // Replace the abbreviation with its expansion, then insert the trigger char
      view.dispatch({
        changes: [
          { from: result.from, to: result.to, insert: expansion },
          { from: result.from + expansion.length, insert: text },
        ],
      });
      return true;
    },
  );

  return inputHandler;
}
