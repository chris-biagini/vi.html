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
