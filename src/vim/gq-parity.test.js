// @vitest-environment jsdom
/**
 * gq/gw upstream parity — issue #27
 *
 * Compares upstream @replit/codemirror-vim hardWrap against our reflowRange
 * on the scenarios in issue #27. This file documents behavior; it does not
 * enforce correctness. Each scenario snapshots the output of BOTH
 * implementations. The parity table in
 * docs/plans/2026-04-19-gq-upstream-parity.md records the verdict.
 */
import { describe, test, expect } from 'vitest';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { vim, getCM, Vim } from '@replit/codemirror-vim';
import { reflowRange } from './gq.js';

function makeUpstreamEditor(doc, textwidth) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [vim()] }),
    parent: host,
  });
  const cm = getCM(view);
  Vim.setOption('textwidth', textwidth, cm);
  return { view, cm };
}

function runUpstream(input, textwidth, fromLine, toLine) {
  const { view, cm } = makeUpstreamEditor(input, textwidth);
  cm.hardWrap({ from: fromLine, to: toLine });
  const out = view.state.doc.toString();
  view.destroy();
  return out;
}

function runOurs(input, textwidth, fromLine, toLine) {
  const lines = input.split('\n');
  const state = [...lines];
  const mockCm = {
    getLine(n) {
      return state[n];
    },
    replaceRange(text, from, to) {
      const before = state.slice(0, from.line);
      const after = state.slice(to.line + 1);
      const newLines = text.split('\n');
      state.length = 0;
      state.push(...before, ...newLines, ...after);
    },
  };
  reflowRange(mockCm, fromLine, toLine, textwidth);
  return state.join('\n');
}

describe('gq-parity harness smoke', () => {
  test('jsdom can host CM6+vim and call cm.hardWrap', () => {
    const { view, cm } = makeUpstreamEditor(
      'the quick brown\nfox jumps over the lazy dog',
      20,
    );
    expect(typeof cm.hardWrap).toBe('function');
    cm.hardWrap({ from: 0, to: 1 });
    const out = view.state.doc.toString();
    view.destroy();
    expect(out).toMatchInlineSnapshot(`
      "the quick brown fox
      jumps over the lazy
      dog"
    `);
  });
});

describe('gq-parity: prose', () => {
  const TW = 20;

  test('multi-line paragraph joins and rewraps', () => {
    const input = 'the quick brown\nfox jumps over the lazy dog';
    expect({
      upstream: runUpstream(input, TW, 0, 1),
      ours: runOurs(input, TW, 0, 1),
    }).toMatchInlineSnapshot(`
      {
        "ours": "the quick brown fox
      jumps over the lazy
      dog",
        "upstream": "the quick brown fox
      jumps over the lazy
      dog",
      }
    `);
  });

  test('paragraphs separated by blank line', () => {
    const input = 'first paragraph text here\n\nsecond paragraph text here';
    expect({
      upstream: runUpstream(input, TW, 0, 2),
      ours: runOurs(input, TW, 0, 2),
    }).toMatchInlineSnapshot(`
      {
        "ours": "first paragraph text
      here

      second paragraph
      text here",
        "upstream": "first paragraph text
      here

      second paragraph
      text here",
      }
    `);
  });

  test('leading indentation is preserved', () => {
    const input = '  indented text that should be wrapped properly';
    expect({
      upstream: runUpstream(input, TW, 0, 0),
      ours: runOurs(input, TW, 0, 0),
    }).toMatchInlineSnapshot(`
      {
        "ours": "  indented text that
        should be wrapped
        properly",
        "upstream": "  indented text that
        should be wrapped
        properly",
      }
    `);
  });

  test('mixed-width input — short line followed by long line', () => {
    const input =
      'A short line.\nThis second line is considerably longer than textwidth.';
    expect({
      upstream: runUpstream(input, TW, 0, 1),
      ours: runOurs(input, TW, 0, 1),
    }).toMatchInlineSnapshot(`
      {
        "ours": "A short line. This
      second line is
      considerably longer
      than textwidth.",
        "upstream": "A short line. This
      second line is
      considerably longer
      than textwidth.",
      }
    `);
  });
});

describe('gq-parity: markdown constructs', () => {
  const TW = 20;

  test('bullet list — two short items', () => {
    const input = '- first item\n- second item';
    expect({
      upstream: runUpstream(input, TW, 0, 1),
      ours: runOurs(input, TW, 0, 1),
    }).toMatchInlineSnapshot(`
      {
        "ours": "- first item -
      second item",
        "upstream": "- first item -
      second item",
      }
    `);
  });

  test('blockquote — two lines', () => {
    const input = '> quoted line one here\n> quoted line two here';
    expect({
      upstream: runUpstream(input, TW, 0, 1),
      ours: runOurs(input, TW, 0, 1),
    }).toMatchInlineSnapshot(`
      {
        "ours": "> quoted line one
      here > quoted line
      two here",
        "upstream": "> quoted line one
      here > quoted line
      two here",
      }
    `);
  });

  test('fenced code block — should NOT be reflowed', () => {
    const input =
      '```\nvar longVariableName = computeValueOverTwentyChars();\n```';
    expect({
      upstream: runUpstream(input, TW, 0, 2),
      ours: runOurs(input, TW, 0, 2),
    }).toMatchInlineSnapshot(`
      {
        "ours": "\`\`\` var
      longVariableName =
      computeValueOverTwentyChars();
      \`\`\`",
        "upstream": "\`\`\` var
      longVariableName =
      computeValueOverTwentyChars();
      \`\`\`",
      }
    `);
  });

  test('setext heading — underline should not merge into the heading', () => {
    const input = 'Heading Text\n============\n\nBody text paragraph here.';
    expect({
      upstream: runUpstream(input, TW, 0, 3),
      ours: runOurs(input, TW, 0, 3),
    }).toMatchInlineSnapshot(`
      {
        "ours": "Heading Text
      ============

      Body text paragraph
      here.",
        "upstream": "Heading Text
      ============

      Body text paragraph
      here.",
      }
    `);
  });
});

describe('gq-parity: gw cursor preservation', () => {
  test('gw leaves cursor at pre-motion position', () => {
    const { view, cm } = makeUpstreamEditor(
      'the quick brown\nfox jumps over the lazy dog',
      20,
    );
    cm.setCursor({ line: 0, ch: 5 });
    let result;
    try {
      Vim.handleKey(cm, 'g', 'user');
      Vim.handleKey(cm, 'w', 'user');
      Vim.handleKey(cm, 'a', 'user');
      Vim.handleKey(cm, 'p', 'user');
      const pos = cm.getCursor();
      result = {
        method: 'Vim.handleKey',
        cursorLine: pos.line,
        cursorCh: pos.ch,
        doc: view.state.doc.toString(),
      };
    } catch (err) {
      result = { method: 'Vim.handleKey', error: String(err.message || err) };
    }
    view.destroy();
    expect(result).toMatchInlineSnapshot(`
      {
        "cursorCh": 5,
        "cursorLine": 0,
        "doc": "the quick brown fox
      jumps over the lazy
      dog",
        "method": "Vim.handleKey",
      }
    `);
  });

  test('cm.hardWrap called directly does not move cursor', () => {
    const { view, cm } = makeUpstreamEditor(
      'the quick brown\nfox jumps over the lazy dog',
      20,
    );
    cm.setCursor({ line: 0, ch: 5 });
    const before = cm.getCursor();
    cm.hardWrap({ from: 0, to: 1 });
    const after = cm.getCursor();
    const result = {
      beforeLine: before.line,
      beforeCh: before.ch,
      afterLine: after.line,
      afterCh: after.ch,
      doc: view.state.doc.toString(),
    };
    view.destroy();
    expect(result).toMatchInlineSnapshot(`
      {
        "afterCh": 5,
        "afterLine": 0,
        "beforeCh": 5,
        "beforeLine": 0,
        "doc": "the quick brown fox
      jumps over the lazy
      dog",
      }
    `);
  });
});
