/**
 * gq/gw reflow operator — cursor-landing shim over upstream hardWrap.
 *
 * Upstream @replit/codemirror-vim ships a real hardWrap operator mapped to
 * gq/gw in its default keymap (bundle:189–190, 2859–2867, 8096–8131).
 * Document output is byte-identical to real vim on the scenarios we care
 * about (see docs/plans/2026-04-19-gq-upstream-parity.md). The one
 * divergence: upstream's operator lands the cursor at {endRow, 0}, but
 * real vim lands at first-non-blank of the last formatted line
 * (vim:src/textformat.c:893–896 — `beginline(BL_WHITE | BL_FIX)`).
 *
 * This module overrides the operator shim by re-defining it under the same
 * name ('hardWrap') so the default keymap picks it up. Reflow itself
 * delegates to upstream's cm.hardWrap, with textwidth passed explicitly
 * from our state (since options.js sets state.textwidth but does not
 * propagate to cm.getOption — tracked by #28).
 *
 * See: https://vimhelp.org/change.txt.html#gq
 * See: https://vimhelp.org/change.txt.html#gw
 */
import { Vim } from '@replit/codemirror-vim';

export function registerGqOperator(state) {
  Vim.defineOperator(
    'hardWrap',
    function (cm, operatorArgs, ranges, oldAnchor) {
      var from = ranges[0].anchor.line;
      var to = ranges[0].head.line;
      if (operatorArgs.linewise) to--;
      var column = state.textwidth > 0 ? state.textwidth : 79;
      var endRow = cm.hardWrap({ from: from, to: to, column: column });
      if (endRow > from && operatorArgs.linewise) endRow--;

      if (operatorArgs.keepCursor) {
        cm.setCursor(oldAnchor);
        return;
      }

      var lastLine = cm.lastLine();
      var line = Math.min(endRow, lastLine);
      var firstNonBlank = cm.getLine(line).search(/\S/);
      cm.setCursor(line, firstNonBlank < 0 ? 0 : firstNonBlank);
    },
  );
}
