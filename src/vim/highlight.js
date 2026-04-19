/**
 * Markdown syntax highlighting for Paper & Clay (light) and Espresso Mirror (dark).
 *
 * HighlightStyle inlines its styles at creation time, so CSS variables cannot
 * reach into the generated CSS. Hex values are hardcoded per
 * docs/plans/2026-04-19-theme-design.md §3; keep both tables in sync.
 */
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * Paper & Clay (light) highlight.
 */
export const lightHighlight = HighlightStyle.define([
  { tag: t.heading1, color: '#c4634d', fontWeight: 'bold' },
  { tag: t.heading2, color: '#b05d2b', fontWeight: 'bold' },
  { tag: t.heading3, color: '#b05d2b', fontWeight: 'bold' },
  { tag: t.heading4, color: '#b05d2b', fontWeight: 'bold' },
  { tag: t.heading5, color: '#b05d2b', fontWeight: 'bold' },
  { tag: t.heading6, color: '#b05d2b', fontWeight: 'bold' },
  { tag: t.emphasis, color: '#c4634d', fontStyle: 'italic' },
  { tag: t.strong, color: '#c4634d', fontWeight: 'bold' },
  { tag: t.link, color: '#c4634d' },
  { tag: t.url, color: '#c4634d' },
  { tag: t.monospace, color: '#7a8f6e' },
  { tag: t.quote, color: '#987b5a', fontStyle: 'italic' },
  { tag: t.processingInstruction, color: '#9a7540' },
  { tag: t.contentSeparator, color: '#c9b898' },
]);

/**
 * Espresso Mirror (dark) highlight.
 */
export const darkHighlight = HighlightStyle.define([
  { tag: t.heading1, color: '#e08060', fontWeight: 'bold' },
  { tag: t.heading2, color: '#d27458', fontWeight: 'bold' },
  { tag: t.heading3, color: '#d27458', fontWeight: 'bold' },
  { tag: t.heading4, color: '#d27458', fontWeight: 'bold' },
  { tag: t.heading5, color: '#d27458', fontWeight: 'bold' },
  { tag: t.heading6, color: '#d27458', fontWeight: 'bold' },
  { tag: t.emphasis, color: '#e08060', fontStyle: 'italic' },
  { tag: t.strong, color: '#e08060', fontWeight: 'bold' },
  { tag: t.link, color: '#e08060' },
  { tag: t.url, color: '#e08060' },
  { tag: t.monospace, color: '#9bb08a' },
  { tag: t.quote, color: '#9f8c74', fontStyle: 'italic' },
  { tag: t.processingInstruction, color: '#b89968' },
  { tag: t.contentSeparator, color: '#4a3f37' },
]);

/**
 * Returns a syntax-highlighting extension for the requested variant.
 * `isDark` true → dark, false → light.
 */
export function getHighlight(isDark) {
  return syntaxHighlighting(isDark ? darkHighlight : lightHighlight);
}
