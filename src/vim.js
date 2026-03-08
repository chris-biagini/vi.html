import { Vim } from '@replit/codemirror-vim';

// ── textwidth auto-wrap ─────────────────────────────────
export function handleTextwidthWrap(cm, changeObj, state) {
  if (state.textwidth <= 0) return;
  if (state.wrapping) return;
  if (changeObj.origin !== '+input') return;

  // Vim only triggers auto-wrap on non-whitespace input
  var inserted = changeObj.text.join('');
  if (!inserted || /^\s+$/.test(inserted)) return;

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

// ── gq reflow ───────────────────────────────────────────
function reflowRange(cm, fromLine, toLine, width) {
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
      paragraphs.push(['']);
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
      result.push('');
      continue;
    }
    var paraIndent = para[0].match(/^(\s*)/)[1];
    var joined = para.map(function(l) { return l.trim(); }).join(' ').replace(/\s+/g, ' ');
    result.push(wordWrap(joined, width, paraIndent));
  }

  var text = result.join('\n');
  cm.replaceRange(
    text,
    { line: fromLine, ch: 0 },
    { line: toLine, ch: cm.getLine(toLine).length }
  );
  // Return number of lines in the replacement
  return text.split('\n').length;
}

function wordWrap(text, width, indent) {
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

// ── Register all vim config ─────────────────────────────
export function registerVimConfig(state, flashFn, showTabFn, saveSettingsFn, editorAPI) {

  // ── Vim options ───────────────────────────────────────
  Vim.defineOption('number', true, 'boolean', ['nu'], function(val, cm) {
    if (!cm) return;
    editorAPI.setLineNumbers(val);
    saveSettingsFn();
  });

  Vim.defineOption('relativenumber', false, 'boolean', ['rnu'], function(val, cm) {
    if (!cm) return;
    // TODO: Full relative line number implementation in Task 3
    state.relativeNumber = val;
    editorAPI.setRelativeNumbers(val);
    saveSettingsFn();
  });

  Vim.defineOption('tabstop', 4, 'number', ['ts'], function(val, cm) {
    if (!cm) return;
    editorAPI.setTabSize(val);
    saveSettingsFn();
  });

  Vim.defineOption('shiftwidth', 4, 'number', ['sw'], function(val, cm) {
    if (!cm) return;
    // TODO: Full indentUnit implementation in Task 3
    editorAPI.setIndentUnit(val);
    saveSettingsFn();
  });

  Vim.defineOption('expandtab', true, 'boolean', ['et'], function(val, cm) {
    if (!cm) return;
    // TODO: Full indentWithTabs implementation in Task 3
    editorAPI.setIndentWithTabs(!val);
    saveSettingsFn();
  });

  Vim.defineOption('wrap', true, 'boolean', [], function(val, cm) {
    if (!cm) return;
    editorAPI.setLineWrapping(val);
    saveSettingsFn();
  });

  Vim.defineOption('textwidth', 0, 'number', ['tw'], function(val, cm) {
    if (!cm) return;
    state.textwidth = val;
    saveSettingsFn();
    flashFn('textwidth=' + val);
  });

  // ── Vim Ex commands ───────────────────────────────────
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

  // ── gq operator ───────────────────────────────────────
  Vim.defineOperator('hardWrap', function(cm, operatorArgs, ranges) {
    var width = state.textwidth > 0 ? state.textwidth : 79;
    var cursorLine = 0;
    cm.operation(function() {
      for (var i = ranges.length - 1; i >= 0; i--) {
        var range = ranges[i];
        var fromPos = range.anchor.line <= range.head.line ? range.anchor : range.head;
        var toPos = range.anchor.line <= range.head.line ? range.head : range.anchor;
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

  // ── \p mapping ────────────────────────────────────────
  Vim.map('\\p', ':toggle<CR>', 'normal');
}
