import type { BackendProtocol, FileData, FileInfo, FileOperationError, GrepMatch, ReadResult, WriteResult, EditResult, LsResult, GrepResult, GlobResult, UploadResult, DownloadResult } from './protocol.js';

interface StoredFile extends FileData {
  path: string;
}

export interface StateBackendSnapshot {
  files: StoredFile[];
  name: string;
}

export class StateBackend implements BackendProtocol {
  readonly name = 'state';

  private files = new Map<string, StoredFile>();

  constructor(snapshot?: StateBackendSnapshot | null) {
    if (snapshot) {
      for (const file of snapshot.files) {
        this.files.set(file.path, { ...file });
      }
    }
  }

  snapshot(): StateBackendSnapshot {
    return {
      files: [...this.files.values()].map((f) => ({ ...f })),
      name: this.name,
    };
  }

  restore(snapshot: StateBackendSnapshot): void {
    this.files = new Map();
    for (const file of snapshot.files) {
      this.files.set(file.path, { ...file });
    }
  }

  clear(): void {
    this.files.clear();
  }

  private normalizePath(path: string): string | null {
    if (typeof path !== 'string' || path.length === 0) return null;
    const normalized = path.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) return null;
    const parts = normalized.split('/');
    for (const part of parts) {
      if (part === '..') return null;
    }
    return normalized.replace(/\/+/g, '/');
  }

  listFilePaths(): string[] {
    return [...this.files.keys()].sort();
  }

  async ls(path: string): Promise<LsResult> {
    const dir = this.normalizePath(path);
    if (dir === null) return { error: 'invalid_path', entries: null };
    const prefix = dir === '/' ? '/' : `${dir}/`;
    const entries: FileInfo[] = [];
    const seen = new Set<string>();
    for (const [filePath, file] of this.files) {
      if (filePath.startsWith(prefix)) {
        const rest = filePath.slice(prefix.length);
        const segment = rest.split('/')[0];
        if (!segment || seen.has(segment)) continue;
        seen.add(segment);
        const isDir = rest.includes('/');
        entries.push({
          path: segment,
          isDir,
          size: isDir ? undefined : (file.content?.length ?? 0),
          modifiedAt: file.modifiedAt,
        });
      }
    }
    entries.sort((a, b) => (a.path < b.path ? -1 : 1));
    return { error: null, entries };
  }

  async read(filePath: string, offset = 0, limit = 2000): Promise<ReadResult> {
    const path = this.normalizePath(filePath);
    if (path === null) return { error: 'invalid_path', fileData: null };
    const file = this.files.get(path);
    if (!file) return { error: 'file_not_found', fileData: null };
    const content = file.encoding === 'base64' ? atob(file.content) : file.content;
    const lines = content.split('\n');
    const slice = lines.slice(offset, offset + limit);
    return {
      error: null,
      fileData: {
        content: slice.join('\n'),
        encoding: 'utf-8',
        createdAt: file.createdAt,
        modifiedAt: file.modifiedAt,
      },
    };
  }

  async grep(pattern: string, path?: string, glob?: string): Promise<GrepResult> {
    const dir = path ? this.normalizePath(path) : '/';
    if (dir === null) return { error: 'invalid_path', matches: null };
    const globRegex = glob ? compileGlob(glob) : null;
    const matches: GrepMatch[] = [];
    for (const [filePath, file] of this.files) {
      if (!filePath.startsWith(dir === '/' ? '/' : `${dir}/`)) continue;
      if (globRegex && !globRegex.test(filePath)) continue;
      const content = file.encoding === 'base64' ? atob(file.content) : file.content;
      content.split('\n').forEach((line, index) => {
        if (line.includes(pattern)) {
          matches.push({ path: filePath, line: index + 1, text: line });
        }
      });
    }
    return { error: null, matches };
  }

  async glob(pattern: string, path = '/'): Promise<GlobResult> {
    const dir = this.normalizePath(path);
    if (dir === null) return { error: 'invalid_path', matches: null };
    const regex = compileGlob(pattern);
    const matches: FileInfo[] = [];
    for (const [filePath, file] of this.files) {
      if (!filePath.startsWith(dir === '/' ? '/' : `${dir}/`)) continue;
      if (regex.test(filePath.slice(dir === '/' ? 1 : dir.length + 1))) {
        matches.push({
          path: filePath,
          isDir: false,
          size: file.content?.length ?? 0,
          modifiedAt: file.modifiedAt,
        });
      }
    }
    matches.sort((a, b) => (a.path < b.path ? -1 : 1));
    return { error: null, matches };
  }

  async write(filePath: string, content: string): Promise<WriteResult> {
    const path = this.normalizePath(filePath);
    if (path === null) return { error: 'invalid_path', path: null };
    if (this.files.has(path)) {
      return { error: `File already exists: ${path}`, path: null };
    }
    const now = new Date().toISOString();
    this.files.set(path, { path, content, encoding: 'utf-8', createdAt: now, modifiedAt: now });
    return { error: null, path };
  }

  async edit(filePath: string, oldString: string, newString: string, replaceAll = false): Promise<EditResult> {
    const path = this.normalizePath(filePath);
    if (path === null) return { error: 'invalid_path', path: null, occurrences: null };
    const file = this.files.get(path);
    if (!file) return { error: 'file_not_found', path: null, occurrences: null };
    const content = file.encoding === 'base64' ? atob(file.content) : file.content;
    if (!content.includes(oldString)) {
      return { error: `Old string not found in ${path}`, path: null, occurrences: null };
    }
    const occurrences = countOccurrences(content, oldString);
    if (!replaceAll && occurrences > 1) {
      return {
        error: `Found ${occurrences} occurrences; use replaceAll for exact matches or provide a larger unique match`,
        path: null,
        occurrences,
      };
    }
    const updated = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString);
    this.files.set(path, { ...file, content: updated, modifiedAt: new Date().toISOString() });
    return { error: null, path, occurrences };
  }

  async uploadFiles(files: { path: string; content: Uint8Array }[]): Promise<UploadResult[]> {
    return files.map((file) => {
      const path = this.normalizePath(file.path);
      if (path === null) return { path: file.path, error: 'invalid_path' as FileOperationError };
      const binary = String.fromCharCode(...file.content);
      const now = new Date().toISOString();
      this.files.set(path, { path, content: btoa(binary), encoding: 'base64', createdAt: now, modifiedAt: now });
      return { path, error: null };
    });
  }

  async downloadFiles(paths: string[]): Promise<DownloadResult[]> {
    return paths.map((filePath) => {
      const path = this.normalizePath(filePath);
      if (path === null) return { path: filePath, content: null, error: 'invalid_path' as FileOperationError };
      const file = this.files.get(path);
      if (!file) return { path: filePath, content: null, error: 'file_not_found' as FileOperationError };
      const content = file.encoding === 'base64' ? base64ToBytes(file.content) : new TextEncoder().encode(file.content);
      return { path, content, error: null };
    });
  }

  stats(): { files: number; bytes: number } {
    let bytes = 0;
    for (const file of this.files.values()) {
      bytes += (file.content?.length ?? 0) + (file.path?.length ?? 0);
    }
    return { files: this.files.size, bytes };
  }
}

export function compileGlob(glob: string): RegExp {
  const source = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\/\*\*\//g, 'UCH_GLOB_DIR')
    .replace(/\*\*/g, 'UCH_GLOB_ANY')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/UCH_GLOB_DIR/g, '(?:/.*)?/')
    .replace(/UCH_GLOB_ANY/g, '.*');
  return new RegExp(`^${source}$`);
}

export function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
