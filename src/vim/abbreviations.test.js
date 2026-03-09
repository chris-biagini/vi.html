import { describe, test, expect, beforeEach, vi } from 'vitest';
import { isKeyword, extractWord, getAbbreviations } from './abbreviations.js';

// Mock localStorage
const store = {};
const mockLocalStorage = {
  getItem: vi.fn((k) => (k in store ? store[k] : null)),
  setItem: vi.fn((k, v) => {
    store[k] = String(v);
  }),
  removeItem: vi.fn((k) => {
    delete store[k];
  }),
};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', mockLocalStorage);
});

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
