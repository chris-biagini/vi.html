# vi.html

Single-file markdown editor with vim keybindings. Source is modular; `vi.html` is built from `src/`.

## Vision

vi.html is a single-file markdown editor for solo prose work — specifically the workflow of writing long documents (10–30 pages) in vim, then pasting clean HTML into Microsoft Word for final delivery. The target environment is a locked-down corporate machine where you can't install software but can open an HTML file in Edge.

## Design North Star

The aesthetic target is the world of *Her* (2013) crossed with Geoff McFetridge's design language — warm, calm, friendly, low-contrast but comfortable. A computer that's a friend, not a hacker tool. An oasis from corporate beige.

Concretely:

- Warm cream / parchment background; espresso text (not harsh black)
- Terracotta or dusty-coral accents
- Generous whitespace and line-height
- Soft rounded forms; gentle easing on transitions
- Rounded sans for chrome; an optional serif for the prose surface itself
- Calm and deliberate, never aggressive

## Architectural Commitments

These are decided. Don't re-litigate.

- **Stays a single static HTML file.** No backend, no telemetry, no WebSockets, no phone-home behavior. GitHub Pages deployment.
- **Stack stays put.** CodeMirror 6 + `@replit/codemirror-vim` + `marked` is the foundation. We are not switching engines or rebuilding vim from scratch.
- **"Nearest native browser feature" pattern.** Before reimplementing a vim feature, ask whether a browser-native equivalent achieves the goal. Spellcheck (`:set spell` → contenteditable `spellcheck` attribute, see `src/main.js` and `src/vim/options.js`) is the model.
- **Verify native CM6 behavior *before* planning.** Before writing a plan that adds Enter/Backspace/Tab/cursor/selection behavior, drive the existing editor through the target scenarios via the `?test` harness and record what already works. CM6 plus `@codemirror/lang-markdown` does more than expected — markdown list continuation (bullets, ordered-with-increment, task-lists-carry-forward, indent preservation) is fully native. Skipping this check once cost an entire feature branch (`docs/plans/2026-04-19-list-continuation.md`), which re-implemented already-working logic and introduced subtle bugs by layering on top of it. Lesson: the first task of any keymap-adjacent plan is a short empirical-survey task that documents current native behavior.
- **Smaller sequenced PRs.** One feature per branch per PR. No grand bundles.
- **Test discipline.** Pure functions are exported and unit-tested. Browser behavior is verified interactively via the `?test` harness.

## Out of Scope (Product-Level)

Considered and explicitly excluded — don't re-litigate. (Vim-feature-specific scope limits live under "Vim Fidelity" below.)

- **Multi-windowing / window splits** (`:split`, `Ctrl-W` family). CM6 is one view; massive scope for marginal value.
- **Tags** (`Ctrl-]`, `:tags`, `gd`/`gD`, `:ts`/`:tj`). No tag files in a browser.
- **Compiling** (`:make`, `:compiler`, quickfix). No build pipeline.
- **Shell** (`:sh`, `:!cmd`), `K` / `keywordprg`, `:hardcopy`. No shell.
- **Real filesystem** (`:e file`, `:r file`, `gf`). Browser sandbox; partial coverage via the existing buffers system is enough.
- **Completion frameworks** (`Ctrl-X Ctrl-*` family). Needs dictionaries / tags / etc.
- **Differential testing infrastructure** (headless nvim oracle). Useful in theory; not worth the budget for this product's goals.
- **Backend / accounts / collaboration.** Rails/Hetzner/Kamal explored and dropped for vi.html proper.
- **Sharing features** (URL-fragment encoding, share-by-link). Irrelevant for the solo-use case.

## Architecture

**Source files in `src/`:**
- `template.html` — HTML skeleton with `/* STYLE */` and `/* SCRIPT */` placeholders
- `style.css` — all CSS (markdown tokens, preview/help pane styles)
- `storage.js` — localStorage helpers (content with 7-day TTL, settings, persist flag)
- `status.js` — status bar (mode, position, flash messages, buffer name, indicators, word count)
- `preview.js` — tab switching, SmartyPants, preview rendering, clipboard HTML (marked.js)
- `wordcount.js` — pure markdown-aware word counter + status-bar indicator formatter
- `vim/` — vim customizations, one file per feature:
  - `vim/textwidth.js` — auto-wrap lines at textwidth during insert mode
  - `vim/gq.js` — gq/gw reflow operators for reformatting paragraphs
  - `vim/arrow-clamp.js` — prevent arrow keys from wrapping across lines in insert mode
  - `vim/abbreviations.js` — insert-mode abbreviations (`:ab`, `:una`, `:abc`)
  - `vim/buffers.js` — multiple named buffers/documents in memory with persistence
  - `vim/clipboard.js` — aliases `"*` register to system clipboard (`"+`)
  - `vim/exrc.js` — persistent Ex command configuration via localStorage
  - `vim/fold.js` — markdown heading folding with vim-style commands (zo, zc, za, zR, zM)
  - `vim/tilde.js` — vim-style `~` tilde lines below end of buffer
  - `vim/options.js` — `:set` options (number, tabstop, textwidth, etc.) via `Vim.defineOption`
  - `vim/commands.js` — Ex commands (:write, :preview, :help, etc.) via `Vim.defineEx`
  - `vim/mappings.js` — custom key mappings (`\p` toggle)
  - `vim/index.js` — barrel re-exporting all modules
- `test-harness.js` — exposes `window.__vi` for interactive Playwright testing (activated by `?test` URL param)
- `main.js` — entry point: CM6 EditorView, compartments for dynamic options, event wiring, state loading

**Dependencies (npm, bundled offline):** CodeMirror 6 (`codemirror`, `@codemirror/lang-markdown`, `@codemirror/view`, `@codemirror/state`), `@replit/codemirror-vim`, `marked`

**Build:** `build.js` uses esbuild to bundle JS+CSS, then inlines into `template.html` → produces `vi.html`. Output is ~880KB minified.

**Build gotcha:** `build.js` uses function replacement (not string patterns) when inlining into `template.html` to avoid `$` pattern interpolation issues with bundled code.

**Module gotcha:** `package.json` has `"type": "commonjs"` but `src/` uses ESM imports (esbuild handles it). Config files that use `import` syntax need `.mjs` extension (e.g., `vitest.config.mjs`, `eslint.config.mjs`).

**Template gotcha:** `template.html` uses lowercase `<!doctype html>` (not `<!DOCTYPE html>`). The editor uses `<div id="editor-container">`, not a `<textarea>`.

**CM6 vim API:** `@replit/codemirror-vim` provides backward-compatible API. Use `import { Vim } from '@replit/codemirror-vim'` and `getCM(view)` for CM5-style methods. Dynamic options use compartments (`new Compartment()`).

**CM6 dispatch gotcha:** Never call `cm.replaceRange()` or `view.dispatch()` synchronously inside a CM5 `change` event handler — CM6 throws "Calls to EditorView.update are not allowed while an update is in progress." Defer with `setTimeout(..., 0)`.

**editorAPI pattern:** Vim modules don't import CM6 directly. `main.js` defines an `editorAPI` object that wraps compartment reconfigurations (e.g., `setTabSize`, `getTabSize`). New vim features needing runtime editor state must add methods here.

## Development

- `npm install` — install dependencies (first time only)
- `npm run build` — build `vi.html`
- `npm run build:min` — build minified
- `npm run dev` — watch mode (rebuilds on changes to `src/`)
- `npm test` — run tests (vitest)
- `npm run test:watch` — run tests in watch mode
- `npm run lint` — check lint + formatting (eslint + prettier)
- `npm run lint:fix` — auto-fix lint + formatting issues
- `npm run check` — lint + test (what CI runs)
- `vi.html` is gitignored (build artifact). GitHub Actions runs lint + test + build on push to main, deploys to Pages.
- Tests use Vitest. Test files are co-located with source (`*.test.js`).
- Linting uses ESLint (flat config) + Prettier. Config in `eslint.config.mjs` and `.prettierrc`.
- ESLint globals are declared manually (no `env: browser`). When using new browser APIs in `src/`, add them to `eslint.config.mjs` globals.

## Testing Conventions

- Vim fidelity tests reference `:help` topics in comments for traceability.
- Pure functions are exported for testability (`wordWrap`, `reflowRange` from gq.js; `findBreakPoint` from textwidth.js; `countWords`, `formatIndicator` from wordcount.js).
- `storage.test.js` mocks `localStorage` via `vi.stubGlobal`. CM5 API mocks only need `getLine()` and `replaceRange()`.
- `npm run check` before pushing — matches what CI runs.

## Vim Fidelity

This is a vim learning tool. Custom vim features (gq, textwidth wrap, Ex commands) must match standard vim behavior. When modifying vim-related code, verify against vim docs (vimhelp.org) or vim source (https://github.com/vim/vim) — do not rely on assumptions. Key references: `:help gq` (change.txt), `:help textwidth` (options.txt), `:help formatoptions` (options.txt), `:help shiftwidth` (options.txt).

Vim scope is calibrated against the [Goerz vim quick reference card](https://michaelgoerz.net/refcards/vimqrc.pdf) ([source](https://github.com/goerz/Refcards/tree/master/vim)) — used as the **negative scope doc**. Anything on the card we explicitly aren't building is captured under "Out of Scope" above. New "do we need feature X?" debates start with "is X on the refcard?" and "is it already classified?"

**Intentional default divergences:** `tabstop=4` (vim: 8), `shiftwidth=4` (vim: 8), `expandtab=on` (vim: off), `number=on` (vim: off). These are UX choices for a markdown editor — do not "fix" them to match vim defaults.

**Not implemented (by design):** `formatoptions` flags (n, 1, 2, w, a). Acceptable scope limit for a markdown editor.

## Browser Testing (Playwright)

Unit tests can't catch bugs that only appear in the real browser (CM6 update cycle errors, CM5 compat layer quirks, event origin mismatches). After adding or modifying a custom vim feature, do an interactive browser test:

1. `npm run build` then serve locally (`python3 -m http.server 9876 --bind 0.0.0.0`)
2. Navigate Playwright to `http://rika:9876/vi.html?test`
3. The `?test` param activates the test harness on `window.__vi`

**Test harness API** (`src/test-harness.js`):
- `__vi.setDoc(text)` / `__vi.getDoc()` — set/get document content
- `__vi.getCursor()` — returns `{ line, ch }` (0-indexed)
- `__vi.exec(cmd)` — run an Ex command (`:set tw=72`, `:ab teh the`, etc.)
- `__vi.pressKeys(str)` — dispatch normal-mode keys (e.g. `__vi.pressKeys('gqap')`)
- `__vi.pressKey(key)` — single key dispatch (e.g. `__vi.pressKey('Escape')`)
- `__vi.view` / `__vi.cm` / `__vi.Vim` / `__vi.state` / `__vi.editorAPI` — raw internals
- `__vi.getFlash()` / `__vi.getMode()` — status bar state

**Known quirks:**
- Ex commands (`:set`, `:ab`, etc.) must use `__vi.exec()` — typing `:` via key events opens a CM6 panel that can't be driven by key dispatch to contentDOM.
- Insert-mode typing (for textwidth/abbreviation tests) must use Playwright's `pressSequentially` on the textbox element — `__vi.pressKeys` only works for normal-mode commands.
- `Vim.defineOption` passes string values to callbacks even for `'number'` type — all number option callbacks must coerce with `Number()`.
- CM5 compat layer change events have `origin: undefined` (not `'+input'` or `null`) — don't rely on origin for filtering.

## Adding Custom Vim Features

When implementing new custom vim features, follow the conventions above. Upon completion, add documentation for the feature to the help page. After implementation, do an interactive browser test (see "Browser Testing" above) to verify the feature works end-to-end.

## Git Workflow

User-wide git workflow rules live in `~/CLAUDE.md`. Project-specific notes:

- `main` deploys to GitHub Pages automatically via GitHub Actions on every push. Never push WIP to `main`; use a feature branch.
- CI runs `lint + test + build` on every push. The full local equivalent is `npm run check` plus `npm run build`.
- No long-lived feature branches in active use.

## Project Tracking & Reference Docs

GitHub Issues is the source of truth for product work — see user-wide `~/.interslice-common/project-tracking.md` for the convention. Use `gh issue list` to see the current idea pile; check `gh api repos/:owner/:repo/milestones --jq '.[] | select(.state=="open")'` for any active launch gate.

Per-feature design specs and implementation plans live under `docs/plans/YYYY-MM-DD-<feature>.md`. The dated `docs/plans/2026-04-19-product-polish-roadmap.md` is preserved as a historical snapshot of the original sprint-style inventory; current product direction is captured by the Vision / Design / Architectural Commitments / Out of Scope sections in this file plus the live GH issue list.
