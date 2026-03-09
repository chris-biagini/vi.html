/**
 * Tilde lines — vim-style end-of-buffer indicator
 *
 * Displays ~ on empty screen lines below the document,
 * matching vim's NonText highlight group behavior.
 * Reference: :help 'eob' (strchars.txt)
 */

/**
 * Calculate how many tilde lines fit in the empty space below content.
 * @param {number} contentHeight - Height of the document content in px
 * @param {number} viewportHeight - Height of the visible viewport in px
 * @param {number} lineHeight - Height of a single line in px
 * @returns {number} Number of tilde lines to render
 */
export function computeTildeCount(contentHeight, viewportHeight, lineHeight) {
  if (lineHeight <= 0) return 0;
  var emptySpace = viewportHeight - contentHeight;
  if (emptySpace <= 0) return 0;
  return Math.floor(emptySpace / lineHeight);
}
