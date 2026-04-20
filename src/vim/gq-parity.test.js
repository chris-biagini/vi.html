// @vitest-environment jsdom
/**
 * gq/gw upstream parity — issue #27
 *
 * Smoke: can jsdom host a real CM6+vim editor and call cm.hardWrap?
 */
import { describe, test, expect } from 'vitest';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { vim, getCM, Vim } from '@replit/codemirror-vim';

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
