import { describe, test, it, expect } from 'vitest';
import { educateText, smartyPants, renderClipboardHTML } from './preview.js';

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

describe('renderClipboardHTML', () => {
  it('renders headings without attributes', () => {
    var html = renderClipboardHTML('# Hello');
    expect(html).toBe('<h1>Hello</h1>\n');
  });

  it('renders emphasis and strong', () => {
    var html = renderClipboardHTML('*em* and **strong**');
    expect(html).toContain('<em>em</em>');
    expect(html).toContain('<strong>strong</strong>');
  });

  it('strips class attributes from code blocks', () => {
    var html = renderClipboardHTML('```js\nvar x = 1;\n```');
    expect(html).not.toContain('class=');
    expect(html).toContain('<pre><code>');
  });

  it('preserves href on links', () => {
    var html = renderClipboardHTML('[test](https://example.com)');
    expect(html).toContain('href="https://example.com"');
  });

  it('strips non-semantic attributes', () => {
    var html = renderClipboardHTML('- item');
    expect(html).not.toContain('id=');
    expect(html).not.toContain('data-');
    expect(html).not.toContain('style=');
  });

  it('applies SmartyPants', () => {
    var html = renderClipboardHTML('"hello"');
    expect(html).toContain('\u201C');
    expect(html).toContain('\u201D');
  });
});
