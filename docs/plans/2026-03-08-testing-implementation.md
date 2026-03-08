# Automated Test System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add Vitest unit tests, ESLint + Prettier, and CI integration to catch vim fidelity regressions and code quality issues on every push.

**Architecture:** Vitest tests run against source modules in `src/` directly (not the bundled vi.html). Pure functions are exported for testability. ESLint + Prettier enforce code quality. CI runs lint + test before build, blocking deploy on failure.

**Tech Stack:** Vitest, ESLint 9 (flat config), Prettier, eslint-config-prettier

---

### Task 0: Install dev dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install test and lint dependencies**

Run:
```bash
npm install --save-dev vitest eslint prettier eslint-config-prettier @eslint/js
```

**Step 2: Verify package.json updated**

Run: `cat package.json | grep -E "vitest|eslint|prettier"`
Expected: All five packages listed in devDependencies.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest, eslint, prettier dev dependencies"
```

---

### Task 1: Configure Vitest, ESLint, Prettier

**Files:**
- Create: `vitest.config.js`
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Create: `.prettierignore`

**Step 1: Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
  },
});
```

**Step 2: Create eslint.config.js**

```js
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettier,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['build.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
  },
  {
    ignores: ['vi.html', 'node_modules/', 'docs/'],
  },
];
```

**Step 3: Create .prettierrc**

```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

**Step 4: Create .prettierignore**

```
vi.html
node_modules
docs/
```

**Step 5: Run ESLint to check for issues**

Run: `npx eslint src/`
Expected: May report existing issues. Note them — we'll fix in a separate step if needed.

**Step 6: Run Prettier check**

Run: `npx prettier --check src/`
Expected: May report formatting differences. Note them.

**Step 7: Fix any lint/format issues**

Run: `npx eslint src/ --fix && npx prettier --write src/`

Review the changes — ensure no behavioral modifications, only style.

**Step 8: Commit**

```bash
git add vitest.config.js eslint.config.js .prettierrc .prettierignore src/
git commit -m "chore: configure vitest, eslint, and prettier"
```

---

### Task 2: Add npm scripts

**Files:**
- Modify: `package.json:7-11` (scripts section)

**Step 1: Add test and lint scripts to package.json**

Replace the scripts block with:

```json
"scripts": {
  "build": "node build.js",
  "build:min": "node build.js --minify",
  "dev": "node build.js --watch",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "eslint src/ && prettier --check src/",
  "lint:fix": "eslint src/ --fix && prettier --write src/",
  "check": "npm run lint && npm run test"
}
```

**Step 2: Verify scripts work**

Run: `npm run lint`
Expected: Clean exit (0).

Run: `npm test`
Expected: "No test files found" or similar (no tests written yet). Exit 0 or 1 depending on vitest behavior with no tests — either is fine at this stage.

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test, lint, and check npm scripts"
```

---

### Task 3: Export pure functions from gq.js

**Files:**
- Modify: `src/vim/gq.js:56` and `src/vim/gq.js:14`

**Step 1: Export wordWrap and reflowRange**

`wordWrap` is fully pure (text in, text out). `reflowRange` takes a `cm` object but only uses `getLine()` and `replaceRange()`, making it testable with a simple mock.

Change line 14 of `src/vim/gq.js` from:
```js
function reflowRange(cm, fromLine, toLine, width) {
```
to:
```js
export function reflowRange(cm, fromLine, toLine, width) {
```

Change line 56 of `src/vim/gq.js` from:
```js
function wordWrap(text, width, indent) {
```
to:
```js
export function wordWrap(text, width, indent) {
```

**Step 2: Verify build still works**

Run: `npm run build`
Expected: "Built vi.html" with no errors.

**Step 3: Commit**

```bash
git add src/vim/gq.js
git commit -m "refactor: export wordWrap and reflowRange for testability"
```

---

### Task 4: Write gq vim fidelity tests

**Files:**
- Create: `src/vim/gq.test.js`

**Step 1: Write the test file**

```js
/**
 * gq reflow — vim fidelity tests
 * Reference: :help gq (change.txt), :help textwidth (options.txt)
 */
import { describe, test, expect } from 'vitest';
import { wordWrap, reflowRange } from './gq.js';

// Mock CM5 editor object for reflowRange tests
function mockCm(lines) {
  const state = [...lines];
  return {
    getLine(n) {
      return state[n];
    },
    replaceRange(text, from, to) {
      const before = state.slice(0, from.line);
      const after = state.slice(to.line + 1);
      const newLines = text.split('\n');
      state.length = 0;
      state.push(...before, ...newLines, ...after);
    },
    result() {
      return state.slice();
    },
  };
}

describe('wordWrap', () => {
  // :help gq — "Text is formatted to textwidth columns"
  test('wraps line exceeding textwidth at last word boundary', () => {
    const result = wordWrap('the quick brown fox jumps over the lazy dog', 20, '');
    expect(result).toBe('the quick brown fox\njumps over the lazy\ndog');
  });

  test('does not wrap line shorter than textwidth', () => {
    const result = wordWrap('short line', 80, '');
    expect(result).toBe('short line');
  });

  test('does not wrap line equal to textwidth', () => {
    const result = wordWrap('exactly ten', 11, '');
    expect(result).toBe('exactly ten');
  });

  // :help gq — word longer than textwidth goes on its own line
  test('keeps word longer than textwidth on its own line', () => {
    const result = wordWrap('short superlongwordthatexceedstextwidth end', 10, '');
    expect(result).toBe('short\nsuperlongwordthatexceedstextwidth\nend');
  });

  // :help gq — indentation is preserved
  test('preserves indentation on wrapped lines', () => {
    const result = wordWrap('the quick brown fox jumps over', 20, '  ');
    expect(result).toBe('  the quick brown\n  fox jumps over');
  });

  test('handles empty string', () => {
    const result = wordWrap('', 80, '');
    expect(result).toBe('');
  });

  test('handles single word', () => {
    const result = wordWrap('hello', 80, '');
    expect(result).toBe('hello');
  });
});

describe('reflowRange', () => {
  // :help gq — reflows a range of lines to textwidth
  test('reflows multi-line paragraph to textwidth', () => {
    const cm = mockCm([
      'the quick brown',
      'fox jumps over the lazy dog',
    ]);
    reflowRange(cm, 0, 1, 20);
    expect(cm.result()).toEqual([
      'the quick brown fox',
      'jumps over the lazy',
      'dog',
    ]);
  });

  // :help gq — blank lines separate paragraphs
  test('preserves blank line between paragraphs', () => {
    const cm = mockCm([
      'first paragraph text here',
      '',
      'second paragraph text here',
    ]);
    reflowRange(cm, 0, 2, 20);
    expect(cm.result()).toEqual([
      'first paragraph',
      'text here',
      '',
      'second paragraph',
      'text here',
    ]);
  });

  // :help gq — indentation is preserved
  test('preserves leading indentation', () => {
    const cm = mockCm([
      '  indented text that should be wrapped properly',
    ]);
    reflowRange(cm, 0, 0, 20);
    expect(cm.result()).toEqual([
      '  indented text',
      '  that should be',
      '  wrapped properly',
    ]);
  });

  test('handles already-wrapped text (no change needed)', () => {
    const cm = mockCm([
      'short line',
    ]);
    reflowRange(cm, 0, 0, 80);
    expect(cm.result()).toEqual([
      'short line',
    ]);
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/vim/gq.test.js`
Expected: All tests pass. If any fail, debug the test expectations against the actual `wordWrap`/`reflowRange` behavior and fix the test.

**Step 3: Commit**

```bash
git add src/vim/gq.test.js
git commit -m "test: add gq reflow vim fidelity tests"
```

---

### Task 5: Write storage tests

**Files:**
- Create: `src/storage.test.js`

**Step 1: Write the test file**

```js
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  saveContent,
  loadContent,
  saveSettings,
  loadSettings,
  loadPersistFlag,
  savePersistFlag,
  clearContent,
  refreshTTL,
  lsGet,
  lsSet,
  lsRemove,
} from './storage.js';

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

describe('lsGet / lsSet / lsRemove', () => {
  test('lsSet stores and lsGet retrieves', () => {
    lsSet('key', 'value');
    expect(lsGet('key')).toBe('value');
  });

  test('lsGet returns null for missing key', () => {
    expect(lsGet('missing')).toBeNull();
  });

  test('lsRemove deletes key', () => {
    lsSet('key', 'value');
    lsRemove('key');
    expect(lsGet('key')).toBeNull();
  });
});

describe('saveContent / loadContent', () => {
  test('saves and loads content when persist is true', () => {
    saveContent('hello world', true);
    expect(loadContent()).toBe('hello world');
  });

  test('does not save when persist is false', () => {
    saveContent('hello world', false);
    expect(loadContent()).toBeNull();
  });

  test('returns null when TTL has expired', () => {
    saveContent('hello', true);
    // Manually set TTL to the past
    store['vihtml_content_ttl'] = String(Date.now() - 1000);
    expect(loadContent()).toBeNull();
  });

  test('clearContent removes content and TTL', () => {
    saveContent('hello', true);
    clearContent();
    expect(loadContent()).toBeNull();
  });
});

describe('refreshTTL', () => {
  test('sets TTL to ~7 days in the future', () => {
    const before = Date.now();
    refreshTTL();
    const ttl = parseInt(store['vihtml_content_ttl'], 10);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(ttl).toBeGreaterThanOrEqual(before + sevenDays - 100);
    expect(ttl).toBeLessThanOrEqual(before + sevenDays + 100);
  });
});

describe('saveSettings / loadSettings', () => {
  test('saves and loads settings object', () => {
    const settings = { tabstop: 4, number: true };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  test('returns null when no settings saved', () => {
    expect(loadSettings()).toBeNull();
  });

  test('returns null for corrupted JSON', () => {
    store['vihtml_settings'] = 'not json';
    expect(loadSettings()).toBeNull();
  });
});

describe('savePersistFlag / loadPersistFlag', () => {
  test('defaults to true when no flag set', () => {
    expect(loadPersistFlag()).toBe(true);
  });

  test('returns false when flag is "0"', () => {
    savePersistFlag(false);
    expect(loadPersistFlag()).toBe(false);
  });

  test('returns true when flag is "1"', () => {
    savePersistFlag(true);
    expect(loadPersistFlag()).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/storage.test.js`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/storage.test.js
git commit -m "test: add storage module tests"
```

---

### Task 6: Write SmartyPants / educateText tests

**Files:**
- Create: `src/ui.test.js`

**Step 1: Write the test file**

```js
import { describe, test, expect } from 'vitest';
import { educateText, smartyPants } from './ui.js';

describe('educateText', () => {
  test('converts straight double quotes to curly quotes', () => {
    expect(educateText('"hello"')).toBe('\u201Chello\u201D');
  });

  test('converts straight single quotes to curly quotes', () => {
    expect(educateText("'hello'")).toBe('\u2018hello\u2019');
  });

  test('converts apostrophes in contractions', () => {
    expect(educateText("don't")).toBe('don\u2019t');
  });

  test('converts --- to em dash', () => {
    expect(educateText('word---word')).toBe('word\u2014word');
  });

  test('converts -- to en dash', () => {
    expect(educateText('word--word')).toBe('word\u2013word');
  });

  test('converts ... to ellipsis', () => {
    expect(educateText('wait...')).toBe('wait\u2026');
  });

  test('handles &quot; entities', () => {
    expect(educateText('&quot;hello&quot;')).toBe('\u201Chello\u201D');
  });
});

describe('smartyPants', () => {
  test('applies typography to plain text', () => {
    const result = smartyPants('<p>"hello"</p>');
    expect(result).toBe('<p>\u201Chello\u201D</p>');
  });

  test('does not modify text inside code tags', () => {
    const result = smartyPants('<code>"hello"</code>');
    expect(result).toBe('<code>"hello"</code>');
  });

  test('does not modify text inside pre tags', () => {
    const result = smartyPants('<pre>"hello"</pre>');
    expect(result).toBe('<pre>"hello"</pre>');
  });

  test('handles mixed code and text', () => {
    const result = smartyPants('<p>"smart"</p><code>"raw"</code><p>"smart"</p>');
    expect(result).toBe(
      '<p>\u201Csmart\u201D</p><code>"raw"</code><p>\u201Csmart\u201D</p>',
    );
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/ui.test.js`
Expected: All tests pass. Note: `ui.js` imports `marked` at the top — vitest handles this since marked is installed. The DOM-dependent functions (`initStatusBar`, etc.) are function definitions, not calls, so they won't execute at import time.

**Step 3: Commit**

```bash
git add src/ui.test.js
git commit -m "test: add SmartyPants typography tests"
```

---

### Task 7: Extract textwidth break-point logic and write tests

**Files:**
- Modify: `src/vim/textwidth.js`
- Create: `src/vim/textwidth.test.js`

**Step 1: Extract the pure break-point function**

Add this new exported function to `src/vim/textwidth.js` before `handleTextwidthWrap`:

```js
export function findBreakPoint(lineText, textwidth) {
  if (lineText.length <= textwidth) return -1;
  for (var i = textwidth; i >= 0; i--) {
    if (lineText[i] === ' ') return i;
  }
  return -1;
}
```

Then update `handleTextwidthWrap` to use it — replace the breakAt logic (lines 27-33) with:

```js
  var breakAt = findBreakPoint(lineText, state.textwidth);
  if (breakAt <= 0) return;
```

**Step 2: Verify build still works**

Run: `npm run build`
Expected: "Built vi.html" with no errors.

**Step 3: Write the test file**

```js
/**
 * textwidth auto-wrap — vim fidelity tests
 * Reference: :help textwidth (options.txt), :help auto-format (change.txt)
 */
import { describe, test, expect } from 'vitest';
import { findBreakPoint } from './textwidth.js';

describe('findBreakPoint', () => {
  // :help textwidth — "lines longer than textwidth are broken"
  test('returns last space at or before textwidth', () => {
    expect(findBreakPoint('the quick brown fox jumps', 20)).toBe(19);
  });

  test('returns -1 when line is within textwidth', () => {
    expect(findBreakPoint('short line', 80)).toBe(-1);
  });

  test('returns -1 when line equals textwidth', () => {
    expect(findBreakPoint('exactly ten', 11)).toBe(-1);
  });

  // :help textwidth — no space to break at means no break
  test('returns -1 when no space found before textwidth', () => {
    expect(findBreakPoint('superlongwordwithoutanyspaces', 10)).toBe(-1);
  });

  test('finds space exactly at textwidth position', () => {
    expect(findBreakPoint('hello world', 5)).toBe(5);
  });

  // :help textwidth — preserves indentation context
  test('finds break point in indented line', () => {
    const line = '    indented text that wraps';
    const bp = findBreakPoint(line, 20);
    expect(bp).toBeGreaterThan(0);
    expect(line[bp]).toBe(' ');
    expect(bp).toBeLessThanOrEqual(20);
  });
});
```

**Step 4: Run tests**

Run: `npx vitest run src/vim/textwidth.test.js`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/vim/textwidth.js src/vim/textwidth.test.js
git commit -m "refactor: extract findBreakPoint; add textwidth vim fidelity tests"
```

---

### Task 8: Write build smoke test

**Files:**
- Create: `src/build.test.js`

**Step 1: Write the test file**

```js
import { describe, test, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync, existsSync, unlinkSync } from 'fs';

describe('build', () => {
  test('build.js produces vi.html with expected content', () => {
    // Clean up any existing build artifact
    if (existsSync('vi.html')) unlinkSync('vi.html');

    execFileSync('node', ['build.js'], { stdio: 'pipe' });

    expect(existsSync('vi.html')).toBe(true);

    const html = readFileSync('vi.html', 'utf8');

    // Should contain the HTML skeleton
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<textarea');

    // Should contain bundled JS (CodeMirror markers)
    expect(html).toContain('EditorView');

    // Should contain bundled CSS
    expect(html).toContain('.cm-editor');
  });
});
```

**Step 2: Run test**

Run: `npx vitest run src/build.test.js`
Expected: Pass (build runs and vi.html is produced with expected markers).

**Step 3: Commit**

```bash
git add src/build.test.js
git commit -m "test: add build smoke test"
```

---

### Task 9: Run full test suite and fix any issues

**Step 1: Run all tests**

Run: `npm test`
Expected: All test files pass.

**Step 2: Run full check (lint + test)**

Run: `npm run check`
Expected: Clean exit.

**Step 3: Commit any fixes if needed**

---

### Task 10: Update CI pipeline

**Files:**
- Modify: `.github/workflows/deploy.yml:25-26`

**Step 1: Add lint and test steps before build**

Insert after the `npm ci` step and before the build step:

```yaml
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm test
```

The build job steps should now be:
```yaml
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm test
      - run: node build.js --minify
      - run: mkdir _site && cp vi.html _site/index.html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
```

**Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add lint and test steps to deploy pipeline"
```

---

### Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the Development section**

Add these commands:
```markdown
- `npm test` — run tests (vitest)
- `npm run test:watch` — run tests in watch mode
- `npm run lint` — check lint + formatting (eslint + prettier)
- `npm run lint:fix` — auto-fix lint + formatting issues
- `npm run check` — lint + test (what CI runs)
```

Replace "No test runner or linter configured" with:
```markdown
- Tests use Vitest. Test files are co-located with source (`*.test.js`).
- Linting uses ESLint (flat config) + Prettier. Config in `eslint.config.js` and `.prettierrc`.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with test and lint commands"
```
