import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NeuralEventBus } from '../../event-bus/neural-event-bus.js';

export interface FileSystemEvent {
  type: 'file:opened' | 'file:saved' | 'file:created' | 'file:deleted' | 'file:renamed';
  path: string;
  timestamp: Date;
  size?: number;
  oldPath?: string;
}

export interface FileSystemDriverConfig {
  watchPaths?: string[];
  rootPath?: string;
}

export class FileSystemDriver {
  private eventBus: NeuralEventBus;
  private config: Required<FileSystemDriverConfig>;
  private watchers: fs.FSWatcher[] = [];

  constructor(eventBus: NeuralEventBus, config?: FileSystemDriverConfig) {
    this.eventBus = eventBus;
    this.config = {
      watchPaths: config?.watchPaths ?? [],
      rootPath: config?.rootPath ?? '.',
    };
  }

  start(): void {
    for (const watchPath of this.config.watchPaths) {
      this.watchDirectory(watchPath);
    }
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }

  async readFile(filePath: string): Promise<{ content: string; size: number }> {
    const resolved = path.resolve(this.config.rootPath, filePath);
    const content = fs.readFileSync(resolved, 'utf-8');
    const stat = fs.statSync(resolved);

    this.eventBus.publish({
      type: 'file:opened',
      source: 'filesystem-driver',
      payload: { path: resolved, size: stat.size },
    });

    return { content, size: stat.size };
  }

  async writeFile(filePath: string, content: string): Promise<{ path: string; size: number }> {
    const resolved = path.resolve(this.config.rootPath, filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');
    const stat = fs.statSync(resolved);

    this.eventBus.publish({
      type: 'file:saved',
      source: 'filesystem-driver',
      payload: { path: resolved, size: stat.size },
    });

    return { path: resolved, size: stat.size };
  }

  async deleteFile(filePath: string): Promise<boolean> {
    const resolved = path.resolve(this.config.rootPath, filePath);
    if (!fs.existsSync(resolved)) return false;
    fs.unlinkSync(resolved);

    this.eventBus.publish({
      type: 'file:deleted',
      source: 'filesystem-driver',
      payload: { path: resolved },
    });

    return true;
  }

  async listDirectory(dirPath: string): Promise<Array<{ name: string; path: string; isDirectory: boolean; size: number }>> {
    const resolved = path.resolve(this.config.rootPath, dirPath);
    if (!fs.existsSync(resolved)) return [];

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    return entries.map((entry) => {
      const fullPath = path.join(resolved, entry.name);
      let size = 0;
      try { if (entry.isFile()) size = fs.statSync(fullPath).size; } catch { /* skip */ }
      return { name: entry.name, path: fullPath, isDirectory: entry.isDirectory(), size };
    });
  }

  async fileExists(filePath: string): Promise<boolean> {
    return fs.existsSync(path.resolve(this.config.rootPath, filePath));
  }

  private watchDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) return;

    try {
      const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const fullPath = path.join(dirPath, filename.toString());

        if (eventType === 'rename') {
          if (fs.existsSync(fullPath)) {
            this.eventBus.publish({
              type: 'file:created',
              source: 'filesystem-driver',
              payload: { path: fullPath },
            });
          } else {
            this.eventBus.publish({
              type: 'file:deleted',
              source: 'filesystem-driver',
              payload: { path: fullPath },
            });
          }
        } else if (eventType === 'change') {
          this.eventBus.publish({
            type: 'file:saved',
            source: 'filesystem-driver',
            payload: { path: fullPath },
          });
        }
      });
      this.watchers.push(watcher);
    } catch { /* watch not supported on this platform */ }
  }
}
