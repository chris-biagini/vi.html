/**
 * textwidth auto-wrap
 *
 * Automatically wraps lines at the configured textwidth during insert mode.
 * When a line exceeds textwidth, breaks at the last space at or before the
 * limit and preserves indentation on the new line.
 *
 * See: https://vimhelp.org/options.txt.html#%27textwidth%27
 * See: https://vimhelp.org/change.txt.html#auto-format
 */

export function handleTextwidthWrap(cm, changeObj, state) {
  if (state.textwidth <= 0) return;
  if (state.wrapping) return;
  if (changeObj.origin !== '+input') return;

  var inserted = changeObj.text.join('');
  if (!inserted) return;

  var cursor = cm.getCursor();
  var lineNo = cursor.line;
  var lineText = cm.getLine(lineNo);

  if (lineText.length <= state.textwidth) return;

  // Find last space at or before textwidth
  var breakAt = -1;
  for (var i = state.textwidth; i >= 0; i--) {
    if (lineText[i] === ' ') {
      breakAt = i;
      break;
    }
  }
  if (breakAt <= 0) return;

  var indent = lineText.match(/^(\s*)/)[1];

  state.wrapping = true;
  cm.operation(function() {
    cm.replaceRange(
      '\n' + indent,
      { line: lineNo, ch: breakAt },
      { line: lineNo, ch: breakAt + 1 }
    );
  });
  // Delay reset so the batched change event from cm.operation sees the flag
  setTimeout(function() { state.wrapping = false; }, 0);
}
