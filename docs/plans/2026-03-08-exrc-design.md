# exrc: Persistent Configuration via Ex Commands

## Overview

Replace per-feature persistence (settings JSON, abbreviations JSON, persist flag) with a single exrc — a list of Ex commands stored as text in localStorage, executed on startup. Edited via `:exrc` in the main editor.

## Storage

- Single localStorage key: `vihtml_exrc` — raw text, one Ex command per line
- Old keys (`vihtml_settings`, `vihtml_abbreviations`, `vihtml_persist`) are removed
- Content persistence (`vihtml_content`, `vihtml_content_ttl`) is unchanged

## `:exrc` Command Flow

1. Save current document to a buffer variable
2. Replace editor content with the exrc text (from localStorage, or empty string)
3. Flash "Editing exrc — :wq to save, :q! to discard"
4. While in exrc mode:
   - `:w` saves the exrc text to `vihtml_exrc` (stays editing)
   - `:wq` saves exrc text, restores document, executes exrc commands
   - `:q` / `:q!` restores document without saving exrc changes
5. Status bar or indicator shows "exrc" so user knows they're editing config

## Startup Execution

- Read `vihtml_exrc` from localStorage
- Split by newlines, skip blank lines and lines starting with `"`
- Execute each line via `Vim.handleEx(cm, line)`
- Runs after editor is built but before loading saved content

## What Gets Removed

- `saveSettings()` / `loadSettings()` in storage.js
- `savePersistFlag()` / `loadPersistFlag()` in storage.js
- `saveAbbreviations()` / `loadAbbreviations()` in abbreviations.js
- `saveSettingsFn` parameter threading through options.js
- Settings restore block in main.js (lines 353-367)
- `vihtml_settings`, `vihtml_abbreviations`, `vihtml_persist` localStorage keys

## No Migration

Existing settings/abbreviations localStorage data is not migrated. Users start fresh.

## Help Page

- New "exrc" section documenting the command, syntax, and examples
- Update Persistence section to reflect new model
- Remove "settings auto-persist" language
