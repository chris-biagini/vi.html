import { describe, test, expect } from 'vitest';
import { educateText, smartyPants } from './ui.js';

describe('educateText', () => {
  test('converts straight double quotes to curly quotes', () => {
    expect(educateText('"hello"')).toBe('\u201Chello\u201D');
  });

  test('converts straight single quotes to curly quotes', () => {
    expect(educateText("'hello'")).toBe('\u2018hello\u2019');
  });

  test('converts apostrophes in contractions', () => {
    expect(educateText("don't")).toBe('don\u2019t');
  });

  test('converts --- to em dash', () => {
    expect(educateText('word---word')).toBe('word\u2014word');
  });

  test('converts -- to en dash', () => {
    expect(educateText('word--word')).toBe('word\u2013word');
  });

  test('converts ... to ellipsis', () => {
    expect(educateText('wait...')).toBe('wait\u2026');
  });

  test('handles &quot; entities', () => {
    expect(educateText('&quot;hello&quot;')).toBe('\u201Chello\u201D');
  });
});

describe('smartyPants', () => {
  test('applies typography to plain text', () => {
    const result = smartyPants('<p>"hello"</p>');
    expect(result).toBe('<p>\u201Chello\u201D</p>');
  });

  test('does not modify text inside code tags', () => {
    const result = smartyPants('<code>"hello"</code>');
    expect(result).toBe('<code>"hello"</code>');
  });

  test('does not modify text inside pre tags', () => {
    const result = smartyPants('<pre>"hello"</pre>');
    expect(result).toBe('<pre>"hello"</pre>');
  });

  test('handles mixed code and text', () => {
    const result = smartyPants(
      '<p>"smart"</p><code>"raw"</code><p>"smart"</p>',
    );
    expect(result).toBe(
      '<p>\u201Csmart\u201D</p><code>"raw"</code><p>\u201Csmart\u201D</p>',
    );
  });
});
