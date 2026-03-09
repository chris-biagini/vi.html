/**
 * Vim customizations barrel
 *
 * Re-exports all vim feature modules. main.js imports from here.
 */
export { handleTextwidthWrap } from './textwidth.js';
export { registerGqOperator } from './gq.js';
export { registerArrowClamp } from './arrow-clamp.js';
export { registerVimOptions } from './options.js';
export { registerExCommands } from './commands.js';
export { registerMappings } from './mappings.js';
export { registerAbbreviations } from './abbreviations.js';
export {
  executeExrc,
  registerExrc,
  isEditingExrc,
  exrcWrite,
  exrcQuit,
  exrcWriteQuit,
} from './exrc.js';
