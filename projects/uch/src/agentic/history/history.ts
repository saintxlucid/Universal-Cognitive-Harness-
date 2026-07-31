import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Message, Terminal } from '../types.js';

export interface HistoryEntry {
  timestamp: string;
  sessionId: string;
  type: 'message' | 'terminal' | 'meta';
  message?: Message;
  terminal?: Terminal;
  data?: Record<string, unknown>;
}

export class HistoryManager {
  private filePath: string | null = null;
  private entries: HistoryEntry[] = [];

  constructor(filePath?: string) {
    if (filePath) this.filePath = path.resolve(filePath);
  }

  get path(): string | null {
    return this.filePath;
  }

  async open(filePath?: string): Promise<void> {
    if (filePath) this.filePath = path.resolve(filePath);
    if (!this.filePath) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    this.entries = await this.load();
  }

  private async load(): Promise<HistoryEntry[]> {
    if (!this.filePath) return [];
    const content = await fs.readFile(this.filePath, 'utf8').catch(() => '');
    const entries: HistoryEntry[] = [];
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line) as HistoryEntry);
      } catch {
        continue;
      }
    }
    return entries;
  }

  async append(entry: Omit<HistoryEntry, 'timestamp'>): Promise<void> {
    const full: HistoryEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(full);
    if (this.filePath) {
      await fs.appendFile(this.filePath, `${JSON.stringify(full)}\n`, 'utf8');
    }
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    await this.append({ sessionId, type: 'message', message });
  }

  async addTerminal(sessionId: string, terminal: Terminal): Promise<void> {
    await this.append({ sessionId, type: 'terminal', terminal });
  }

  getEntries(): HistoryEntry[] {
    return this.entries;
  }

  getMessages(sessionId: string): Message[] {
    return this.entries
      .filter((e) => e.sessionId === sessionId && e.type === 'message' && e.message)
      .map((e) => e.message as Message);
  }

  getSessions(): string[] {
    return [...new Set(this.entries.map((e) => e.sessionId))];
  }

  async removeLast(): Promise<HistoryEntry | null> {
    const last = this.entries.pop() ?? null;
    if (last && this.filePath) {
      const lines = (await fs.readFile(this.filePath, 'utf8').catch(() => '')).split('\n').filter(Boolean);
      lines.pop();
      await fs.writeFile(this.filePath, lines.join('\n'), 'utf8');
    }
    return last;
  }

  async search(query: string, limit = 20): Promise<HistoryEntry[]> {
    const needle = query.toLowerCase();
    return this.entries
      .filter((e) => JSON.stringify(e).toLowerCase().includes(needle))
      .slice(-limit);
  }
}

export function historyEntryToText(entry: HistoryEntry): string {
  if (entry.type === 'message' && entry.message) {
    const body = entry.message.content
      .map((b) => (b.type === 'text' ? b.text : b.type === 'tool_use' ? `[tool:${b.name}]` : '[tool result]'))
      .join('\n');
    return `[${entry.timestamp}] ${entry.message.role}: ${body}`;
  }
  if (entry.type === 'terminal' && entry.terminal) {
    return `[${entry.timestamp}] terminal(${entry.terminal.state}): ${entry.terminal.message}`;
  }
  return JSON.stringify(entry);
}
