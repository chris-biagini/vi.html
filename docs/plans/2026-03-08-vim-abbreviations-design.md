# Vim Abbreviations Design

**Date:** 2026-03-08
**References:** [vimhelp Abbreviations](https://vimhelp.org/map.txt.html#Abbreviations), [vim source](https://github.com/vim/vim)

## Scope

Insert-mode abbreviations with persistence. Core `:ab`, `:una`, `:abc` commands.

**Out of scope:** `:iabbrev`/`:cabbrev`/`:noreabbrev` variants, full-id/end-id/non-id type distinctions, Esc-triggered expansion, `Ctrl-]` explicit trigger.

## New file: `src/vim/abbreviations.js`

### Storage

- In-memory map `{lhs: rhs}` for fast lookup
- Persisted to localStorage key `vi_abbreviations` (JSON)
- Loaded on startup, saved on each `:ab` / `:una` / `:abc` mutation

### Ex commands (via `Vim.defineEx`)

- `:ab[breviate]` — with args: define abbreviation; without args: list all (flashed to status bar)
- `:una[bbreviate] {lhs}` — remove one abbreviation
- `:abc[lear]` — remove all abbreviations

### Expansion logic (CM6 `EditorView.inputHandler`)

- On each input, check vim insert mode via `getCM(view).state.vim.insertMode`
- If typed character is non-keyword (`/[^a-zA-Z0-9_]/`), look back from cursor
- Extract preceding keyword-character word
- Verify character before the word is non-keyword or start-of-line (word boundary)
- If word matches an abbreviation, replace via `view.dispatch`
- Trigger character inserted normally after expansion

### Exports

- `registerAbbreviations(flashFn)` — registers Ex commands, returns the `inputHandler` extension
- Extension added to EditorView extensions in `main.js`

### Keyword characters

`[a-zA-Z0-9_]` — vim's default `iskeyword` for ASCII.

## Testing: `src/vim/abbreviations.test.js`

- Expansion logic (word extraction, boundary checks, replacement)
- Storage load/save round-trip
- Ex command behavior (define, list, remove, clear)

## Integration

- `src/vim/index.js` — add barrel export
- `src/main.js` — call `registerAbbreviations(flash)`, add returned extension to EditorView
