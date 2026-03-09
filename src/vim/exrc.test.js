import { describe, test, expect } from 'vitest';
import { parseExrc } from './exrc.js';

describe('parseExrc', () => {
  test('splits lines and trims', () => {
    expect(parseExrc('set ts=2\nset sw=2')).toEqual(['set ts=2', 'set sw=2']);
  });

  test('skips blank lines', () => {
    expect(parseExrc('set ts=2\n\nset sw=2\n')).toEqual([
      'set ts=2',
      'set sw=2',
    ]);
  });

  test('skips comment lines starting with "', () => {
    expect(parseExrc('" This is a comment\nset ts=2')).toEqual(['set ts=2']);
  });

  test('returns empty array for empty string', () => {
    expect(parseExrc('')).toEqual([]);
  });

  test('handles whitespace-only lines', () => {
    expect(parseExrc('  \n\tset ts=2\n  ')).toEqual(['set ts=2']);
  });
});
