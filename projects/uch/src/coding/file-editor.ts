import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ReadOptions {
  startLine?: number;
  endLine?: number;
}

export interface EditResult {
  file: string;
  applied: boolean;
  linesChanged: number;
  message: string;
  undoAvailable: boolean;
}

export interface FileBackup {
  file: string;
  content: string;
  timestamp: Date;
}

export interface FileEditorConfig {
  root?: string;
  maxBackupPerFile?: number;
  allowOutsideRoot?: boolean;
}

export class FileEditor {
  private config: Required<FileEditorConfig>;
  private backups: Map<string, FileBackup[]> = new Map();

  constructor(config?: FileEditorConfig) {
    this.config = {
      root: config?.root ?? process.cwd(),
      maxBackupPerFile: config?.maxBackupPerFile ?? 10,
      allowOutsideRoot: config?.allowOutsideRoot ?? false,
    };
  }

  private resolve(filePath: string): string {
    const resolved = path.resolve(this.config.root, filePath);
    const rootResolved = path.resolve(this.config.root);
    if (!this.config.allowOutsideRoot && !resolved.startsWith(rootResolved)) {
      throw new Error(`Path escapes workspace root: ${filePath}`);
    }
    return resolved;
  }

  read(filePath: string, options?: ReadOptions): { content: string; totalLines: number; file: string } {
    const resolved = this.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;

    if (options?.startLine !== undefined || options?.endLine !== undefined) {
      const start = Math.max(1, options?.startLine ?? 1);
      const end = Math.min(totalLines, options?.endLine ?? totalLines);
      return {
        content: lines.slice(start - 1, end).join('\n'),
        totalLines,
        file: resolved,
      };
    }

    return { content, totalLines, file: resolved };
  }

  write(filePath: string, content: string): EditResult {
    const resolved = this.resolve(filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const previous = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf-8') : null;
    this.backup(resolved, previous);

    const linesChanged = previous === null
      ? content.split('\n').length
      : this.countChangedLines(previous, content);

    fs.writeFileSync(resolved, content, 'utf-8');
    return {
      file: resolved,
      applied: true,
      linesChanged,
      message: previous === null ? `Created ${resolved}` : `Wrote ${resolved}`,
      undoAvailable: true,
    };
  }

  edit(filePath: string, startLine: number, endLine: number, replacement: string): EditResult {
    const resolved = this.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    const lines = content.split('\n');

    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      throw new Error(`Invalid line range ${startLine}-${endLine} for file with ${lines.length} lines`);
    }

    this.backup(resolved, content);

    const before = lines.slice(0, startLine - 1);
    const after = lines.slice(endLine);
    const newLines = [...before, ...replacement.split('\n'), ...after];
    const newContent = newLines.join('\n');

    fs.writeFileSync(resolved, newContent, 'utf-8');
    return {
      file: resolved,
      applied: true,
      linesChanged: endLine - startLine + 1,
      message: `Edited ${resolved} lines ${startLine}-${endLine}`,
      undoAvailable: true,
    };
  }

  insert(filePath: string, afterLine: number, content: string): EditResult {
    const resolved = this.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const original = fs.readFileSync(resolved, 'utf-8');
    const lines = original.split('\n');
    if (afterLine < 0 || afterLine > lines.length) {
      throw new Error(`Invalid insert position ${afterLine} for file with ${lines.length} lines`);
    }

    this.backup(resolved, original);
    const newLines = [...lines.slice(0, afterLine), ...content.split('\n'), ...lines.slice(afterLine)];
    fs.writeFileSync(resolved, newLines.join('\n'), 'utf-8');

    return {
      file: resolved,
      applied: true,
      linesChanged: content.split('\n').length,
      message: `Inserted ${content.split('\n').length} lines after line ${afterLine} in ${resolved}`,
      undoAvailable: true,
    };
  }

  append(filePath: string, content: string): EditResult {
    const resolved = this.resolve(filePath);
    const original = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf-8') : '';
    this.backup(resolved, original);
    const separator = original.length > 0 && !original.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(resolved, original + separator + content + '\n', 'utf-8');
    return {
      file: resolved,
      applied: true,
      linesChanged: content.split('\n').length,
      message: `Appended to ${resolved}`,
      undoAvailable: true,
    };
  }

  deleteLines(filePath: string, startLine: number, endLine: number): EditResult {
    return this.edit(filePath, startLine, endLine, '');
  }

  delete(filePath: string): boolean {
    const resolved = this.resolve(filePath);
    if (!fs.existsSync(resolved)) return false;
    this.backup(resolved, fs.readFileSync(resolved, 'utf-8'));
    fs.rmSync(resolved);
    return true;
  }

  exists(filePath: string): boolean {
    return fs.existsSync(this.resolve(filePath));
  }

  list(dirPath = '.'): Array<{ name: string; path: string; isDirectory: boolean; size: number }> {
    const resolved = this.resolve(dirPath);
    if (!fs.existsSync(resolved)) return [];
    return fs.readdirSync(resolved, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      path: path.join(resolved, entry.name),
      isDirectory: entry.isDirectory(),
      size: entry.isFile() ? fs.statSync(path.join(resolved, entry.name)).size : 0,
    }));
  }

  undo(filePath: string): EditResult {
    const resolved = this.resolve(filePath);
    const history = this.backups.get(resolved) ?? [];
    if (history.length === 0) {
      return { file: resolved, applied: false, linesChanged: 0, message: 'No undo history', undoAvailable: false };
    }
    const backup = history.pop()!;
    if (backup.content === null) {
      fs.rmSync(resolved, { force: true });
    } else {
      fs.writeFileSync(resolved, backup.content, 'utf-8');
    }
    return {
      file: resolved,
      applied: true,
      linesChanged: 0,
      message: `Restored ${resolved} to previous state`,
      undoAvailable: history.length > 0,
    };
  }

  getUndoHistory(filePath: string): number {
    return (this.backups.get(this.resolve(filePath)) ?? []).length;
  }

  clearHistory(): void {
    this.backups.clear();
  }

  private backup(filePath: string, content: string | null): void {
    const history = this.backups.get(filePath) ?? [];
    history.push({ file: filePath, content: content ?? '', timestamp: new Date() });
    if (history.length > this.config.maxBackupPerFile) {
      history.shift();
    }
    this.backups.set(filePath, history);
  }

  private countChangedLines(original: string, updated: string): number {
    const origLines = original.split('\n');
    const newLines = updated.split('\n');
    const max = Math.max(origLines.length, newLines.length);
    let changed = 0;
    for (let i = 0; i < max; i++) {
      if (origLines[i] !== newLines[i]) changed++;
    }
    return changed;
  }
}
