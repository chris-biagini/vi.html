import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  lsGet,
  lsSet,
  lsRemove,
  loadBuffers,
  saveBuffers,
  loadSession,
  saveSession,
  saveExrc,
  loadExrc,
} from './storage.js';

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

describe('lsGet / lsSet / lsRemove', () => {
  test('lsSet stores and lsGet retrieves', () => {
    lsSet('key', 'value');
    expect(lsGet('key')).toBe('value');
  });

  test('lsGet returns null for missing key', () => {
    expect(lsGet('missing')).toBeNull();
  });

  test('lsRemove deletes key', () => {
    lsSet('key', 'value');
    lsRemove('key');
    expect(lsGet('key')).toBeNull();
  });
});

describe('loadBuffers / saveBuffers', () => {
  test('loadBuffers returns {} when nothing saved', () => {
    expect(loadBuffers()).toEqual({});
  });

  test('loadBuffers returns {} on corrupt JSON', () => {
    store['vi_buffers'] = '{not valid json!!!';
    expect(loadBuffers()).toEqual({});
  });

  test('saveBuffers / loadBuffers round-trip', () => {
    const buffers = {
      'notes.md': { content: '# Notes\nHello', cursor: { line: 0, ch: 0 } },
      'todo.md': { content: '- buy milk', cursor: { line: 0, ch: 2 } },
    };
    saveBuffers(buffers);
    expect(loadBuffers()).toEqual(buffers);
  });
});

describe('loadSession / saveSession', () => {
  test('loadSession returns default when nothing saved', () => {
    expect(loadSession()).toEqual({ current: '', alternate: null });
  });

  test('loadSession returns default on corrupt JSON', () => {
    store['vi_session'] = 'nope{';
    expect(loadSession()).toEqual({ current: '', alternate: null });
  });

  test('saveSession / loadSession round-trip', () => {
    const session = { current: 'notes.md', alternate: 'todo.md' };
    saveSession(session);
    expect(loadSession()).toEqual(session);
  });
});

describe('saveExrc / loadExrc', () => {
  test('saves and loads exrc string', () => {
    saveExrc('set ts=2\nset sw=2');
    expect(loadExrc()).toBe('set ts=2\nset sw=2');
  });

  test('returns empty string when no exrc saved', () => {
    expect(loadExrc()).toBe('');
  });

  test('removes exrc when given falsy value', () => {
    saveExrc('set ts=2');
    saveExrc('');
    expect(loadExrc()).toBe('');
  });
});
