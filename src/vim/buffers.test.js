import { describe, test, expect, vi } from 'vitest';
import { createBufferManager } from './buffers.js';

function makeManager(overrides) {
  var doc = '';
  var cursor = { line: 0, ch: 0 };
  var savedBuffers = overrides?.initialBuffers || {};
  var savedSession = overrides?.initialSession || {
    current: '',
    alternate: null,
  };
  var flashMessages = [];
  var displayName = '';

  var opts = {
    loadBuffers: vi.fn(() => JSON.parse(JSON.stringify(savedBuffers))),
    saveBuffers: vi.fn((b) => {
      savedBuffers = JSON.parse(JSON.stringify(b));
    }),
    loadSession: vi.fn(() => ({ ...savedSession })),
    saveSession: vi.fn((s) => {
      savedSession = { ...s };
    }),
    getDoc: vi.fn(() => doc),
    setDoc: vi.fn((text) => {
      doc = text;
    }),
    getCursor: vi.fn(() => ({ ...cursor })),
    setCursor: vi.fn((line, ch) => {
      cursor = { line, ch };
    }),
    flash: vi.fn((msg) => {
      flashMessages.push(msg);
    }),
    updateBufferDisplay: vi.fn((name) => {
      displayName = name;
    }),
    ...overrides?.opts,
  };

  var mgr = createBufferManager(opts);

  return {
    mgr,
    opts,
    flashMessages,
    getDoc: () => doc,
    getCursor: () => cursor,
    getDisplayName: () => displayName,
    getSavedBuffers: () => savedBuffers,
    getSavedSession: () => savedSession,
  };
}

describe('createBufferManager', () => {
  describe('initialization', () => {
    test('init with no saved state creates unnamed buffer', () => {
      var { mgr, opts } = makeManager();
      expect(mgr.currentName()).toBe('');
      expect(mgr.alternateName()).toBeNull();
      expect(opts.setDoc).toHaveBeenCalledWith('');
      expect(opts.setCursor).toHaveBeenCalledWith(0, 0);
      expect(opts.updateBufferDisplay).toHaveBeenCalledWith('[No Name]');
    });

    test('init with saved session restores buffer', () => {
      var { mgr, opts } = makeManager({
        initialBuffers: {
          'notes.md': { content: '# Notes', cursor: { line: 1, ch: 3 } },
        },
        initialSession: { current: 'notes.md', alternate: null },
      });
      expect(mgr.currentName()).toBe('notes.md');
      expect(opts.setDoc).toHaveBeenCalledWith('# Notes');
      expect(opts.setCursor).toHaveBeenCalledWith(1, 3);
      expect(opts.updateBufferDisplay).toHaveBeenCalledWith('notes.md');
    });

    test('init with missing session buffer creates it empty', () => {
      var { mgr, opts } = makeManager({
        initialSession: { current: 'missing.md', alternate: null },
      });
      expect(mgr.currentName()).toBe('missing.md');
      expect(opts.setDoc).toHaveBeenCalledWith('');
      expect(opts.setCursor).toHaveBeenCalledWith(0, 0);
    });

    test('init restores alternate name from session', () => {
      var { mgr } = makeManager({
        initialBuffers: {
          'a.md': { content: 'aaa', cursor: { line: 0, ch: 0 } },
          'b.md': { content: 'bbb', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: 'b.md' },
      });
      expect(mgr.currentName()).toBe('a.md');
      expect(mgr.alternateName()).toBe('b.md');
    });
  });

  describe('switchBuffer', () => {
    test('switches to existing buffer', () => {
      var { mgr, opts, flashMessages } = makeManager({
        initialBuffers: {
          'a.md': { content: 'aaa', cursor: { line: 0, ch: 0 } },
          'b.md': { content: 'bbb', cursor: { line: 1, ch: 2 } },
        },
        initialSession: { current: 'a.md', alternate: null },
      });

      mgr.switchBuffer('b.md');

      expect(mgr.currentName()).toBe('b.md');
      expect(mgr.alternateName()).toBe('a.md');
      expect(opts.setDoc).toHaveBeenLastCalledWith('bbb');
      expect(opts.setCursor).toHaveBeenLastCalledWith(1, 2);
      expect(flashMessages).toContain('"b.md" written');
    });

    test('switches to new buffer (creates it)', () => {
      var { mgr, opts } = makeManager();

      mgr.switchBuffer('new.md');

      expect(mgr.currentName()).toBe('new.md');
      expect(opts.setDoc).toHaveBeenLastCalledWith('');
    });

    test('sets alternate to old current', () => {
      var { mgr } = makeManager({
        initialBuffers: {
          'a.md': { content: 'aaa', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: null },
      });

      mgr.switchBuffer('b.md');
      expect(mgr.alternateName()).toBe('a.md');
    });

    test('persists state on switch', () => {
      var { mgr, opts } = makeManager();
      mgr.switchBuffer('test.md');
      expect(opts.saveBuffers).toHaveBeenCalled();
      expect(opts.saveSession).toHaveBeenCalled();
    });

    test('snapshots current buffer content before switching', () => {
      var doc = 'initial';
      var { mgr, opts } = makeManager({
        opts: {
          getDoc: vi.fn(() => doc),
        },
      });

      // Simulate user editing
      doc = 'modified content';
      mgr.switchBuffer('other.md');

      // Switch back to unnamed
      mgr.switchBuffer('');

      // The unnamed buffer should have the modified content
      expect(opts.setDoc).toHaveBeenLastCalledWith('modified content');
    });
  });

  describe('switchAlternate', () => {
    test('switches to alternate buffer', () => {
      var { mgr } = makeManager({
        initialBuffers: {
          'a.md': { content: 'aaa', cursor: { line: 0, ch: 0 } },
          'b.md': { content: 'bbb', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: 'b.md' },
      });

      mgr.switchAlternate();
      expect(mgr.currentName()).toBe('b.md');
      expect(mgr.alternateName()).toBe('a.md');
    });

    test('flashes error when no alternate', () => {
      var { mgr, flashMessages } = makeManager();
      mgr.switchAlternate();
      expect(flashMessages).toContain('E23: No alternate file');
    });
  });

  describe('saveCurrentBuffer', () => {
    test('persists current content and cursor', () => {
      var doc = 'hello world';
      var cursor = { line: 2, ch: 5 };
      var { mgr, opts } = makeManager({
        opts: {
          getDoc: vi.fn(() => doc),
          getCursor: vi.fn(() => ({ ...cursor })),
        },
      });

      mgr.saveCurrentBuffer();

      expect(opts.saveBuffers).toHaveBeenCalled();
      var buffers = mgr.getBuffers();
      expect(buffers['']).toEqual({
        content: 'hello world',
        cursor: { line: 2, ch: 5 },
      });
    });
  });

  describe('writeBuffer', () => {
    test('renames unnamed buffer when given a name', () => {
      var { mgr, flashMessages } = makeManager();

      mgr.writeBuffer('notes.md');

      expect(mgr.currentName()).toBe('notes.md');
      var buffers = mgr.getBuffers();
      expect(buffers['']).toBeUndefined();
      expect(buffers['notes.md']).toBeDefined();
      expect(flashMessages).toContain('"notes.md" written');
    });

    test('saveas behavior on named buffer', () => {
      var { mgr, flashMessages } = makeManager({
        initialBuffers: {
          'a.md': { content: 'aaa', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: null },
      });

      mgr.writeBuffer('b.md');

      expect(mgr.currentName()).toBe('b.md');
      var buffers = mgr.getBuffers();
      // Original still exists
      expect(buffers['a.md']).toBeDefined();
      expect(buffers['b.md']).toBeDefined();
      expect(flashMessages).toContain('"b.md" written');
    });
  });

  describe('saveas', () => {
    test('copies current to new name and switches', () => {
      var doc = 'my content';
      var { mgr, flashMessages } = makeManager({
        initialBuffers: {
          'a.md': { content: 'my content', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: null },
        opts: {
          getDoc: vi.fn(() => doc),
        },
      });

      mgr.saveas('copy.md');

      expect(mgr.currentName()).toBe('copy.md');
      expect(mgr.alternateName()).toBe('a.md');
      var buffers = mgr.getBuffers();
      expect(buffers['a.md']).toBeDefined();
      expect(buffers['copy.md']).toBeDefined();
      expect(flashMessages).toContain('"copy.md" written');
    });
  });

  describe('renameBuffer', () => {
    test('renames current buffer', () => {
      var { mgr, flashMessages } = makeManager({
        initialBuffers: {
          'old.md': { content: 'stuff', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'old.md', alternate: null },
      });

      mgr.renameBuffer('new.md');

      expect(mgr.currentName()).toBe('new.md');
      var buffers = mgr.getBuffers();
      expect(buffers['old.md']).toBeUndefined();
      expect(buffers['new.md']).toBeDefined();
      expect(flashMessages).toContain('"new.md" renamed');
    });
  });

  describe('deleteBuffer', () => {
    test('deletes current buffer and switches to alternate', () => {
      var { mgr, flashMessages } = makeManager({
        initialBuffers: {
          'a.md': { content: 'aaa', cursor: { line: 0, ch: 0 } },
          'b.md': { content: 'bbb', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: 'b.md' },
      });

      mgr.deleteBuffer();

      expect(mgr.currentName()).toBe('b.md');
      var buffers = mgr.getBuffers();
      expect(buffers['a.md']).toBeUndefined();
      expect(flashMessages).toContain('"a.md" deleted');
    });

    test('deletes current and switches to first other when no alternate', () => {
      var { mgr } = makeManager({
        initialBuffers: {
          'a.md': { content: 'aaa', cursor: { line: 0, ch: 0 } },
          'b.md': { content: 'bbb', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: null },
      });

      mgr.deleteBuffer();

      expect(mgr.currentName()).toBe('b.md');
    });

    test('refuses to delete last buffer', () => {
      var { mgr, flashMessages } = makeManager({
        initialBuffers: {
          'only.md': { content: 'stuff', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'only.md', alternate: null },
      });

      mgr.deleteBuffer();

      expect(mgr.currentName()).toBe('only.md');
      expect(flashMessages).toContain('E84: No modified buffers');
    });

    test('deletes non-current buffer by name', () => {
      var { mgr, flashMessages } = makeManager({
        initialBuffers: {
          'a.md': { content: 'aaa', cursor: { line: 0, ch: 0 } },
          'b.md': { content: 'bbb', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: 'b.md' },
      });

      mgr.deleteBuffer('b.md');

      expect(mgr.currentName()).toBe('a.md');
      var buffers = mgr.getBuffers();
      expect(buffers['b.md']).toBeUndefined();
      expect(flashMessages).toContain('"b.md" deleted');
    });

    test('clears alternate when deleting alternate buffer', () => {
      var { mgr } = makeManager({
        initialBuffers: {
          'a.md': { content: 'aaa', cursor: { line: 0, ch: 0 } },
          'b.md': { content: 'bbb', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: 'b.md' },
      });

      mgr.deleteBuffer('b.md');

      expect(mgr.alternateName()).toBeNull();
    });
  });

  describe('listBuffers', () => {
    test('formats buffer list with markers', () => {
      var { mgr } = makeManager({
        initialBuffers: {
          'a.md': {
            content: 'line1\nline2\nline3',
            cursor: { line: 0, ch: 0 },
          },
          'b.md': { content: 'hello', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: 'b.md' },
      });

      var list = mgr.listBuffers();
      expect(list).toContain('%a');
      expect(list).toContain('"a.md"');
      expect(list).toContain('#');
      expect(list).toContain('"b.md"');
    });

    test('shows [No Name] for unnamed buffer', () => {
      var { mgr } = makeManager();
      var list = mgr.listBuffers();
      expect(list).toContain('[No Name]');
      expect(list).toContain('%a');
    });

    test('shows line numbers', () => {
      var doc = 'line1\nline2\nline3';
      var { mgr } = makeManager({
        opts: {
          getDoc: vi.fn(() => doc),
        },
      });
      var list = mgr.listBuffers();
      // Current buffer should show line count
      expect(list).toMatch(/line\s+3/);
    });
  });

  describe('reset', () => {
    test('wipes everything and starts fresh', () => {
      var { mgr, opts } = makeManager({
        initialBuffers: {
          'a.md': { content: 'aaa', cursor: { line: 0, ch: 0 } },
          'b.md': { content: 'bbb', cursor: { line: 0, ch: 0 } },
        },
        initialSession: { current: 'a.md', alternate: 'b.md' },
      });

      mgr.reset();

      expect(mgr.currentName()).toBe('');
      expect(mgr.alternateName()).toBeNull();
      expect(opts.setDoc).toHaveBeenLastCalledWith('');
      expect(opts.updateBufferDisplay).toHaveBeenLastCalledWith('[No Name]');
      var buffers = mgr.getBuffers();
      var keys = Object.keys(buffers);
      expect(keys).toEqual(['']);
    });

    test('reset with new buffers loads them', () => {
      var { mgr } = makeManager();

      var newBuffers = {
        'x.md': { content: 'xxx', cursor: { line: 0, ch: 0 } },
      };
      mgr.reset(newBuffers);

      // Should switch to first buffer in newBuffers
      expect(mgr.currentName()).toBe('x.md');
      var buffers = mgr.getBuffers();
      expect(buffers['x.md']).toBeDefined();
    });
  });
});
