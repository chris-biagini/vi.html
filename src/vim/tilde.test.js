import { describe, test, expect } from 'vitest';
import { computeTildeCount } from './tilde.js';

describe('computeTildeCount', () => {
  // :help 'eob' (strchars.txt) — "~" displayed on lines after end of buffer
  test('returns count of tilde lines that fit in empty space', () => {
    // viewport=500px, content=200px, lineHeight=25px → 12 tildes
    expect(computeTildeCount(200, 500, 25)).toBe(12);
  });

  test('returns 0 when content fills viewport', () => {
    expect(computeTildeCount(500, 500, 25)).toBe(0);
  });

  test('returns 0 when content exceeds viewport', () => {
    expect(computeTildeCount(600, 500, 25)).toBe(0);
  });

  test('floors partial lines', () => {
    // 310px content, 500px viewport → 190px / 25 = 7.6 → 7
    expect(computeTildeCount(310, 500, 25)).toBe(7);
  });

  test('handles zero line height gracefully', () => {
    expect(computeTildeCount(100, 500, 0)).toBe(0);
  });
});
