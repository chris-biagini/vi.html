// @vitest-environment jsdom
/**
 * gq/gw regression tests — proves our cursor-landing shim over upstream
 * hardWrap does the one thing upstream doesn't: land at first-non-blank
 * of the last formatted line (vim's documented gq behavior,
 * vim:src/textformat.c:893–896). Full parity analysis is in
 * docs/plans/2026-04-19-gq-upstream-parity.md.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { vim, getCM, Vim } from '@replit/codemirror-vim';
import { registerGqOperator } from './gq.js';

// Shared state mirroring main.js — our operator reads state.textwidth
// because options.js doesn't propagate textwidth to cm.getOption (#28).
const state = { textwidth: 0 };
const hosts = [];

beforeEach(() => {
  state.textwidth = 0;
});

afterEach(() => {
  while (hosts.length) hosts.pop().remove();
});

registerGqOperator(state);

function makeEditor(doc, tw) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [vim()] }),
    parent: host,
  });
  state.textwidth = tw;
  return { view, cm: getCM(view) };
}

describe('gq: cursor-landing fidelity', () => {
  test('gq lands cursor at first-non-blank of last formatted line (indented)', () => {
    const { view, cm } = makeEditor(
      '  indented text that should be wrapped properly',
      20,
    );
    cm.setCursor({ line: 0, ch: 0 });
    Vim.handleKey(cm, 'g', 'user');
    Vim.handleKey(cm, 'q', 'user');
    Vim.handleKey(cm, 'a', 'user');
    Vim.handleKey(cm, 'p', 'user');
    const pos = cm.getCursor();
    const doc = view.state.doc.toString();
    view.destroy();
    expect({ doc, line: pos.line, ch: pos.ch }).toEqual({
      doc: '  indented text that\n  should be wrapped\n  properly',
      line: 2,
      ch: 2, // first non-blank of "  properly" — matches real vim
    });
  });

  test('gw preserves cursor at pre-motion position', () => {
    const { view, cm } = makeEditor(
      'the quick brown\nfox jumps over the lazy dog',
      20,
    );
    cm.setCursor({ line: 0, ch: 5 });
    Vim.handleKey(cm, 'g', 'user');
    Vim.handleKey(cm, 'w', 'user');
    Vim.handleKey(cm, 'a', 'user');
    Vim.handleKey(cm, 'p', 'user');
    const pos = cm.getCursor();
    const doc = view.state.doc.toString();
    view.destroy();
    expect({ doc, line: pos.line, ch: pos.ch }).toEqual({
      doc: 'the quick brown fox\njumps over the lazy\ndog',
      line: 0,
      ch: 5,
    });
  });
});

describe('gq: document output (regression guard against upstream drift)', () => {
  test('reflows multi-line paragraph to textwidth', () => {
    const { view, cm } = makeEditor(
      'the quick brown\nfox jumps over the lazy dog',
      20,
    );
    cm.setCursor({ line: 0, ch: 0 });
    Vim.handleKey(cm, 'g', 'user');
    Vim.handleKey(cm, 'q', 'user');
    Vim.handleKey(cm, 'a', 'user');
    Vim.handleKey(cm, 'p', 'user');
    const doc = view.state.doc.toString();
    view.destroy();
    expect(doc).toBe('the quick brown fox\njumps over the lazy\ndog');
  });

  test('preserves blank lines between paragraphs', () => {
    const { view, cm } = makeEditor(
      'first paragraph text here\n\nsecond paragraph text here',
      20,
    );
    cm.setCursor({ line: 0, ch: 0 });
    // gqG: reflow from here to end of buffer
    Vim.handleKey(cm, 'g', 'user');
    Vim.handleKey(cm, 'q', 'user');
    Vim.handleKey(cm, 'G', 'user');
    const doc = view.state.doc.toString();
    view.destroy();
    expect(doc).toBe(
      'first paragraph text\nhere\n\nsecond paragraph\ntext here',
    );
  });
});
