/**
 * Vim options
 *
 * Registers vim-compatible :set options (number, relativenumber, tabstop,
 * shiftwidth, expandtab, wrap, textwidth) using Vim.defineOption. Each option
 * dispatches to the editor API to reconfigure CodeMirror compartments and
 * persists settings to localStorage.
 *
 * Defaults diverge from vim where sensible for a markdown editor:
 *   tabstop=4 (vim: 8), shiftwidth=4 (vim: 8),
 *   expandtab=on (vim: off), number=on (vim: off).
 *
 * See: https://vimhelp.org/options.txt.html
 */
import { Vim } from '@replit/codemirror-vim';

export function registerVimOptions(state, flashFn, saveSettingsFn, editorAPI) {
  Vim.defineOption('number', true, 'boolean', ['nu'], function (val, cm) {
    if (!cm) return;
    editorAPI.setLineNumbers(val);
    saveSettingsFn();
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
      saveSettingsFn();
    },
  );

  Vim.defineOption('tabstop', 4, 'number', ['ts'], function (val, cm) {
    if (!cm) return;
    editorAPI.setTabSize(val);
    saveSettingsFn();
  });

  // :help 'shiftwidth' — "When zero, the 'tabstop' value will be used."
  Vim.defineOption('shiftwidth', 4, 'number', ['sw'], function (val, cm) {
    if (!cm) return;
    editorAPI.setIndentUnit(val === 0 ? editorAPI.getTabSize() : val);
    saveSettingsFn();
  });

  Vim.defineOption('expandtab', true, 'boolean', ['et'], function (val, cm) {
    if (!cm) return;
    editorAPI.setIndentWithTabs(!val);
    saveSettingsFn();
  });

  Vim.defineOption('wrap', true, 'boolean', [], function (val, cm) {
    if (!cm) return;
    editorAPI.setLineWrapping(val);
    saveSettingsFn();
  });

  Vim.defineOption('textwidth', 0, 'number', ['tw'], function (val, cm) {
    if (!cm) return;
    state.textwidth = val;
    saveSettingsFn();
    flashFn('textwidth=' + val);
  });
}
