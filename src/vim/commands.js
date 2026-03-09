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

export function registerExCommands(
  state,
  flashFn,
  showTabFn,
  editorAPI,
  exrcAPI,
) {
  Vim.defineEx('preview', 'pre', function (_cm) {
    showTabFn('preview');
  });

  Vim.defineEx('edit', 'e', function (_cm, params) {
    var name = params && params.argString ? params.argString.trim() : '';
    if (!name) {
      editorAPI.reloadContent();
    } else {
      editorAPI.bufferManager.switchBuffer(name);
    }
  });

  Vim.defineEx('editor', 'editor', function (_cm) {
    showTabFn('editor');
  });

  Vim.defineEx('help', 'h', function (_cm) {
    showTabFn('help');
  });

  Vim.defineEx('write', 'w', function (_cm, params) {
    if (exrcAPI && exrcAPI.isEditing()) {
      exrcAPI.write();
      return;
    }
    var name = params && params.argString ? params.argString.trim() : '';
    var mgr = editorAPI.bufferManager;
    if (name) {
      mgr.writeBuffer(name);
    } else {
      mgr.saveCurrentBuffer();
      flashFn('"' + (mgr.currentName() || '[No Name]') + '" written');
    }
  });

  Vim.defineEx('wq', 'wq', function (_cm) {
    if (exrcAPI && exrcAPI.isEditing()) {
      exrcAPI.writeQuit();
      return;
    }
    var mgr = editorAPI.bufferManager;
    mgr.saveCurrentBuffer();
    flashFn('"' + (mgr.currentName() || '[No Name]') + '" written');
  });

  Vim.defineEx('quit', 'q', function (_cm, params) {
    if (exrcAPI && exrcAPI.isEditing()) {
      var bang = params && params.argString && params.argString.includes('!');
      exrcAPI.quit(bang);
      return;
    }
  });

  Vim.defineEx('clear', '', function (_cm) {
    editorAPI.bufferManager.reset();
    flashFn('All buffers cleared');
  });

  Vim.defineEx('buffer', 'b', function (_cm, params) {
    var arg = params && params.argString ? params.argString.trim() : '';
    var mgr = editorAPI.bufferManager;
    if (arg === '#') {
      mgr.switchAlternate();
    } else if (arg) {
      mgr.switchBuffer(arg);
    } else {
      flashFn('"' + (mgr.currentName() || '[No Name]') + '"');
    }
  });

  Vim.defineEx('ls', 'ls', function (_cm) {
    flashFn(editorAPI.bufferManager.listBuffers(), 8000);
  });

  Vim.defineEx('buffers', 'buffers', function (_cm) {
    flashFn(editorAPI.bufferManager.listBuffers(), 8000);
  });

  Vim.defineEx('bdelete', 'bd', function (_cm, params) {
    var name = params && params.argString ? params.argString.trim() : undefined;
    editorAPI.bufferManager.deleteBuffer(name || undefined);
  });

  Vim.defineEx('saveas', 'sav', function (_cm, params) {
    var name = params && params.argString ? params.argString.trim() : '';
    if (!name) {
      flashFn('E471: Argument required');
      return;
    }
    editorAPI.bufferManager.saveas(name);
  });

  Vim.defineEx('file', 'f', function (_cm, params) {
    var name = params && params.argString ? params.argString.trim() : '';
    var mgr = editorAPI.bufferManager;
    if (!name) {
      flashFn('"' + (mgr.currentName() || '[No Name]') + '"');
      return;
    }
    mgr.renameBuffer(name);
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
