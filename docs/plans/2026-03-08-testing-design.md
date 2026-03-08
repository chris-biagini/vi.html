# Automated Test System Design

**Issue:** #3 — develop automated test system
**Date:** 2026-03-08

## Summary

Add Vitest unit tests, ESLint + Prettier linting, and CI integration to catch vim fidelity regressions and code quality issues automatically.

## Decisions

- **Test runner:** Vitest — native ESM, zero-config with esbuild, fast watch mode
- **Linting:** ESLint (`eslint:recommended`) + Prettier for formatting
- **No browser testing for now** — vim fidelity lives in pure text transformation functions that are unit-testable. Playwright can be added later if integration bugs emerge that unit tests can't catch.
- **Tests run in CI** (GitHub Actions) and locally via `npm test`. Deploy is blocked on failure.

## Test Infrastructure

### npm Scripts

```json
"test": "vitest run",
"test:watch": "vitest",
"lint": "eslint src/ && prettier --check src/",
"lint:fix": "eslint src/ --fix && prettier --write src/",
"check": "npm run lint && npm run test"
```

### Test File Location

Co-located with source: `src/vim/gq.test.js`, `src/storage.test.js`, etc.

## Test Coverage

### Tier 1: Vim Fidelity (highest priority)

- **gq reflow** (`gq.test.js`) — `wordWrap()` and `reflowRange()` pure functions. Covers: basic reflow at textwidth, paragraph breaks, indented text, multiple paragraphs, edge cases. Each test references the relevant `:help` section.
- **textwidth wrapping** (`textwidth.test.js`) — Insert-mode wrapping logic. Extract core wrapping decision into testable pure function if needed. Covers: word boundary breaks, no mid-word breaks, behavior at exactly textwidth.

### Tier 2: Core Logic

- **storage** (`storage.test.js`) — TTL calculation, content/settings save/load, quota exhaustion. Mock `localStorage`.
- **SmartyPants** (`ui.test.js`) — Smart quote and dash replacement (pure string transform).

### Tier 3: Build Verification

- **build smoke test** (`build.test.js`) — Run `node build.js`, verify `vi.html` exists and contains expected markers.

### Intentionally Skipped

- CM6 integration (needs real browser)
- Tab switching, preview rendering, status bar (UI layer)
- Key mappings (thin wrappers around `Vim.mapCommand`)

## Vim Fidelity Test Pattern

```js
/**
 * gq reflow — vim fidelity tests
 * Reference: :help gq (change.txt), :help textwidth (options.txt)
 */
describe('gq reflow', () => {
  describe('wordWrap (single line)', () => {
    test('wraps line exceeding textwidth at word boundary', ...)
    test('does not wrap line shorter than textwidth', ...)
    test('handles word longer than textwidth', ...)
  })

  describe('reflowRange (paragraph)', () => {
    test('reflows multi-line paragraph to textwidth', ...)
    test('preserves blank line between paragraphs', ...)
    test('preserves leading indentation', ...)
  })
})
```

Conventions:
- Describe blocks match the function being tested
- Test names describe expected vim behavior, not implementation
- Comments reference specific `:help` topics
- Bug-fix tests note the issue that prompted them

## CI Pipeline

Current: `checkout -> setup node -> npm ci -> build:min -> deploy`

New: `checkout -> setup node -> npm ci -> lint -> test -> build:min -> deploy`

Added steps in `deploy.yml` before build:

```yaml
- name: Lint
  run: npm run lint

- name: Test
  run: npm test
```

Single job, sequential steps. Either failure blocks deploy.
