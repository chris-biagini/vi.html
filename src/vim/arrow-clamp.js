/**
 * Arrow key clamping
 *
 * Prevents left/right arrow keys from wrapping across lines in insert mode,
 * matching vim's default behavior. In vim, left arrow at column 0 stays put
 * and right arrow at end of line stays put (unless whichwrap is configured).
 *
 * See: https://vimhelp.org/options.txt.html#%27whichwrap%27
 */
import { Vim } from '@replit/codemirror-vim';

function clampedArrow(dir) {
  return function(cm) {
    var cur = cm.getCursor();
    if (dir === 'left') {
      if (cur.ch > 0) cm.execCommand('goCharLeft');
    } else if (dir === 'right') {
      var lineLen = cm.getLine(cur.line).length;
      if (cur.ch < lineLen) cm.execCommand('goCharRight');
    } else {
      cm.execCommand(dir === 'up' ? 'goLineUp' : 'goLineDown');
    }
  };
}

export function registerArrowClamp() {
  Vim.defineAction('clampLeft', clampedArrow('left'));
  Vim.defineAction('clampRight', clampedArrow('right'));
  Vim.mapCommand('<Left>', 'action', 'clampLeft', {}, { context: 'insert' });
  Vim.mapCommand('<Right>', 'action', 'clampRight', {}, { context: 'insert' });
}
