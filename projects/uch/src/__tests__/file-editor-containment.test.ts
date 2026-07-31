import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileEditor } from '../coding/file-editor.js';

describe('FileEditor containment (BUG-201)', () => {
  let root: string;
  let editor: FileEditor;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-fs-root-'));
    editor = new FileEditor({ root });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects sibling-prefix escapes', () => {
    const sibling = root + 'x';
    fs.mkdirSync(sibling);
    try {
      expect(() => editor.write(path.join('..', path.basename(sibling), 'evil.ts'), 'x')).toThrow(/escapes workspace root/);
    } finally {
      fs.rmSync(sibling, { recursive: true, force: true });
    }
  });

  it('rejects absolute paths outside the root', () => {
    expect(() => editor.read('C:/windows/system32/drivers/etc/hosts')).toThrow(/escapes workspace root/);
  });

  it('rejects deep traversal through dotdot segments', () => {
    expect(() => editor.write('a/../../../../outside.ts', 'x')).toThrow(/escapes workspace root/);
  });

  it.runIf(process.platform === 'win32')('allows case-variant paths inside the root on win32', () => {
    const result = editor.write(path.join(root.toLowerCase(), 'CaseTest.txt'), 'ok');
    expect(result.applied).toBe(true);
    expect(fs.existsSync(path.join(root, 'CaseTest.txt'))).toBe(true);
  });

  it('rejects writes through a symlink escaping the root', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-fs-out-'));
    const link = path.join(root, 'link-out');
    fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    try {
      expect(() => editor.write(path.join('link-out', 'evil.ts'), 'x')).toThrow(/escapes workspace root/);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('rejects reads through a symlink escaping the root', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-fs-out-'));
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
    const link = path.join(root, 'link-out');
    fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    try {
      expect(() => editor.read(path.join('link-out', 'secret.txt'))).toThrow(/escapes workspace root/);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('respects allowOutsideRoot', () => {
    const loose = new FileEditor({ root, allowOutsideRoot: true });
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-fs-out-'));
    try {
      const result = loose.write(path.join(outside, 'x.txt'), 'x');
      expect(result.applied).toBe(true);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('still allows normal operations inside the root', () => {
    expect(editor.write('src/a.ts', 'x').applied).toBe(true);
    expect(editor.read('src/a.ts').content).toBe('x');
    expect(editor.edit('src/a.ts', 1, 1, 'y').applied).toBe(true);
  });
});

describe('FileEditor undo of created files (BUG-204)', () => {
  let root: string;
  let editor: FileEditor;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-fs-root-'));
    editor = new FileEditor({ root });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('undo of a file creation removes the file instead of writing an empty one', () => {
    const file = path.join(root, 'created.ts');
    expect(fs.existsSync(file)).toBe(false);
    expect(editor.write('created.ts', 'content').applied).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe('content');
    const undo = editor.undo('created.ts');
    expect(undo.applied).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('undo of an edit restores the original content', () => {
    editor.write('a.ts', 'one\ntwo\nthree\n');
    editor.edit('a.ts', 2, 2, 'TWO');
    expect(fs.readFileSync(path.join(root, 'a.ts'), 'utf8')).toBe('one\nTWO\nthree\n');
    editor.undo('a.ts');
    expect(fs.readFileSync(path.join(root, 'a.ts'), 'utf8')).toBe('one\ntwo\nthree\n');
  });

  it('undo of an append restores the original content', () => {
    editor.write('a.ts', 'base');
    editor.append('a.ts', 'more');
    expect(fs.readFileSync(path.join(root, 'a.ts'), 'utf8')).toContain('base');
    editor.undo('a.ts');
    expect(fs.readFileSync(path.join(root, 'a.ts'), 'utf8')).toBe('base');
  });
});
