import * as fs from 'node:fs';
import * as path from 'node:path';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';

export interface SessionSnapshot {
  id: string;
  timestamp: string;
  toolName: string;
  workspaceId: string;
  conversation: SessionEntry[];
  memories: SessionMemory[];
  context: Record<string, unknown>;
}

export interface SessionEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SessionMemory {
  key: string;
  value: string;
  type: 'decision' | 'fact' | 'observation' | 'task' | 'convention';
  importance: number;
}

export interface SessionManagerConfig {
  baseDir?: string;
  kernel?: CognitiveKernel;
}

export class SessionManager {
  private baseDir: string;
  private kernel: CognitiveKernel | null;
  private currentSession: SessionSnapshot | null = null;

  constructor(config?: SessionManagerConfig) {
    this.baseDir = config?.baseDir ?? '.uccp/sessions';
    this.kernel = config?.kernel ?? null;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  startSession(toolName: string, workspaceId: string): SessionSnapshot {
    this.currentSession = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      toolName,
      workspaceId,
      conversation: [],
      memories: [],
      context: {},
    };
    return this.currentSession;
  }

  addEntry(entry: Omit<SessionEntry, 'timestamp'>): void {
    if (!this.currentSession) throw new Error('No active session');
    this.currentSession.conversation.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  addMemory(memory: Omit<SessionMemory, 'key'> & { key?: string }): string {
    if (!this.currentSession) throw new Error('No active session');
    const key = memory.key ?? `mem-${this.currentSession.memories.length + 1}`;
    this.currentSession.memories.push({ ...memory, key, importance: memory.importance ?? 0.5 });
    return key;
  }

  setContext(key: string, value: unknown): void {
    if (!this.currentSession) throw new Error('No active session');
    this.currentSession.context[key] = value;
  }

  async saveSession(name?: string): Promise<string> {
    if (!this.currentSession) throw new Error('No active session to save');
    const fileName = `${name ?? this.currentSession.id}.json`;
    const filePath = path.join(this.baseDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(this.currentSession, null, 2));
    return filePath;
  }

  async loadSession(nameOrPath: string): Promise<SessionSnapshot | null> {
    let filePath = nameOrPath;
    if (!fs.existsSync(filePath)) {
      filePath = path.join(this.baseDir, nameOrPath.endsWith('.json') ? nameOrPath : `${nameOrPath}.json`);
    }
    if (!fs.existsSync(filePath)) return null;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SessionSnapshot;
    this.currentSession = data;
    return data;
  }

  getSession(): SessionSnapshot | null {
    return this.currentSession;
  }

  listSessions(): { id: string; timestamp: string; toolName: string }[] {
    if (!fs.existsSync(this.baseDir)) return [];
    return fs.readdirSync(this.baseDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(this.baseDir, f), 'utf-8')) as SessionSnapshot;
          return { id: data.id, timestamp: data.timestamp, toolName: data.toolName };
        } catch { return null; }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  exportSessionHandoff(_name?: string): string {
    if (!this.currentSession) throw new Error('No active session to export');

    const handoff: SessionSnapshot = this.currentSession;
    const keyDecisions = handoff.memories.filter((m) => m.type === 'decision');
    const conventions = handoff.memories.filter((m) => m.type === 'convention');
    const activeTasks = handoff.memories.filter((m) => m.type === 'task');

    const summary = `# Session Handoff: ${handoff.toolName}\n\n` +
      `Session: ${handoff.id}\n` +
      `Started: ${handoff.timestamp}\n\n` +
      (keyDecisions.length > 0 ? `## Key Decisions\n${keyDecisions.map((d) => `- ${d.value}`).join('\n')}\n\n` : '') +
      (conventions.length > 0 ? `## Project Conventions\n${conventions.map((c) => `- ${c.value}`).join('\n')}\n\n` : '') +
      (activeTasks.length > 0 ? `## Active Tasks\n${activeTasks.map((t) => `- ${t.value}`).join('\n')}\n\n` : '') +
      `## Context\n${Object.entries(handoff.context).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n')}\n\n` +
      `## Recent Conversation (last ${Math.min(5, handoff.conversation.length)} messages)\n${
        handoff.conversation.slice(-5).map((e) => `[${e.role}] ${e.content.slice(0, 500)}`).join('\n\n')
      }\n`;

    return summary;
  }
}
