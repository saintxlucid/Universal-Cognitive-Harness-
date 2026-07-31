import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ReflexGateLike, WriteProposal } from '../reflex/types.js';

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
  existed: boolean;
  timestamp: Date;
}

export interface FileEditorConfig {
  root?: string;
  maxBackupPerFile?: number;
  allowOutsideRoot?: boolean;
  gate?: ReflexGateLike;
}

export class FileEditor {
  private config: Required<Omit<FileEditorConfig, 'gate'>>;
  private backups: Map<string, FileBackup[]> = new Map();
  private gate?: ReflexGateLike;

  constructor(config?: FileEditorConfig) {
    this.config = {
      root: config?.root ?? process.cwd(),
      maxBackupPerFile: config?.maxBackupPerFile ?? 10,
      allowOutsideRoot: config?.allowOutsideRoot ?? false,
    };
    this.gate = config?.gate;
  }

  private resolve(filePath: string): string {
    const rootResolved = path.resolve(this.config.root);
    const resolved = path.resolve(rootResolved, filePath);
    if (!this.config.allowOutsideRoot && !this.isContained(rootResolved, resolved)) {
      throw new Error(`Path escapes workspace root: ${filePath}`);
    }
    return resolved;
  }

  private isContained(rootResolved: string, resolved: string): boolean {
    const rel = path.relative(rootResolved, resolved);
    if (rel === '') return true;
    if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
    const rootSep = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;
    if (!resolved.toLowerCase().startsWith(rootSep.toLowerCase())) return false;
    let probe = resolved;
    const tail: string[] = [];
    while (!fs.existsSync(probe)) {
      const parent = path.dirname(probe);
      if (parent === probe) return true;
      tail.unshift(path.basename(probe));
      probe = parent;
    }
    try {
      const rootReal = fs.realpathSync(rootResolved);
      const probeReal = fs.realpathSync(probe);
      let rebuilt = probeReal;
      for (const part of tail) rebuilt = path.join(rebuilt, part);
      const relReal = path.relative(rootReal, rebuilt);
      return relReal === '' || (!relReal.startsWith('..') && !path.isAbsolute(relReal));
    } catch {
      return true;
    }
  }





  read(
    filePath: string,
    options?: ReadOptions,
  ): { content: string; totalLines: number; file: string } {
    const resolved = this.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    const lines = content.split('\n');
    const totalLines =
      lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;

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
    const gate = this.consultGate(filePath, content);
    if (gate.verdict !== 'allow') return this.gateResult(filePath, gate.verdict, gate.reason);

    const resolved = this.resolve(filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const previous = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf-8') : null;
    this.backup(resolved, previous);

    const linesChanged =
      previous === null ? content.split('\n').length : this.countChangedLines(previous, content);

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
    const gate = this.consultGate(filePath, replacement);
    if (gate.verdict !== 'allow') return this.gateResult(filePath, gate.verdict, gate.reason);

    const resolved = this.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    const lines = content.split('\n');

    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      throw new Error(
        `Invalid line range ${startLine}-${endLine} for file with ${lines.length} lines`,
      );
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
    const gate = this.consultGate(filePath, content);
    if (gate.verdict !== 'allow') return this.gateResult(filePath, gate.verdict, gate.reason);

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
    const newLines = [
      ...lines.slice(0, afterLine),
      ...content.split('\n'),
      ...lines.slice(afterLine),
    ];
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
    const gate = this.consultGate(filePath, content);
    if (gate.verdict !== 'allow') return this.gateResult(filePath, gate.verdict, gate.reason);

    const resolved = this.resolve(filePath);
    const original = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf-8') : null;
    this.backup(resolved, original);
    const separator = original && original.length > 0 && !original.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(resolved, (original ?? '') + separator + content + '\n', 'utf-8');
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
    const gate = this.consultGate(filePath);
    if (gate.verdict !== 'allow') return false;

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
      return {
        file: resolved,
        applied: false,
        linesChanged: 0,
        message: 'No undo history',
        undoAvailable: false,
      };
    }
    const backup = history.pop()!;
    if (!backup.existed) {
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

  private consultGate(
    filePath: string,
    content?: string,
  ): { verdict: 'allow' } | { verdict: 'block' | 'defer'; reason: string } {
    if (!this.gate) return { verdict: 'allow' };
    const proposal: WriteProposal = { tool: 'file-editor', target: filePath, content };
    const result = this.gate.evaluate(proposal);
    if (result.verdict === 'allow') return { verdict: 'allow' };
    return { verdict: result.verdict, reason: result.evidence[0]?.reason ?? result.verdict };
  }

  private gateResult(filePath: string, verdict: 'block' | 'defer', reason: string): EditResult {
    return {
      file: this.resolve(filePath),
      applied: false,
      linesChanged: 0,
      message:
        verdict === 'block'
          ? `blocked by reflex gate: ${reason}`
          : `deferred by reflex gate: ${reason}`,
      undoAvailable: false,
    };
  }

  private backup(filePath: string, content: string | null): void {
    const history = this.backups.get(filePath) ?? [];
    history.push({
      file: filePath,
      content: content ?? '',
      existed: content !== null,
      timestamp: new Date(),
    });
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
