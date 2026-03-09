/**
 * Vim options
 *
 * Registers vim-compatible :set options (number, relativenumber, tabstop,
 * shiftwidth, expandtab, wrap, textwidth, spell, spelllang) using Vim.defineOption. Each option
 * dispatches to the editor API to reconfigure CodeMirror compartments.
 *
 * Defaults diverge from vim where sensible for a markdown editor:
 *   tabstop=4 (vim: 8), shiftwidth=4 (vim: 8),
 *   expandtab=on (vim: off), number=on (vim: off).
 *
 * See: https://vimhelp.org/options.txt.html
 */
import { Vim } from '@replit/codemirror-vim';

export function registerVimOptions(state, flashFn, editorAPI) {
  Vim.defineOption('number', true, 'boolean', ['nu'], function (val, cm) {
    if (!cm) return;
    editorAPI.setLineNumbers(val);
  });

  Vim.defineOption(
    'relativenumber',
    false,
    'boolean',
    ['rnu'],
    function (val, cm) {
      if (!cm) return;
      state.relativeNumber = val;
      editorAPI.setRelativeNumbers(val);
    },
  );

  Vim.defineOption('tabstop', 4, 'number', ['ts'], function (val, cm) {
    if (!cm) return;
    editorAPI.setTabSize(val);
  });

  // :help 'shiftwidth' — "When zero, the 'tabstop' value will be used."
  Vim.defineOption('shiftwidth', 4, 'number', ['sw'], function (val, cm) {
    if (!cm) return;
    editorAPI.setIndentUnit(val === 0 ? editorAPI.getTabSize() : val);
  });

  Vim.defineOption('expandtab', true, 'boolean', ['et'], function (val, cm) {
    if (!cm) return;
    editorAPI.setIndentWithTabs(!val);
  });

  Vim.defineOption('wrap', true, 'boolean', [], function (val, cm) {
    if (!cm) return;
    editorAPI.setLineWrapping(val);
  });

  Vim.defineOption('textwidth', 0, 'number', ['tw'], function (val, cm) {
    if (!cm) return;
    state.textwidth = val;
    flashFn('textwidth=' + val);
  });

  // :help 'spell' — enable/disable spell checking (uses browser spellcheck)
  Vim.defineOption('spell', false, 'boolean', [], function (val, cm) {
    if (!cm) return;
    editorAPI.setSpellcheck(val);
  });

  // :help 'spelllang' — set spell checking language (browser-dependent)
  Vim.defineOption('spelllang', 'en', 'string', ['spl'], function (val, cm) {
    if (!cm) return;
    editorAPI.setSpelllang(val);
  });
}
