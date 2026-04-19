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

// Strip markdown syntax with a small regex pass, then count whitespace-split
// tokens. Cheap on purpose: this runs (debounced) on every keystroke for
// 30-page docs. Order of strips is significant — see design spec.
export function countWords(text) {
  if (!text) return 0;

  var s = text;

  // 1. Fenced code blocks — drop entirely (code is not prose).
  //    Matches ``` (or ~~~) opening to the next matching fence.
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/~~~[\s\S]*?~~~/g, ' ');

  // 2. HTML tags — strip the tag, keep the text inside.
  s = s.replace(/<[^>]+>/g, ' ');

  // 3. Image syntax — replace with the alt text.
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // 4. Link syntax — replace with the link label.
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // 5. Inline code — strip backticks, keep contents.
  s = s.replace(/`([^`]*)`/g, '$1');

  // 6. Heading hashes (line-leading).
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, '');

  // 7. Blockquote markers (line-leading, possibly nested).
  s = s.replace(/^[ \t]*(?:>[ \t]*)+/gm, '');

  // 8. List markers (line-leading): -, *, +, or "N.".
  s = s.replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, '');

  // 9. Emphasis markers — doubled forms first so singles don't leave dangles.
  s = s.replace(/\*\*/g, '');
  s = s.replace(/__/g, '');
  s = s.replace(/~~/g, '');
  s = s.replace(/[*_]/g, '');

  // Final: split on whitespace and count non-empty tokens.
  var tokens = s.split(/\s+/);
  var count = 0;
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i].length > 0) count++;
  }
  return count;
}
