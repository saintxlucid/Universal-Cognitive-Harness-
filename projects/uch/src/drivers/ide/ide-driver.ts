import type { NeuralEventBus, EventType } from '../../event-bus/neural-event-bus.js';

export interface IDEFileInfo {
  path: string;
  language: string;
  size: number;
  isActive: boolean;
  lastModified: Date;
}

export interface IDECursorPosition {
  line: number;
  column: number;
}

export interface IDESelection {
  start: IDECursorPosition;
  end: IDECursorPosition;
  text: string;
}

export interface IDEDiagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
}

export interface IDEDriverConfig {
  maxOpenFiles?: number;
  workspacePath?: string;
}

export class IDEDriver {
  private eventBus: NeuralEventBus;
  private config: Required<IDEDriverConfig>;
  private openFiles: Map<string, IDEFileInfo> = new Map();
  private activeFile: string | null = null;
  private cursorPosition: IDECursorPosition = { line: 0, column: 0 };
  private selection: IDESelection | null = null;
  private diagnostics: Map<string, IDEDiagnostic[]> = new Map();
  private active = false;

  constructor(eventBus: NeuralEventBus, config?: IDEDriverConfig) {
    this.eventBus = eventBus;
    this.config = {
      maxOpenFiles: config?.maxOpenFiles ?? 50,
      workspacePath: config?.workspacePath ?? '.',
    };
  }

  start(): void {
    this.active = true;
  }

  stop(): void {
    this.active = false;
    this.openFiles.clear();
    this.activeFile = null;
    this.diagnostics.clear();
  }

  getOpenFiles(): IDEFileInfo[] {
    return Array.from(this.openFiles.values());
  }

  getActiveFile(): IDEFileInfo | null {
    if (!this.activeFile) return null;
    return this.openFiles.get(this.activeFile) ?? null;
  }

  getCursorPosition(): IDECursorPosition {
    return { ...this.cursorPosition };
  }

  getSelection(): IDESelection | null {
    if (!this.selection) return null;
    return { ...this.selection };
  }

  async openFile(info: IDEFileInfo): Promise<void> {
    if (!this.active) return;

    if (this.openFiles.size >= this.config.maxOpenFiles) {
      const firstKey = this.openFiles.keys().next().value;
      if (firstKey) {
        await this.closeFile(firstKey);
      }
    }

    this.openFiles.set(info.path, { ...info, isActive: true, lastModified: new Date() });
    this.activeFile = info.path;

    await this.eventBus.publish({
      type: 'ide:file_opened' as EventType,
      source: 'ide-driver',
      payload: { file: info },
    });
  }

  async closeFile(path: string): Promise<void> {
    if (!this.active) return;

    const file = this.openFiles.get(path);
    if (!file) return;

    this.openFiles.delete(path);
    this.diagnostics.delete(path);

    if (this.activeFile === path) {
      const remaining = this.openFiles.keys().next().value ?? null;
      this.activeFile = remaining;
    }

    await this.eventBus.publish({
      type: 'ide:file_closed' as EventType,
      source: 'ide-driver',
      payload: { path },
    });
  }

  async setCursorPosition(position: IDECursorPosition): Promise<void> {
    if (!this.active) return;

    this.cursorPosition = { ...position };

    await this.eventBus.publish({
      type: 'ide:cursor_moved' as EventType,
      source: 'ide-driver',
      payload: { position, file: this.activeFile },
    });
  }

  async setSelection(selection: IDESelection): Promise<void> {
    if (!this.active) return;

    this.selection = { ...selection };

    await this.eventBus.publish({
      type: 'ide:selection_changed' as EventType,
      source: 'ide-driver',
      payload: { selection, file: this.activeFile },
    });
  }

  async setDiagnostics(file: string, diags: IDEDiagnostic[]): Promise<void> {
    if (!this.active) return;

    this.diagnostics.set(file, [...diags]);
  }

  getDiagnostics(file?: string): IDEDiagnostic[] {
    if (file) {
      return this.diagnostics.get(file) ?? [];
    }
    const all: IDEDiagnostic[] = [];
    for (const [, diags] of this.diagnostics) {
      all.push(...diags);
    }
    return all;
  }

  clearDiagnostics(file?: string): void {
    if (file) {
      this.diagnostics.delete(file);
    } else {
      this.diagnostics.clear();
    }
  }
}
