# vi.html

Single-file markdown editor with vim keybindings. No build step — just `vi.html`.

## Architecture

Everything lives in `vi.html` (~1100 lines): HTML structure, CSS styles, and JavaScript in a single IIFE.

**Dependencies (CDN):** CodeMirror 5.65.18 (editor, vim keymap, markdown mode, search, dialog) and marked.js 16.3.0 (preview rendering).

**Key sections in the JS:**
- localStorage helpers (content with 7-day TTL, settings, persist flag)
- Tab switching (editor/preview/help)
- SmartyPants typography for preview
- Relative line numbers
- `textwidth` auto-wrap on insert
- `gq` operator for hard-wrap reflow
- Vim `:set` options and Ex commands registered via `CodeMirror.Vim.defineOption`/`defineEx`

## Development

Open `vi.html` in a browser. No server needed (uses localStorage, not filesystem).

## Vim Fidelity

This is a vim learning tool. Custom vim features (gq, textwidth wrap, Ex commands) must match standard vim behavior. When modifying vim-related code, verify against vim docs (vimhelp.org) or vim source — do not rely on assumptions. Key references: `:help gq` (change.txt), `:help textwidth` (options.txt), `:help formatoptions` (options.txt).
