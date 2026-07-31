import { CognitiveKernel } from '../kernel/cognitive-kernel.js';

export interface EpisodicMemory {
  id: string;
  timestamp: Date;
  type: string;
  summary: string;
  details: Record<string, unknown>;
  importance: number;
  consolidated: boolean;
}

export class Hippocampus {
  private kernel: CognitiveKernel;
  private buffer: EpisodicMemory[] = [];
  private longTerm: EpisodicMemory[] = [];
  private nextId = 0;

  constructor(kernel: CognitiveKernel) {
    this.kernel = kernel;
  }

  record(type: string, summary: string, details: Record<string, unknown>, importance = 0.5): string {
    const id = `mem-${this.nextId++}`;
    const memory: EpisodicMemory = {
      id,
      timestamp: new Date(),
      type,
      summary,
      details,
      importance,
      consolidated: false,
    };
    this.buffer.push(memory);
    if (this.buffer.length > 200) {
      const leastImportant = this.buffer.reduce((min, m) =>
        m.importance < min.importance ? m : min,
      );
      this.buffer = this.buffer.filter((m) => m.id !== leastImportant.id);
    }
    return id;
  }

  async tick(): Promise<void> {
    await this.consolidate();
    await this.rehearse();
  }

  private async consolidate(): Promise<void> {
    const candidates = this.buffer.filter(
      (m) => !m.consolidated && m.importance > 0.6,
    );

    for (const memory of candidates) {
      memory.consolidated = true;
      this.longTerm.push(memory);

      this.buffer = this.buffer.filter((m) => m.id !== memory.id);

      await this.kernel.remember({
        content: { type: 'text', text: memory.summary },
        concepts: [memory.type],
      }).catch(() => {});
    }

    if (this.longTerm.length > 1000) {
      this.longTerm.sort((a, b) => b.importance - a.importance);
      this.longTerm = this.longTerm.slice(0, 1000);
    }
  }

  private async rehearse(): Promise<void> {
    const recurrent = this.longTerm.filter(
      (m) => Date.now() - m.timestamp.getTime() > 86400000 && m.importance > 0.8,
    );
    for (const memory of recurrent) {
      memory.importance = Math.min(1, memory.importance + 0.05);
    }
  }

  recall(query: string, limit = 10): EpisodicMemory[] {
    const q = query.toLowerCase();
    const all = [...this.buffer, ...this.longTerm];
    return all
      .filter(
        (m) =>
          m.summary.toLowerCase().includes(q) ||
          m.type.toLowerCase().includes(q),
      )
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  getStatus(): Record<string, unknown> {
    return {
      bufferSize: this.buffer.length,
      longTermSize: this.longTerm.length,
      totalMemories: this.buffer.length + this.longTerm.length,
      avgImportance:
        this.longTerm.length > 0
          ? this.longTerm.reduce((s, m) => s + m.importance, 0) / this.longTerm.length
          : 0,
      consolidated: this.longTerm.length,
    };
  }
}
