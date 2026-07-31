import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { BackendProtocol, FileInfo, GrepMatch, ReadResult, WriteResult, EditResult, LsResult, GrepResult, GlobResult, UploadResult, DownloadResult } from './protocol.js';
import { compileGlob } from './state-backend.js';

export class FilesystemBackend implements BackendProtocol {
  readonly name = 'filesystem';

  constructor(
    private readonly rootDir: string,
    private readonly allowedExtensions?: string[],
  ) {}

  resolveSafePath(inputPath: string): string | null {
    if (typeof inputPath !== 'string' || inputPath.length === 0) return null;
    const normalized = inputPath.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) return null;
    const relative = normalized.replace(/^\/+/, '');
    const resolved = path.resolve(this.rootDir, relative);
    const rootResolved = path.resolve(this.rootDir);
    if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
      return null;
    }
    if (this.allowedExtensions) {
      const ext = path.extname(resolved).toLowerCase();
      if (ext && !this.allowedExtensions.includes(ext)) return null;
    }
    return resolved;
  }

  private toVirtual(absolutePath: string): string {
    const relative = path.relative(this.rootDir, absolutePath).replace(/\\/g, '/');
    return `/${relative}`;
  }

  async ls(inputPath: string): Promise<LsResult> {
    const resolved = this.resolveSafePath(inputPath);
    if (resolved === null) return { error: 'invalid_path', entries: null };
    try {
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const infos = await Promise.all(
        entries.map(async (entry) => {
          const full = path.join(resolved, entry.name);
          let size: number | undefined;
          let modifiedAt: string | undefined;
          if (entry.isFile()) {
            try {
              const stat = await fs.stat(full);
              size = stat.size;
              modifiedAt = stat.mtime.toISOString();
            } catch {
              // stat unavailable; leave undefined
            }
          }
          return {
            path: entry.name,
            isDir: entry.isDirectory(),
            size,
            modifiedAt,
          };
        }),
      );
      infos.sort((a, b) => (a.path < b.path ? -1 : 1));
      return { error: null, entries: infos };
    } catch {
      return { error: 'file_not_found', entries: null };
    }
  }

  async read(filePath: string, offset = 0, limit = 2000): Promise<ReadResult> {
    const resolved = this.resolveSafePath(filePath);
    if (resolved === null) return { error: 'invalid_path', fileData: null };
    try {
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) return { error: 'is_directory', fileData: null };
      const content = await fs.readFile(resolved, 'utf-8');
      const lines = content.split('\n');
      const slice = lines.slice(offset, offset + limit);
      return {
        error: null,
        fileData: {
          content: slice.join('\n'),
          encoding: 'utf-8',
          modifiedAt: stat.mtime.toISOString(),
        },
      };
    } catch {
      return { error: 'file_not_found', fileData: null };
    }
  }

  async grep(pattern: string, inputPath?: string, glob?: string): Promise<GrepResult> {
    const base = inputPath ? this.resolveSafePath(inputPath) : this.rootDir;
    if (base === null) return { error: 'invalid_path', matches: null };
    const globRegex = glob ? compileGlob(glob) : null;
    const matches: GrepMatch[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          await walk(full);
        } else if (entry.isFile()) {
          if (globRegex && !globRegex.test(entry.name)) continue;
          try {
            const content = await fs.readFile(full, 'utf-8');
            const virtual = this.toVirtual(full);
            content.split('\n').forEach((line, index) => {
              if (line.includes(pattern)) {
                matches.push({ path: virtual, line: index + 1, text: line });
              }
            });
          } catch {
            // skip unreadable files
          }
        }
      }
    };
    await walk(base);
    return { error: null, matches };
  }

  async glob(pattern: string, inputPath = '/'): Promise<GlobResult> {
    const base = this.resolveSafePath(inputPath);
    if (base === null) return { error: 'invalid_path', matches: null };
    const regex = compileGlob(pattern);
    const matches: FileInfo[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const virtual = this.toVirtual(full);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          if (regex.test(virtual)) {
            matches.push({ path: virtual, isDir: true });
          }
          await walk(full);
        } else if (entry.isFile()) {
          if (regex.test(virtual)) {
            try {
              const stat = await fs.stat(full);
              matches.push({ path: virtual, isDir: false, size: stat.size, modifiedAt: stat.mtime.toISOString() });
            } catch {
              matches.push({ path: virtual, isDir: false });
            }
          }
        }
      }
    };
    await walk(base);
    matches.sort((a, b) => (a.path < b.path ? -1 : 1));
    return { error: null, matches };
  }

  async write(filePath: string, content: string): Promise<WriteResult> {
    const resolved = this.resolveSafePath(filePath);
    if (resolved === null) return { error: 'invalid_path', path: null };
    try {
      await fs.access(resolved);
      return { error: `File already exists: ${filePath}`, path: null };
    } catch {
      // file does not exist — proceed
    }
    try {
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf-8');
      return { error: null, path: this.toVirtual(resolved) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), path: null };
    }
  }

  async edit(filePath: string, oldString: string, newString: string, replaceAll = false): Promise<EditResult> {
    const resolved = this.resolveSafePath(filePath);
    if (resolved === null) return { error: 'invalid_path', path: null, occurrences: null };
    try {
      const content = await fs.readFile(resolved, 'utf-8');
      if (!content.includes(oldString)) {
        return { error: `Old string not found in ${filePath}`, path: null, occurrences: null };
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
      await fs.writeFile(resolved, updated, 'utf-8');
      return { error: null, path: this.toVirtual(resolved), occurrences };
    } catch {
      return { error: 'file_not_found', path: null, occurrences: null };
    }
  }

  async uploadFiles(files: { path: string; content: Uint8Array }[]): Promise<UploadResult[]> {
    return Promise.all(
      files.map(async (file) => {
        const resolved = this.resolveSafePath(file.path);
        if (resolved === null) return { path: file.path, error: 'invalid_path' };
        try {
          await fs.mkdir(path.dirname(resolved), { recursive: true });
          await fs.writeFile(resolved, file.content);
          return { path: this.toVirtual(resolved), error: null };
        } catch (error) {
          return { path: file.path, error: error instanceof Error ? error.message : String(error) };
        }
      }),
    );
  }

  async downloadFiles(paths: string[]): Promise<DownloadResult[]> {
    return Promise.all(
      paths.map(async (filePath) => {
        const resolved = this.resolveSafePath(filePath);
        if (resolved === null) return { path: filePath, content: null, error: 'invalid_path' };
        try {
          const content = await fs.readFile(resolved);
          return { path: this.toVirtual(resolved), content, error: null };
        } catch {
          return { path: filePath, content: null, error: 'file_not_found' };
        }
      }),
    );
  }
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}
