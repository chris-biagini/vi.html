/**
 * Markdown syntax highlighting — palette spec regression guard.
 * See docs/plans/2026-04-19-theme-design.md §3 for the palette spec.
 */
import { describe, test, expect } from 'vitest';
import { tags as t } from '@lezer/highlight';
import { lightHighlight } from './highlight.js';

describe('lightHighlight (Paper & Clay)', () => {
  test('constructs without error', () => {
    expect(lightHighlight).toBeTruthy();
  });

  // A HighlightStyle exposes its raw spec via the `specs` property.
  // If that API ever changes, these tests will break loudly — which is
  // the point of a regression guard.
  const specs = lightHighlight.specs;

  function specFor(tag) {
    return specs.find((s) => {
      const tags = Array.isArray(s.tag) ? s.tag : [s.tag];
      return tags.includes(tag);
    });
  }

  test('heading1 is clay red, bold', () => {
    const s = specFor(t.heading1);
    expect(s).toBeDefined();
    expect(s.color).toBe('#c4634d');
    expect(s.fontWeight).toBe('bold');
  });

  test('heading2–heading6 are accent-soft, bold', () => {
    for (const tag of [t.heading2, t.heading3, t.heading4, t.heading5, t.heading6]) {
      const s = specFor(tag);
      expect(s).toBeDefined();
      expect(s.color).toBe('#b05d2b');
      expect(s.fontWeight).toBe('bold');
    }
  });

  test('emphasis is italic accent', () => {
    const s = specFor(t.emphasis);
    expect(s.color).toBe('#c4634d');
    expect(s.fontStyle).toBe('italic');
  });

  test('strong is bold accent', () => {
    const s = specFor(t.strong);
    expect(s.color).toBe('#c4634d');
    expect(s.fontWeight).toBe('bold');
  });

  test('link and url are accent', () => {
    expect(specFor(t.link).color).toBe('#c4634d');
    expect(specFor(t.url).color).toBe('#c4634d');
  });

  test('monospace is sage', () => {
    expect(specFor(t.monospace).color).toBe('#7a8f6e');
  });

  test('quote is fg-faint, italic', () => {
    const s = specFor(t.quote);
    expect(s.color).toBe('#987b5a');
    expect(s.fontStyle).toBe('italic');
  });

  test('processingInstruction is list-mark', () => {
    expect(specFor(t.processingInstruction).color).toBe('#9a7540');
  });

  test('contentSeparator is rule', () => {
    expect(specFor(t.contentSeparator).color).toBe('#c9b898');
  });
});
