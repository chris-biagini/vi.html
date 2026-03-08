/**
 * gq reflow — vim fidelity tests
 * Reference: :help gq (change.txt), :help textwidth (options.txt)
 */
import { describe, test, expect } from 'vitest';
import { wordWrap, reflowRange } from './gq.js';

// Mock CM5 editor object for reflowRange tests
function mockCm(lines) {
  const state = [...lines];
  return {
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
    result() {
      return state.slice();
    },
  };
}

describe('wordWrap', () => {
  // :help gq — "Text is formatted to textwidth columns"
  test('wraps line exceeding textwidth at last word boundary', () => {
    const result = wordWrap(
      'the quick brown fox jumps over the lazy dog',
      20,
      '',
    );
    expect(result).toBe('the quick brown fox\njumps over the lazy\ndog');
  });

  test('does not wrap line shorter than textwidth', () => {
    const result = wordWrap('short line', 80, '');
    expect(result).toBe('short line');
  });

  test('does not wrap line equal to textwidth', () => {
    const result = wordWrap('exactly ten', 11, '');
    expect(result).toBe('exactly ten');
  });

  // :help gq — word longer than textwidth goes on its own line
  test('keeps word longer than textwidth on its own line', () => {
    const result = wordWrap(
      'short superlongwordthatexceedstextwidth end',
      10,
      '',
    );
    expect(result).toBe('short\nsuperlongwordthatexceedstextwidth\nend');
  });

  // :help gq — indentation is preserved
  test('preserves indentation on wrapped lines', () => {
    const result = wordWrap('the quick brown fox jumps over', 20, '  ');
    expect(result).toBe('  the quick brown\n  fox jumps over');
  });

  test('handles empty string', () => {
    const result = wordWrap('', 80, '');
    expect(result).toBe('');
  });

  test('handles single word', () => {
    const result = wordWrap('hello', 80, '');
    expect(result).toBe('hello');
  });
});

describe('reflowRange', () => {
  // :help gq — reflows a range of lines to textwidth
  test('reflows multi-line paragraph to textwidth', () => {
    const cm = mockCm(['the quick brown', 'fox jumps over the lazy dog']);
    reflowRange(cm, 0, 1, 20);
    expect(cm.result()).toEqual([
      'the quick brown fox',
      'jumps over the lazy',
      'dog',
    ]);
  });

  // :help gq — blank lines separate paragraphs
  test('preserves blank line between paragraphs', () => {
    const cm = mockCm([
      'first paragraph text here',
      '',
      'second paragraph text here',
    ]);
    reflowRange(cm, 0, 2, 20);
    expect(cm.result()).toEqual([
      'first paragraph text',
      'here',
      '',
      'second paragraph',
      'text here',
    ]);
  });

  // :help gq — indentation is preserved
  test('preserves leading indentation', () => {
    const cm = mockCm(['  indented text that should be wrapped properly']);
    reflowRange(cm, 0, 0, 20);
    expect(cm.result()).toEqual([
      '  indented text that',
      '  should be wrapped',
      '  properly',
    ]);
  });

  test('handles already-wrapped text (no change needed)', () => {
    const cm = mockCm(['short line']);
    reflowRange(cm, 0, 0, 80);
    expect(cm.result()).toEqual(['short line']);
  });
});
