import { describe, it, expect } from 'vitest';
import { formatIndicator, WPM } from './wordcount.js';

describe('formatIndicator', () => {
  it('shows just words for empty doc', () => {
    expect(formatIndicator(0)).toBe('0w');
  });

  it('hides reading time below 200 words', () => {
    expect(formatIndicator(1)).toBe('1w');
    expect(formatIndicator(199)).toBe('199w');
  });

  it('shows reading time at exactly 200 words (1 min)', () => {
    expect(formatIndicator(200)).toBe('200w · 1m');
  });

  it('rounds reading time up to the nearest minute', () => {
    expect(formatIndicator(201)).toBe('201w · 2m');
    expect(formatIndicator(400)).toBe('400w · 2m');
    expect(formatIndicator(401)).toBe('401w · 3m');
  });

  it('uses sel suffix when isSelection is true (no reading time)', () => {
    expect(formatIndicator(47, { isSelection: true })).toBe('47w sel');
    expect(formatIndicator(0, { isSelection: true })).toBe('0w sel');
    expect(formatIndicator(5000, { isSelection: true })).toBe('5000w sel');
  });

  it('exports WPM as 200', () => {
    expect(WPM).toBe(200);
  });
});
