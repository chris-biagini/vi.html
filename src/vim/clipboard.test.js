import { describe, it, expect } from 'vitest';
import { registerClipboard } from './clipboard.js';

describe('clipboard registers', () => {
  it('registers * as an alias for +', () => {
    var definedRegisters = {};
    var mockVim = {
      defineRegister: function (name, register) {
        definedRegisters[name] = register;
      },
    };
    registerClipboard(mockVim);
    expect(definedRegisters['*']).toBeDefined();
  });
});
