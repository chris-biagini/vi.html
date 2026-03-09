/**
 * Tilde lines — vim-style end-of-buffer indicator
 *
 * Displays ~ on empty screen lines below the document,
 * matching vim's NonText highlight group behavior.
 * Reference: :help 'eob' (strchars.txt)
 */

import { ViewPlugin } from '@codemirror/view';

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

/**
 * Incrementally update tilde DOM children to match target count.
 * @param {HTMLElement} container - The tilde container element
 * @param {number} count - Target number of tilde lines
 */
export function updateTildeDOM(container, count) {
  var existing = container.children.length;
  if (existing < count) {
    for (var i = existing; i < count; i++) {
      var div = document.createElement('div');
      div.className = 'cm-tilde-line';
      div.textContent = '~';
      container.appendChild(div);
    }
  } else if (existing > count) {
    for (var j = existing - 1; j >= count; j--) {
      container.removeChild(container.children[j]);
    }
  }
}

/**
 * CM6 ViewPlugin that renders vim-style tilde lines below document content.
 * @returns {ViewPlugin} The tilde line extension
 */
export function tildeExtension() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.lastCount = -1;
        this.container = document.createElement('div');
        this.container.className = 'cm-tilde-container';
        this.container.setAttribute('aria-hidden', 'true');
        view.scrollDOM.appendChild(this.container);
        this.render(view);
      }

      update(update) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.geometryChanged
        ) {
          this.render(update.view);
        }
      }

      render(view) {
        // Cannot use contentDOM.offsetHeight — CM6 sets min-height:100%
        // and flex-grow:2, stretching it to fill the viewport. Instead,
        // measure actual content via line count * lineHeight.
        var lineHeight = view.defaultLineHeight;
        var contentHeight = view.state.doc.lines * lineHeight;
        var viewportHeight = view.scrollDOM.clientHeight;
        var count = computeTildeCount(
          contentHeight,
          viewportHeight,
          lineHeight,
        );

        if (count !== this.lastCount) {
          updateTildeDOM(this.container, count);
          this.lastCount = count;
        }

        // Position below document content, aligned with text area.
        // .cm-scroller is flex-direction:row, so we use absolute positioning
        // to overlay the empty space below the document lines.
        var gutters = view.scrollDOM.querySelector('.cm-gutters');
        var left = gutters ? gutters.offsetWidth : 0;
        this.container.style.top = contentHeight + 'px';
        this.container.style.left = left + 'px';
      }

      destroy() {
        this.container.remove();
      }
    },
  );
}
