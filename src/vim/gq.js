/**
 * gq reflow operator
 *
 * Implements the gq operator for reformatting/reflowing text to a given width.
 * Uses textwidth if set, otherwise defaults to 79 columns. Handles multiple
 * paragraphs separated by blank lines, preserves indentation.
 *
 * See: https://vimhelp.org/change.txt.html#gq
 * See: https://vimhelp.org/options.txt.html#%27textwidth%27
 * See: https://vimhelp.org/change.txt.html#fo-table
 */
import { Vim } from '@replit/codemirror-vim';

export function reflowRange(cm, fromLine, toLine, width) {
  var lines = [];
  for (var i = fromLine; i <= toLine; i++) {
    lines.push(cm.getLine(i));
  }

  // Handle paragraphs: split on blank lines, reflow each
  var paragraphs = [];
  var current = [];
  for (var j = 0; j < lines.length; j++) {
    if (lines[j].trim() === '') {
      if (current.length > 0) paragraphs.push(current);
      paragraphs.push([lines[j]]);
      current = [];
    } else {
      current.push(lines[j]);
    }
  }
  if (current.length > 0) paragraphs.push(current);

  var result = [];
  for (var p = 0; p < paragraphs.length; p++) {
    var para = paragraphs[p];
    if (para.length === 1 && para[0].trim() === '') {
      result.push(para[0]);
      continue;
    }
    var paraIndent = para[0].match(/^(\s*)/)[1];
    var joined = para
      .map(function (l) {
        return l.trim();
      })
      .join(' ')
      .replace(/\s+/g, ' ');
    result.push(wordWrap(joined, width, paraIndent));
  }

  var text = result.join('\n');
  cm.replaceRange(
    text,
    { line: fromLine, ch: 0 },
    { line: toLine, ch: cm.getLine(toLine).length },
  );
  // Return number of lines in the replacement
  return text.split('\n').length;
}

export function wordWrap(text, width, indent) {
  var words = text.split(' ');
  var lines = [];
  var cur = indent;

  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (!word) continue;
    var test = cur === indent ? indent + word : cur + ' ' + word;
    if (test.length <= width || cur === indent) {
      cur = test;
    } else {
      lines.push(cur);
      cur = indent + word;
    }
  }
  if (cur !== indent || lines.length === 0) lines.push(cur);
  return lines.join('\n');
}

export function registerGqOperator(state) {
  Vim.defineOperator('hardWrap', function (cm, operatorArgs, ranges) {
    var width = state.textwidth > 0 ? state.textwidth : 79;
    var cursorLine = 0;
    cm.operation(function () {
      for (var i = ranges.length - 1; i >= 0; i--) {
        var range = ranges[i];
        var fromPos =
          range.anchor.line <= range.head.line ? range.anchor : range.head;
        var toPos =
          range.anchor.line <= range.head.line ? range.head : range.anchor;
        var from = fromPos.line;
        var to = toPos.line;
        // CM5 vim uses exclusive end for linewise motions (head at ch:0 of next line)
        if (to > from && toPos.ch === 0) to--;
        // Trim trailing blank lines from the range
        while (to > from && cm.getLine(to).trim() === '') to--;
        var newLines = reflowRange(cm, from, to, width);
        cursorLine = from + newLines - 1;
      }
    });
    // Position cursor at first non-blank of last formatted line
    var lastLine = cm.lastLine();
    if (cursorLine > lastLine) cursorLine = lastLine;
    var firstNonBlank = cm.getLine(cursorLine).search(/\S/);
    cm.setCursor(cursorLine, firstNonBlank < 0 ? 0 : firstNonBlank);
  });

  Vim.mapCommand('gq', 'operator', 'hardWrap', {}, {});
}
