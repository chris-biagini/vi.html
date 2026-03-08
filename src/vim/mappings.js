/**
 * Custom key mappings
 *
 * Registers custom normal-mode key mappings. Currently maps \p to :toggle
 * for quickly switching between editor and preview.
 *
 * See: https://vimhelp.org/map.txt.html#%3Amap
 */
import { Vim } from '@replit/codemirror-vim';

export function registerMappings() {
  Vim.map('\\p', ':toggle<CR>', 'normal');
}
