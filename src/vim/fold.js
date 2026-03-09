/**
 * Markdown folding
 *
 * Provides vim-style fold commands (zo, zc, za, zR, zM) backed by CM6's
 * built-in markdown heading fold support. Fold gutter is on by default
 * and toggleable via :set foldgutter.
 *
 * See: https://vimhelp.org/fold.txt.html
 */
import { Vim } from '@replit/codemirror-vim';
import {
  codeFolding,
  foldGutter,
  foldCode,
  unfoldCode,
  toggleFold,
  foldAll,
  unfoldAll,
} from '@codemirror/language';

/**
 * Returns the CM6 codeFolding() extension with a styled placeholder.
 */
export function foldExtension() {
  return codeFolding({
    placeholderText: '\u2026',
  });
}

/**
 * Returns the CM6 foldGutter() extension.
 */
export function foldGutterExtension() {
  return foldGutter({
    openText: '\u25BE',
    closedText: '\u25B8',
  });
}

/**
 * Register vim fold commands: zo, zc, za, zR, zM.
 */
export function registerFoldCommands() {
  // zo — open fold at cursor (:help zo)
  Vim.defineAction('foldOpen', function (cm) {
    unfoldCode(cm.cm6);
  });
  Vim.mapCommand('zo', 'action', 'foldOpen');

  // zc — close fold at cursor (:help zc)
  Vim.defineAction('foldClose', function (cm) {
    foldCode(cm.cm6);
  });
  Vim.mapCommand('zc', 'action', 'foldClose');

  // za — toggle fold at cursor (:help za)
  Vim.defineAction('foldToggle', function (cm) {
    toggleFold(cm.cm6);
  });
  Vim.mapCommand('za', 'action', 'foldToggle');

  // zR — open all folds (:help zR)
  Vim.defineAction('foldOpenAll', function (cm) {
    unfoldAll(cm.cm6);
  });
  Vim.mapCommand('zR', 'action', 'foldOpenAll');

  // zM — close all folds (:help zM)
  Vim.defineAction('foldCloseAll', function (cm) {
    foldAll(cm.cm6);
  });
  Vim.mapCommand('zM', 'action', 'foldCloseAll');
}
