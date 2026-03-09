/**
 * Vim abbreviations
 *
 * Insert-mode abbreviations that expand when a non-keyword character is typed.
 * Supports :abbreviate, :unabbreviate, and :abclear Ex commands.
 * See: https://vimhelp.org/map.txt.html#Abbreviations
 * Source: https://github.com/vim/vim/blob/master/src/map.c
 */
import { Vim, getCM } from '@replit/codemirror-vim';
import { EditorView } from '@codemirror/view';
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

// ── Expansion logic (pure, testable) ─────────────────────
// Given the document text, cursor position, trigger character, and the
// abbreviation map, returns the CM6 change spec or null if no expansion.
export function computeExpansion(docText, cursorPos, triggerChar, abbrMap) {
  if (triggerChar.length !== 1 || isKeyword(triggerChar)) return null;
  if (Object.keys(abbrMap).length === 0) return null;
  var result = extractWord(docText, cursorPos);
  if (!result) return null;
  var expansion = abbrMap[result.word];
  if (!expansion) return null;
  return { from: result.from, to: result.to, insert: expansion + triggerChar };
}

// ── Ex commands and inputHandler ─────────────────────────
export function registerAbbreviations(flashFn) {
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
  });

  Vim.defineEx('abclear', 'abc', function () {
    abbreviations = {};
    flashFn('All abbreviations cleared', 8000);
  });

  var inputHandler = EditorView.inputHandler.of(
    function (view, from, _to, text) {
      // Only expand in insert mode
      var cmInstance = getCM(view);
      if (
        !cmInstance ||
        !cmInstance.state.vim ||
        !cmInstance.state.vim.insertMode
      ) {
        return false;
      }

      var docText = view.state.doc.toString();
      var change = computeExpansion(docText, from, text, abbreviations);
      if (!change) return false;

      view.dispatch({ changes: change });
      return true;
    },
  );

  return inputHandler;
}
