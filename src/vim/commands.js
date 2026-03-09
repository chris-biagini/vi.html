/**
 * Ex commands
 *
 * Registers custom Ex commands for the editor. These are app-specific commands
 * (not standard vim) that provide editor functionality through the : command line.
 * Includes :write, :edit, :preview, :help, :clear, :persist, :settings, :toggle.
 *
 * See: https://vimhelp.org/map.txt.html#%3Acommand
 */
import { Vim } from '@replit/codemirror-vim';

export function registerExCommands(state, flashFn, showTabFn, editorAPI) {
  Vim.defineEx('preview', 'pre', function (_cm) {
    showTabFn('preview');
  });

  Vim.defineEx('edit', 'e', function (_cm) {
    editorAPI.reloadContent();
  });

  Vim.defineEx('editor', 'editor', function (_cm) {
    showTabFn('editor');
  });

  Vim.defineEx('help', 'h', function (_cm) {
    showTabFn('help');
  });

  Vim.defineEx('write', 'w', function (_cm) {
    editorAPI.saveNow();
    flashFn('Saved');
  });

  Vim.defineEx('clear', '', function (_cm) {
    editorAPI.clearSaved();
    flashFn('Cleared');
  });

  Vim.defineEx('persist', '', function (_cm) {
    state.persist = true;
    flashFn('Persist: on');
  });

  Vim.defineEx('nopersist', '', function (_cm) {
    state.persist = false;
    flashFn('Persist: off');
  });

  Vim.defineEx('settings', 'settings', function (_cm) {
    var s = editorAPI.getSettingsDisplay();
    flashFn(s, 8000);
  });

  Vim.defineEx('toggle', 'tog', function (_cm) {
    showTabFn(state.currentTab === 'editor' ? 'preview' : 'editor');
  });
}
