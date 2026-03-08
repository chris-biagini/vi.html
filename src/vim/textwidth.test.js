/**
 * textwidth auto-wrap — vim fidelity tests
 * Reference: :help textwidth (options.txt), :help auto-format (change.txt)
 */
import { describe, test, expect } from 'vitest';
import { findBreakPoint } from './textwidth.js';

describe('findBreakPoint', () => {
  // :help textwidth — "lines longer than textwidth are broken"
  test('returns last space at or before textwidth', () => {
    expect(findBreakPoint('the quick brown fox jumps', 20)).toBe(19);
  });

  test('returns -1 when line is within textwidth', () => {
    expect(findBreakPoint('short line', 80)).toBe(-1);
  });

  test('returns -1 when line equals textwidth', () => {
    expect(findBreakPoint('exactly ten', 11)).toBe(-1);
  });

  // :help textwidth — no space to break at means no break
  test('returns -1 when no space found before textwidth', () => {
    expect(findBreakPoint('superlongwordwithoutanyspaces', 10)).toBe(-1);
  });

  test('finds space exactly at textwidth position', () => {
    expect(findBreakPoint('hello world', 5)).toBe(5);
  });

  // :help textwidth — preserves indentation context
  test('finds break point in indented line', () => {
    const line = '    indented text that wraps';
    const bp = findBreakPoint(line, 20);
    expect(bp).toBeGreaterThan(0);
    expect(line[bp]).toBe(' ');
    expect(bp).toBeLessThanOrEqual(20);
  });
});
