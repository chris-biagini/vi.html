# Vim Abbreviations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add vim-style insert-mode abbreviations (`:ab`, `:una`, `:abc`) with localStorage persistence.

**Architecture:** New module `src/vim/abbreviations.js` following the existing pattern (import Vim, export a registration function). Abbreviation map stored in-memory and persisted to localStorage. Expansion via CM6 `EditorView.inputHandler` that checks for abbreviation matches when a non-keyword character is typed in insert mode.

**Tech Stack:** `@replit/codemirror-vim` (Vim API, getCM), `@codemirror/view` (EditorView.inputHandler), localStorage (persistence).

---

### Task 1: Create abbreviation storage and pure helper functions

**Files:**
- Create: `src/vim/abbreviations.js`

**Step 1: Write the initial module with storage functions and helpers**

```javascript
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
// :help langmap — default iskeyword is @,48-57,_,192-255
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
```

**Step 2: Commit**

```bash
git add src/vim/abbreviations.js
git commit -m "feat(abbreviations): add storage and word extraction helpers"
```

---

### Task 2: Write tests for storage and extractWord

**Files:**
- Create: `src/vim/abbreviations.test.js`

**Step 1: Write failing tests**

```javascript
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { isKeyword, extractWord, getAbbreviations } from './abbreviations.js';

// Mock localStorage
const store = {};
const mockLocalStorage = {
  getItem: vi.fn((k) => (k in store ? store[k] : null)),
  setItem: vi.fn((k, v) => {
    store[k] = String(v);
  }),
  removeItem: vi.fn((k) => {
    delete store[k];
  }),
};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', mockLocalStorage);
});

describe('isKeyword', () => {
  test('letters are keyword characters', () => {
    expect(isKeyword('a')).toBe(true);
    expect(isKeyword('Z')).toBe(true);
  });

  test('digits are keyword characters', () => {
    expect(isKeyword('0')).toBe(true);
    expect(isKeyword('9')).toBe(true);
  });

  test('underscore is a keyword character', () => {
    expect(isKeyword('_')).toBe(true);
  });

  test('space is not a keyword character', () => {
    expect(isKeyword(' ')).toBe(false);
  });

  test('punctuation is not a keyword character', () => {
    expect(isKeyword('.')).toBe(false);
    expect(isKeyword(',')).toBe(false);
    expect(isKeyword('!')).toBe(false);
  });
});

describe('extractWord', () => {
  // :help abbreviations — abbreviation must be preceded by non-keyword or SOL
  test('extracts word at end of string', () => {
    expect(extractWord('hello teh', 9)).toEqual({
      word: 'teh',
      from: 6,
      to: 9,
    });
  });

  test('extracts word after space', () => {
    expect(extractWord('the teh', 7)).toEqual({
      word: 'teh',
      from: 4,
      to: 7,
    });
  });

  test('extracts word at start of line', () => {
    expect(extractWord('teh', 3)).toEqual({ word: 'teh', from: 0, to: 3 });
  });

  test('returns null when pos is 0', () => {
    expect(extractWord('teh', 0)).toBeNull();
  });

  test('returns null when no keyword chars before pos', () => {
    expect(extractWord('   ', 3)).toBeNull();
  });

  test('returns null when word is part of a longer keyword word', () => {
    // "ateh" — "teh" is not at a word boundary
    expect(extractWord('ateh', 4)).toEqual({
      word: 'ateh',
      from: 0,
      to: 4,
    });
  });

  test('word boundary after punctuation', () => {
    expect(extractWord('x.teh', 5)).toEqual({
      word: 'teh',
      from: 2,
      to: 5,
    });
  });

  test('word boundary after newline', () => {
    expect(extractWord('line1\nteh', 9)).toEqual({
      word: 'teh',
      from: 6,
      to: 9,
    });
  });
});
```

**Step 2: Run tests to verify they pass**

```bash
npm test -- --run src/vim/abbreviations.test.js
```

Expected: PASS (these test the already-written pure functions)

**Step 3: Commit**

```bash
git add src/vim/abbreviations.test.js
git commit -m "test(abbreviations): add tests for isKeyword and extractWord"
```

---

### Task 3: Add Ex commands (:ab, :una, :abc)

**Files:**
- Modify: `src/vim/abbreviations.js`

**Step 1: Add the registerAbbreviations function with Ex commands**

Append to `src/vim/abbreviations.js`:

```javascript
// ── Registration ────────────────────────────────────────
export function registerAbbreviations(flashFn) {
  loadAbbreviations();

  // :abbreviate [lhs rhs...] — define or list abbreviations
  // :help :abbreviate
  Vim.defineEx('abbreviate', 'ab', function (_cm, params) {
    var args = params.args;
    if (!args || args.length === 0) {
      // List all abbreviations
      var entries = Object.keys(abbreviations);
      if (entries.length === 0) {
        flashFn('No abbreviations defined');
      } else {
        var lines = entries.map(function (k) {
          return k + ' → ' + abbreviations[k];
        });
        flashFn(lines.join('  |  '), 8000);
      }
      return;
    }
    // Define: first arg is lhs, rest is rhs
    var argStr = args.join(' ');
    var spaceIdx = argStr.indexOf(' ');
    if (spaceIdx === -1) {
      // Single arg — show that abbreviation if it exists
      if (abbreviations[argStr]) {
        flashFn(argStr + ' → ' + abbreviations[argStr]);
      } else {
        flashFn('No abbreviation for ' + argStr);
      }
      return;
    }
    var lhs = argStr.slice(0, spaceIdx);
    var rhs = argStr.slice(spaceIdx + 1);
    abbreviations[lhs] = rhs;
    saveAbbreviations();
  });

  // :unabbreviate {lhs} — remove an abbreviation
  // :help :unabbreviate
  Vim.defineEx('unabbreviate', 'una', function (_cm, params) {
    var args = params.args;
    if (!args || args.length === 0) {
      flashFn('Argument required');
      return;
    }
    var lhs = args[0];
    if (!(lhs in abbreviations)) {
      flashFn('No such abbreviation: ' + lhs);
      return;
    }
    delete abbreviations[lhs];
    saveAbbreviations();
  });

  // :abclear — remove all abbreviations
  // :help :abclear
  Vim.defineEx('abclear', 'abc', function (_cm) {
    abbreviations = {};
    saveAbbreviations();
    flashFn('Abbreviations cleared');
  });

  // Return the inputHandler extension (Task 4 will fill this in)
  return [];
}
```

**Step 2: Commit**

```bash
git add src/vim/abbreviations.js
git commit -m "feat(abbreviations): add :ab, :una, :abc Ex commands"
```

---

### Task 4: Write tests for Ex commands

**Files:**
- Modify: `src/vim/abbreviations.test.js`

**Step 1: Add Ex command tests**

These tests call `registerAbbreviations` and then invoke the Ex command handlers by calling `getAbbreviations()` to check state. We need to mock `Vim.defineEx` to capture the handlers, then call them directly.

Add to `abbreviations.test.js`:

```javascript
import {
  isKeyword,
  extractWord,
  getAbbreviations,
  registerAbbreviations,
} from './abbreviations.js';

// Mock Vim.defineEx to capture registered command handlers
vi.mock('@replit/codemirror-vim', () => {
  const commands = {};
  return {
    Vim: {
      defineEx: vi.fn((name, abbr, fn) => {
        commands[name] = fn;
      }),
    },
    getCM: vi.fn(),
    _getCommands: () => commands,
  };
});

// Import the mock to access captured commands
import { _getCommands } from '@replit/codemirror-vim';

describe('Ex commands', () => {
  let flashFn;
  let commands;

  beforeEach(() => {
    flashFn = vi.fn();
    registerAbbreviations(flashFn);
    commands = _getCommands();
    // Clear any abbreviations from prior tests
    if (commands.abclear) commands.abclear(null, {});
  });

  test(':ab with args defines an abbreviation', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    expect(getAbbreviations()).toHaveProperty('teh', 'the');
  });

  test(':ab with multi-word rhs', () => {
    commands.abbreviate(null, { args: ['sig', 'Best', 'regards,', 'Alice'] });
    expect(getAbbreviations()).toHaveProperty('sig', 'Best regards, Alice');
  });

  test(':ab with no args lists abbreviations', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    commands.abbreviate(null, { args: [] });
    expect(flashFn).toHaveBeenCalledWith(
      expect.stringContaining('teh'),
      8000,
    );
  });

  test(':ab with no args and no abbreviations shows message', () => {
    commands.abbreviate(null, { args: [] });
    expect(flashFn).toHaveBeenCalledWith('No abbreviations defined');
  });

  test(':ab with single arg shows that abbreviation', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    commands.abbreviate(null, { args: ['teh'] });
    expect(flashFn).toHaveBeenCalledWith('teh → the');
  });

  test(':una removes an abbreviation', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    commands.unabbreviate(null, { args: ['teh'] });
    expect(getAbbreviations()).not.toHaveProperty('teh');
  });

  test(':una with unknown lhs shows error', () => {
    commands.unabbreviate(null, { args: ['nope'] });
    expect(flashFn).toHaveBeenCalledWith('No such abbreviation: nope');
  });

  test(':abc clears all abbreviations', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    commands.abbreviate(null, { args: ['hw', 'hello', 'world'] });
    commands.abclear(null, {});
    expect(Object.keys(getAbbreviations())).toHaveLength(0);
  });

  test('abbreviations persist to localStorage', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    expect(store['vihtml_abbreviations']).toBeDefined();
    var parsed = JSON.parse(store['vihtml_abbreviations']);
    expect(parsed).toHaveProperty('teh', 'the');
  });

  test(':abc removes localStorage key', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    commands.abclear(null, {});
    expect(store['vihtml_abbreviations']).toBeUndefined();
  });
});
```

**Step 2: Run tests**

```bash
npm test -- --run src/vim/abbreviations.test.js
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/vim/abbreviations.test.js
git commit -m "test(abbreviations): add Ex command tests"
```

---

### Task 5: Implement the inputHandler expansion logic

**Files:**
- Modify: `src/vim/abbreviations.js`

**Step 1: Replace the `return []` at the end of `registerAbbreviations` with the inputHandler extension**

```javascript
  // ── Insert-mode expansion ───────────────────────────────
  // When a non-keyword character is typed in insert mode, check if the
  // preceding word is an abbreviation and expand it.
  var inputHandler = EditorView.inputHandler.of(function (view, from, to, text) {
    // Only expand on single non-keyword character input
    if (text.length !== 1 || isKeyword(text)) return false;

    // Only expand in insert mode
    var cmInstance = getCM(view);
    if (!cmInstance || !cmInstance.state.vim || !cmInstance.state.vim.insertMode) {
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
  });

  return inputHandler;
```

**Step 2: Commit**

```bash
git add src/vim/abbreviations.js
git commit -m "feat(abbreviations): add insert-mode expansion via inputHandler"
```

---

### Task 6: Integrate into main.js and barrel export

**Files:**
- Modify: `src/vim/index.js:11` — add barrel export
- Modify: `src/main.js:35-41` — add import
- Modify: `src/main.js:92-183` — add extension to EditorView
- Modify: `src/main.js:311-316` — call registerAbbreviations

**Step 1: Add barrel export to `src/vim/index.js`**

Add after line 11:

```javascript
export { registerAbbreviations } from './abbreviations.js';
```

**Step 2: Add import to `src/main.js`**

Add `registerAbbreviations` to the import from `'./vim/index.js'` (line 35-41).

**Step 3: Call registerAbbreviations and add extension to EditorView**

After the existing registration calls (line 316), add:

```javascript
var abbrExtension = registerAbbreviations(flash);
```

The returned extension needs to be added to the view. Since the view is already created, use `view.dispatch` with `StateEffect` to append the extension. However, a simpler approach: create a compartment for abbreviations and reconfigure it after registration.

Actually, the cleanest approach: add a placeholder compartment in the extensions array, then reconfigure it after `registerAbbreviations` returns.

Add a new compartment:

```javascript
var abbreviationsCompartment = new Compartment();
```

Add to extensions array:

```javascript
abbreviationsCompartment.of([]),
```

After `registerAbbreviations` call:

```javascript
var abbrExtension = registerAbbreviations(flash);
view.dispatch({
  effects: abbreviationsCompartment.reconfigure(abbrExtension),
});
```

**Step 4: Commit**

```bash
git add src/vim/index.js src/main.js
git commit -m "feat(abbreviations): wire into editor via barrel export and compartment"
```

---

### Task 7: Build and manual smoke test

**Step 1: Run lint**

```bash
npm run lint:fix
```

**Step 2: Run all tests**

```bash
npm run check
```

Expected: All tests pass, lint clean.

**Step 3: Build**

```bash
npm run build
```

Expected: `vi.html` produced successfully.

**Step 4: Commit any lint fixes**

```bash
git add -A && git commit -m "chore: lint fixes"
```
