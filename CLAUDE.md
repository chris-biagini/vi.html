# vi.html

Single-file markdown editor with vim keybindings. Source is modular; `vi.html` is built from `src/`.

## Architecture

**Source files in `src/`:**
- `template.html` — HTML skeleton with `/* STYLE */` and `/* SCRIPT */` placeholders
- `style.css` — all CSS (markdown tokens, preview/help pane styles)
- `storage.js` — localStorage helpers (content with 7-day TTL, settings, persist flag)
- `ui.js` — status bar, tab switching, SmartyPants, preview rendering (marked.js)
- `vim/` — vim customizations, one file per feature:
  - `vim/textwidth.js` — auto-wrap lines at textwidth during insert mode
  - `vim/gq.js` — gq reflow operator for reformatting paragraphs
  - `vim/arrow-clamp.js` — prevent arrow keys from wrapping across lines in insert mode
  - `vim/options.js` — `:set` options (number, tabstop, textwidth, etc.) via `Vim.defineOption`
  - `vim/commands.js` — Ex commands (:write, :preview, :help, etc.) via `Vim.defineEx`
  - `vim/mappings.js` — custom key mappings (`\p` toggle)
  - `vim/index.js` — barrel re-exporting all modules
- `main.js` — entry point: CM6 EditorView, compartments for dynamic options, event wiring, state loading

**Dependencies (npm, bundled offline):** CodeMirror 6 (`codemirror`, `@codemirror/lang-markdown`, `@codemirror/view`, `@codemirror/state`), `@replit/codemirror-vim`, `marked`

**Build:** `build.js` uses esbuild to bundle JS+CSS, then inlines into `template.html` → produces `vi.html`. Output is ~880KB minified.

**Build gotcha:** `build.js` uses function replacement (not string patterns) when inlining into `template.html` to avoid `$` pattern interpolation issues with bundled code.

**Module gotcha:** `package.json` has `"type": "commonjs"` but `src/` uses ESM imports (esbuild handles it). Config files that use `import` syntax need `.mjs` extension (e.g., `vitest.config.mjs`, `eslint.config.mjs`).

**Template gotcha:** `template.html` uses lowercase `<!doctype html>` (not `<!DOCTYPE html>`). The editor uses `<div id="editor-container">`, not a `<textarea>`.

**CM6 vim API:** `@replit/codemirror-vim` provides backward-compatible API. Use `import { Vim } from '@replit/codemirror-vim'` and `getCM(view)` for CM5-style methods. Dynamic options use compartments (`new Compartment()`).

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

## Testing Conventions

- Vim fidelity tests reference `:help` topics in comments for traceability.
- Pure functions are exported for testability (`wordWrap`, `reflowRange` from gq.js; `findBreakPoint` from textwidth.js).
- `storage.test.js` mocks `localStorage` via `vi.stubGlobal`. CM5 API mocks only need `getLine()` and `replaceRange()`.
- `npm run check` before pushing — matches what CI runs.

## Vim Fidelity

This is a vim learning tool. Custom vim features (gq, textwidth wrap, Ex commands) must match standard vim behavior. When modifying vim-related code, verify against vim docs (vimhelp.org) or vim source — do not rely on assumptions. Key references: `:help gq` (change.txt), `:help textwidth` (options.txt), `:help formatoptions` (options.txt), `:help shiftwidth` (options.txt).

**Intentional default divergences:** `tabstop=4` (vim: 8), `shiftwidth=4` (vim: 8), `expandtab=on` (vim: off), `number=on` (vim: off). These are UX choices for a markdown editor — do not "fix" them to match vim defaults.

**Not implemented (by design):** `formatoptions` flags (n, 1, 2, w, a), `gw` operator. These are acceptable scope limits for a markdown editor.
