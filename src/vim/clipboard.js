/**
 * Clipboard register integration
 *
 * Aliases the "* register to behave identically to "+ (system clipboard).
 * In a browser, there's no X11 PRIMARY/CLIPBOARD distinction — both map
 * to navigator.clipboard.
 *
 * See: :help quoteplus, :help quotestar
 */

export function registerClipboard(Vim) {
  Vim.defineRegister('*', {
    setText: function (text) {
      navigator.clipboard.writeText(text);
    },
    toString: function () {
      return '';
    },
    pushText: function (text) {
      navigator.clipboard.writeText(text);
    },
  });
}
