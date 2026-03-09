import { describe, test, expect, beforeEach, vi } from 'vitest';
vi.mock('@replit/codemirror-vim', () => {
  const commands = {};
  return {
    Vim: {
      defineEx: vi.fn((name, abbr, fn) => {
        commands[name] = fn;
      }),
    },
    getCM: vi.fn(),
    _getCommands: () => commands,
  };
});

import { _getCommands } from '@replit/codemirror-vim';
import {
  isKeyword,
  extractWord,
  getAbbreviations,
  registerAbbreviations,
} from './abbreviations.js';

describe('isKeyword', () => {
  test('letters are keyword characters', () => {
    expect(isKeyword('a')).toBe(true);
    expect(isKeyword('Z')).toBe(true);
  });

  test('digits are keyword characters', () => {
    expect(isKeyword('0')).toBe(true);
    expect(isKeyword('9')).toBe(true);
  });

  test('underscore is a keyword character', () => {
    expect(isKeyword('_')).toBe(true);
  });

  test('space is not a keyword character', () => {
    expect(isKeyword(' ')).toBe(false);
  });

  test('punctuation is not a keyword character', () => {
    expect(isKeyword('.')).toBe(false);
    expect(isKeyword(',')).toBe(false);
    expect(isKeyword('!')).toBe(false);
  });
});

describe('extractWord', () => {
  // :help abbreviations — abbreviation must be preceded by non-keyword or SOL
  test('extracts word at end of string', () => {
    expect(extractWord('hello teh', 9)).toEqual({
      word: 'teh',
      from: 6,
      to: 9,
    });
  });

  test('extracts word after space', () => {
    expect(extractWord('the teh', 7)).toEqual({
      word: 'teh',
      from: 4,
      to: 7,
    });
  });

  test('extracts word at start of line', () => {
    expect(extractWord('teh', 3)).toEqual({ word: 'teh', from: 0, to: 3 });
  });

  test('returns null when pos is 0', () => {
    expect(extractWord('teh', 0)).toBeNull();
  });

  test('returns null when no keyword chars before pos', () => {
    expect(extractWord('   ', 3)).toBeNull();
  });

  test('returns full word when abbreviation is part of a longer keyword word', () => {
    // "ateh" — extractWord returns the full word "ateh", not just "teh"
    expect(extractWord('ateh', 4)).toEqual({
      word: 'ateh',
      from: 0,
      to: 4,
    });
  });

  test('word boundary after punctuation', () => {
    expect(extractWord('x.teh', 5)).toEqual({
      word: 'teh',
      from: 2,
      to: 5,
    });
  });

  test('word boundary after newline', () => {
    expect(extractWord('line1\nteh', 9)).toEqual({
      word: 'teh',
      from: 6,
      to: 9,
    });
  });
});

describe('Ex commands', () => {
  let commands;
  let flashFn;

  beforeEach(() => {
    flashFn = vi.fn();
    registerAbbreviations(flashFn);
    commands = _getCommands();
    // Start each test clean
    commands.abclear(null, {});
    flashFn.mockClear();
  });

  test(':ab with two args defines abbreviation', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    expect(getAbbreviations()['teh']).toBe('the');
  });

  test(':ab with multi-word rhs joins correctly', () => {
    commands.abbreviate(null, { args: ['sig', 'Best', 'regards'] });
    expect(getAbbreviations()['sig']).toBe('Best regards');
  });

  test(':ab with no args lists all abbreviations', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    commands.abbreviate(null, { args: ['sig', 'Best', 'regards'] });
    flashFn.mockClear();
    commands.abbreviate(null, { args: [] });
    expect(flashFn).toHaveBeenCalledWith(expect.stringContaining('teh'), 8000);
  });

  test(':ab with no args and no abbreviations shows message', () => {
    commands.abbreviate(null, { args: [] });
    expect(flashFn).toHaveBeenCalledWith('No abbreviations defined', 8000);
  });

  test(':ab with single arg shows that abbreviation', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    flashFn.mockClear();
    commands.abbreviate(null, { args: ['teh'] });
    expect(flashFn).toHaveBeenCalledWith('teh the', 8000);
  });

  test(':ab with single arg not found shows error', () => {
    commands.abbreviate(null, { args: ['nope'] });
    expect(flashFn).toHaveBeenCalledWith(
      'No abbreviation found for nope',
      8000,
    );
  });

  test(':una removes abbreviation', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    commands.unabbreviate(null, { args: ['teh'] });
    expect(getAbbreviations()['teh']).toBeUndefined();
  });

  test(':una with unknown lhs flashes error', () => {
    commands.unabbreviate(null, { args: ['nope'] });
    expect(flashFn).toHaveBeenCalledWith(
      'E24: No such abbreviation: nope',
      8000,
    );
  });

  test(':una with no args flashes error', () => {
    commands.unabbreviate(null, { args: [] });
    expect(flashFn).toHaveBeenCalledWith('E474: No argument supplied', 8000);
  });

  test(':abc clears all abbreviations', () => {
    commands.abbreviate(null, { args: ['teh', 'the'] });
    commands.abbreviate(null, { args: ['sig', 'Best', 'regards'] });
    commands.abclear(null, {});
    expect(Object.keys(getAbbreviations()).length).toBe(0);
  });

  test(':abc flashes confirmation', () => {
    flashFn.mockClear();
    commands.abclear(null, {});
    expect(flashFn).toHaveBeenCalledWith('All abbreviations cleared', 8000);
  });
});
