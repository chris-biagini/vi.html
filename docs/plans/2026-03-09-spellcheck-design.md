# Spellcheck Design

## Summary

Add `:set spell`/`:set nospell` and `:set spelllang` by toggling the browser's built-in spellcheck on CM6's contenteditable element. No custom spellcheck engine.

## Scope

**In scope:**
- `:set spell` / `:set nospell` — boolean toggle (default off, matching vim)
- `:set spelllang=en_us` — sets `lang` attribute on editor element (best-effort, browser-dependent)

**Out of scope:** `]s`/`[s` navigation, `z=` suggestions, `zg`/`zw` word lists, `SpellCap`/`SpellRare`/`SpellLocal` highlight groups. These require a JS spellcheck engine and are not worth the bundle size.

## Implementation

Follows the existing compartment + editorAPI pattern exactly:

1. **`main.js`**: New `spellcheckCompartment`, tracked by `currentSpellcheck` boolean. New `spelllangCompartment` or direct `lang` attribute manipulation. Expose `setSpellcheck(val)` and `setSpelllang(val)` on `editorAPI`.
2. **`vim/options.js`**: `Vim.defineOption('spell', false, 'boolean', ...)` and `Vim.defineOption('spelllang', 'en', 'string', ...)`.
3. **Tests**: Unit tests for the option registration and editorAPI methods.
4. **Help page**: Document the feature and its limitations.
