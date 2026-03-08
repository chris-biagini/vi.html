import { describe, test, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync, existsSync, unlinkSync } from 'fs';

describe('build', () => {
  test('build.js produces vi.html with expected content', () => {
    // Clean up any existing build artifact
    if (existsSync('vi.html')) unlinkSync('vi.html');

    execFileSync('node', ['build.js'], { stdio: 'pipe' });

    expect(existsSync('vi.html')).toBe(true);

    const html = readFileSync('vi.html', 'utf8');

    // Should contain the HTML skeleton
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('editor-container');

    // Should contain bundled JS (CodeMirror)
    expect(html).toContain('EditorView');

    // Should contain bundled CSS (from style.css)
    expect(html).toContain('.cm-header');
  });
});
