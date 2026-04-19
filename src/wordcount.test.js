import { describe, it, expect } from 'vitest';
import { countWords, formatIndicator, WPM } from './wordcount.js';

describe('formatIndicator', () => {
  it('shows just words for empty doc', () => {
    expect(formatIndicator(0)).toBe('0w');
  });

  it('hides reading time below 200 words', () => {
    expect(formatIndicator(1)).toBe('1w');
    expect(formatIndicator(199)).toBe('199w');
  });

  it('shows reading time at exactly 200 words (1 min)', () => {
    expect(formatIndicator(200)).toBe('200w · 1m');
  });

  it('rounds reading time up to the nearest minute', () => {
    expect(formatIndicator(201)).toBe('201w · 2m');
    expect(formatIndicator(400)).toBe('400w · 2m');
    expect(formatIndicator(401)).toBe('401w · 3m');
  });

  it('uses sel suffix when isSelection is true (no reading time)', () => {
    expect(formatIndicator(47, { isSelection: true })).toBe('47w sel');
    expect(formatIndicator(0, { isSelection: true })).toBe('0w sel');
    expect(formatIndicator(5000, { isSelection: true })).toBe('5000w sel');
  });

  it('exports WPM as 200', () => {
    expect(WPM).toBe(200);
  });
});

describe('countWords', () => {
  it('returns 0 for empty and whitespace-only input', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('\n\n  \t\n')).toBe(0);
  });

  it('counts plain prose by whitespace splits', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one  two\tthree\nfour')).toBe(4);
  });

  it('strips heading hashes', () => {
    expect(countWords('# Title')).toBe(1);
    expect(countWords('### Three Hash Heading')).toBe(3);
    expect(countWords('# A\n## B\n### C')).toBe(3);
  });

  it('strips emphasis markers, keeps contents', () => {
    expect(countWords('**bold** _italic_ ~~strike~~')).toBe(3);
    expect(countWords('a *b* c')).toBe(3);
    expect(countWords('__under__ score')).toBe(2);
  });

  it('strips link URLs, keeps link text', () => {
    expect(countWords('[link text](https://example.com)')).toBe(2);
    expect(countWords('see [the docs](https://x.io/y) please')).toBe(4);
  });

  it('strips image URLs, keeps alt text', () => {
    expect(countWords('![alt text](url.png)')).toBe(2);
    expect(countWords('![](url.png)')).toBe(0);
  });

  it('strips inline code backticks, keeps contents as one word', () => {
    expect(countWords('use `foo()` here')).toBe(3);
    expect(countWords('`x` `y` `z`')).toBe(3);
  });

  it('strips fenced code blocks entirely', () => {
    expect(countWords('```\nlots of code in here\n```\nreal text')).toBe(2);
    expect(countWords('intro\n```js\nvar a = 1\n```\noutro')).toBe(2);
  });

  it('strips blockquote markers', () => {
    expect(countWords('> quoted text')).toBe(2);
    expect(countWords('> > nested quote')).toBe(2);
  });

  it('strips list markers', () => {
    expect(countWords('- item one\n- item two')).toBe(4);
    expect(countWords('* bullet a\n+ bullet b')).toBe(4);
    expect(countWords('1. first\n2. second')).toBe(2);
  });

  it('strips HTML tags, keeps contents', () => {
    expect(countWords('<br>hello<em>world</em>')).toBe(2);
    expect(countWords('<p>one two three</p>')).toBe(3);
  });

  it('handles a small mixed real-world paragraph', () => {
    var doc =
      '# Notes\n\n' +
      'A **quick** paragraph with a [link](https://x.io) and `code`.\n\n' +
      '- bullet one\n' +
      '- bullet two\n\n' +
      '```\nignored code block\n```\n\n' +
      '> a quote';
    // Words: Notes / A quick paragraph with a link and code / bullet one /
    // bullet two / a quote = 1 + 8 + 2 + 2 + 2 = 15
    expect(countWords(doc)).toBe(15);
  });
});
