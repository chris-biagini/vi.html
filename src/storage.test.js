import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  saveContent,
  loadContent,
  saveSettings,
  loadSettings,
  loadPersistFlag,
  savePersistFlag,
  clearContent,
  refreshTTL,
  lsGet,
  lsSet,
  lsRemove,
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

describe('saveContent / loadContent', () => {
  test('saves and loads content when persist is true', () => {
    saveContent('hello world', true);
    expect(loadContent()).toBe('hello world');
  });

  test('does not save when persist is false', () => {
    saveContent('hello world', false);
    expect(loadContent()).toBeNull();
  });

  test('returns null when TTL has expired', () => {
    saveContent('hello', true);
    store['vihtml_content_ttl'] = String(Date.now() - 1000);
    expect(loadContent()).toBeNull();
  });

  test('clearContent removes content and TTL', () => {
    saveContent('hello', true);
    clearContent();
    expect(loadContent()).toBeNull();
  });
});

describe('refreshTTL', () => {
  test('sets TTL to ~7 days in the future', () => {
    const before = Date.now();
    refreshTTL();
    const ttl = parseInt(store['vihtml_content_ttl'], 10);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(ttl).toBeGreaterThanOrEqual(before + sevenDays - 100);
    expect(ttl).toBeLessThanOrEqual(before + sevenDays + 100);
  });
});

describe('saveSettings / loadSettings', () => {
  test('saves and loads settings object', () => {
    const settings = { tabstop: 4, number: true };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  test('returns null when no settings saved', () => {
    expect(loadSettings()).toBeNull();
  });

  test('returns null for corrupted JSON', () => {
    store['vihtml_settings'] = 'not json';
    expect(loadSettings()).toBeNull();
  });
});

describe('savePersistFlag / loadPersistFlag', () => {
  test('defaults to true when no flag set', () => {
    expect(loadPersistFlag()).toBe(true);
  });

  test('returns false when flag is "0"', () => {
    savePersistFlag(false);
    expect(loadPersistFlag()).toBe(false);
  });

  test('returns true when flag is "1"', () => {
    savePersistFlag(true);
    expect(loadPersistFlag()).toBe(true);
  });
});
