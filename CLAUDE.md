# vi.html

Single-file markdown editor with vim keybindings. Source is modular; `vi.html` is built from `src/`.

## Architecture

**Source files in `src/`:**
- `template.html` — HTML skeleton with `/* STYLE */` and `/* SCRIPT */` placeholders
- `style.css` — all CSS (markdown tokens, preview/help pane styles)
- `storage.js` — localStorage helpers (content with 7-day TTL, settings, persist flag)
- `ui.js` — status bar, tab switching, SmartyPants, preview rendering (marked.js)
- `vim.js` — all vim customizations: gq reflow, textwidth wrap, arrow clamping, `:set` options and Ex commands via `Vim.defineOption`/`Vim.defineEx`
- `main.js` — entry point: CM6 EditorView, compartments for dynamic options, event wiring, state loading

**Dependencies (npm, bundled offline):** CodeMirror 6 (`codemirror`, `@codemirror/lang-markdown`, `@codemirror/view`, `@codemirror/state`), `@replit/codemirror-vim`, `marked`

**Build:** `build.js` uses esbuild to bundle JS+CSS, then inlines into `template.html` → produces `vi.html`. Output is ~880KB minified.

**Build gotcha:** `build.js` uses function replacement (not string patterns) when inlining into `template.html` to avoid `$` pattern interpolation issues with bundled code.

**CM6 vim API:** `@replit/codemirror-vim` provides backward-compatible API. Use `import { Vim } from '@replit/codemirror-vim'` and `getCM(view)` for CM5-style methods. Dynamic options use compartments (`new Compartment()`).

## Development

- `npm install` — install dependencies (first time only)
- `npm run build` — build `vi.html`
- `npm run build:min` — build minified
- `npm run dev` — watch mode (rebuilds on changes to `src/`)
- `vi.html` is gitignored (build artifact). GitHub Actions builds and deploys to Pages on push to main.
- No test runner or linter configured.

## Vim Fidelity

This is a vim learning tool. Custom vim features (gq, textwidth wrap, Ex commands) must match standard vim behavior. When modifying vim-related code, verify against vim docs (vimhelp.org) or vim source — do not rely on assumptions. Key references: `:help gq` (change.txt), `:help textwidth` (options.txt), `:help formatoptions` (options.txt).
