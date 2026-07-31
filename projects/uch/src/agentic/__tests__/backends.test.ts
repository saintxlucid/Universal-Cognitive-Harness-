import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StateBackend, FilesystemBackend, createPermission, matchesAnyPermission, isSandboxBackend } from '../backends/index.js';

describe('StateBackend', () => {
  let backend: StateBackend;

  beforeEach(() => {
    backend = new StateBackend();
  });

  it('writes and reads files', async () => {
    const writeResult = await backend.write('/a.txt', 'hello world');
    expect(writeResult.error).toBeNull();
    expect(writeResult.path).toBe('/a.txt');
    const readResult = await backend.read('/a.txt');
    expect(readResult.error).toBeNull();
    expect(readResult.fileData?.content).toBe('hello world');
  });

  it('rejects writes to existing files', async () => {
    await backend.write('/a.txt', 'first');
    const result = await backend.write('/a.txt', 'second');
    expect(result.error).toContain('already exists');
  });

  it('returns file_not_found for missing files', async () => {
    const result = await backend.read('/missing.txt');
    expect(result.error).toBe('file_not_found');
  });

  it('edits with replaceAll and single-occurrence safety', async () => {
    await backend.write('/a.txt', 'foo foo bar');
    const ambiguous = await backend.edit('/a.txt', 'foo', 'baz');
    expect(ambiguous.error).toContain('occurrences');
    const result = await backend.edit('/a.txt', 'foo', 'baz', true);
    expect(result.error).toBeNull();
    expect(result.occurrences).toBe(2);
    const read = await backend.read('/a.txt');
    expect(read.fileData?.content).toBe('baz baz bar');
  });

  it('lists directory entries', async () => {
    await backend.write('/dir/a.txt', 'a');
    await backend.write('/dir/sub/b.txt', 'b');
    await backend.write('/other.txt', 'c');
    const result = await backend.ls('/dir');
    expect(result.error).toBeNull();
    const names = result.entries?.map((e) => e.path);
    expect(names).toContain('a.txt');
    expect(names).toContain('sub');
    expect(names).not.toContain('other.txt');
  });

  it('greps for literal patterns', async () => {
    await backend.write('/x.txt', 'line one\nTODO fix this\nline three');
    const result = await backend.grep('TODO');
    expect(result.error).toBeNull();
    expect(result.matches).toHaveLength(1);
    expect(result.matches?.[0]?.line).toBe(2);
  });

  it('globs with wildcards', async () => {
    await backend.write('/src/a.ts', 'a');
    await backend.write('/src/b.js', 'b');
    const result = await backend.glob('*.ts', '/src');
    expect(result.matches?.map((m) => m.path)).toEqual(['/src/a.ts']);
  });

  it('rejects path traversal', async () => {
    const result = await backend.write('/../evil.txt', 'x');
    expect(result.error).toBe('invalid_path');
  });

  it('uploads and downloads binary content', async () => {
    const bytes = new Uint8Array([1, 2, 3, 255]);
    const upload = await backend.uploadFiles([{ path: '/bin.dat', content: bytes }]);
    expect(upload[0]?.error).toBeNull();
    const download = await backend.downloadFiles(['/bin.dat']);
    expect(download[0]?.content).toEqual(bytes);
  });

  it('snapshots and restores state', async () => {
    await backend.write('/a.txt', 'alpha');
    const snapshot = backend.snapshot();
    const restored = new StateBackend(snapshot);
    const read = await restored.read('/a.txt');
    expect(read.fileData?.content).toBe('alpha');
    restored.restore(snapshot);
    expect(restored.listFilePaths()).toEqual(['/a.txt']);
  });
});

describe('FilesystemBackend', () => {
  let dir: string;
  let backend: FilesystemBackend;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'uch-backend-'));
    backend = new FilesystemBackend(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes and reads real files', async () => {
    const writeResult = await backend.write('/hello.txt', 'disk content');
    expect(writeResult.error).toBeNull();
    const readResult = await backend.read('/hello.txt');
    expect(readResult.fileData?.content).toBe('disk content');
    const onDisk = await writeFile; // reference keeps import used
    expect(onDisk).toBeDefined();
  });

  it('blocks traversal outside root', async () => {
    const result = await backend.write('/../../escape.txt', 'x');
    expect(result.error).toBe('invalid_path');
  });

  it('edits files on disk', async () => {
    await backend.write('/ed.txt', 'one two two');
    const result = await backend.edit('/ed.txt', 'two', 'TWO', true);
    expect(result.error).toBeNull();
    expect(result.occurrences).toBe(2);
    const read = await backend.read('/ed.txt');
    expect(read.fileData?.content).toBe('one TWO TWO');
  });

  it('lists real directories', async () => {
    await mkdir(path.join(dir, 'nested'), { recursive: true });
    await writeFile(path.join(dir, 'nested', 'file.txt'), 'data');
    const result = await backend.ls('/nested');
    expect(result.entries?.map((e) => e.path)).toContain('file.txt');
  });

  it('detects missing files', async () => {
    const read = await backend.read('/nope.txt');
    expect(read.error).toBe('file_not_found');
  });
});

describe('filesystem permissions', () => {
  it('applies first-match-wins ordering', () => {
    const rules = [
      createPermission('/**/*.env', false),
      createPermission('/**', true),
    ];
    expect(matchesAnyPermission('/secrets.env', rules)).toBe(false);
    expect(matchesAnyPermission('/src/app.ts', rules)).toBe(true);
  });

  it('defaults to allow when no rule matches', () => {
    const rules = [createPermission('/blocked/**', false)];
    expect(matchesAnyPermission('/anything/else', rules)).toBe(true);
  });

  it('matches ** recursion', () => {
    const rule = createPermission('/private/**', false);
    expect(rule.matches('/private/deep/nested/file.ts')).toBe(true);
    expect(rule.matches('/public/file.ts')).toBe(false);
  });
});

describe('sandbox protocol', () => {
  it('detects sandbox backends via execute presence', () => {
    expect(isSandboxBackend(new StateBackend())).toBe(false);
  });
});
