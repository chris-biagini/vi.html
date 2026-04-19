// Pure word-count + reading-time formatter for the status bar.
// See docs/plans/2026-04-19-word-count-design.md for behavior spec.

export const WPM = 200;

export function formatIndicator(words, opts) {
  var isSelection = opts && opts.isSelection;
  if (isSelection) return words + 'w sel';
  if (words < WPM) return words + 'w';
  var minutes = Math.max(1, Math.ceil(words / WPM));
  return words + 'w · ' + minutes + 'm';
}
