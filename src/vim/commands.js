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
  Vim.defineEx('preview', 'pre', function(cm) {
    showTabFn('preview');
  });

  Vim.defineEx('edit', 'e', function(cm) {
    editorAPI.reloadContent();
  });

  Vim.defineEx('editor', 'editor', function(cm) {
    showTabFn('editor');
  });

  Vim.defineEx('help', 'h', function(cm) {
    showTabFn('help');
  });

  Vim.defineEx('write', 'w', function(cm) {
    editorAPI.saveNow();
    flashFn('Saved');
  });

  Vim.defineEx('clear', '', function(cm) {
    editorAPI.clearSaved();
    flashFn('Cleared');
  });

  Vim.defineEx('persist', '', function(cm) {
    state.persist = true;
    editorAPI.savePersistFlag(true);
    flashFn('Persist: on');
  });

  Vim.defineEx('nopersist', '', function(cm) {
    state.persist = false;
    editorAPI.savePersistFlag(false);
    flashFn('Persist: off');
  });

  Vim.defineEx('settings', 'settings', function(cm) {
    var s = editorAPI.getSettingsDisplay();
    flashFn(s, 8000);
  });

  Vim.defineEx('toggle', 'tog', function(cm) {
    showTabFn(state.currentTab === 'editor' ? 'preview' : 'editor');
  });
}
