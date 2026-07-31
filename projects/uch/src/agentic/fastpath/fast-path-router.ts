export interface RoutineResult {
  routine: string;
  output: string;
  durationMs: number;
}

export interface RoutineHandler {
  name: string;
  description: string;
  keywords: string[];
  execute(input: string): string;
}

export interface FastPathStats {
  totalCalls: number;
  resolved: number;
  missRate: number;
  avgResolutionMs: number;
  routines: number;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  completions: string[];
}

export class PrefixTrie {
  private root: TrieNode = { children: new Map(), completions: [] };
  private keywordCount = 0;

  insert(word: string, routineName: string): void {
    if (word.length === 0) return;
    let node = this.root;
    for (const char of word) {
      let child = node.children.get(char);
      if (!child) {
        child = { children: new Map(), completions: [] };
        node.children.set(char, child);
      }
      node = child;
      if (!node.completions.includes(routineName)) node.completions.push(routineName);
    }
    this.keywordCount++;
  }

  collectCompletions(prefix: string): string[] {
    let node = this.root;
    for (const char of prefix) {
      const child = node.children.get(char);
      if (!child) return [];
      node = child;
    }
    return [...node.completions];
  }

  size(): number {
    return this.keywordCount;
  }
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export class FastPathRouter {
  private routines = new Map<string, RoutineHandler>();
  private trie = new PrefixTrie();
  private calls: Array<{ routine: string | null; durationMs: number }> = [];
  private maxCalls: number;

  constructor(maxCalls = 1000) {
    this.maxCalls = maxCalls;
  }

  register(routine: RoutineHandler): void {
    if (this.routines.has(routine.name)) return;
    this.routines.set(routine.name, routine);
    for (const keyword of routine.keywords) {
      const normalized = normalize(keyword);
      if (normalized.length > 0) this.trie.insert(normalized, routine.name);
    }
  }

  resolve(input: string): RoutineResult | null {
    const start = Date.now();
    this.calls.push({ routine: null, durationMs: 0 });
    const entry = this.calls[this.calls.length - 1]!;
    const tokens = normalize(input).split(' ').filter(Boolean);

    if (tokens.length === 0) {
      entry.durationMs = Date.now() - start;
      return null;
    }

    const candidates = new Map<string, number>();
    for (const token of tokens) {
      for (const name of this.trie.collectCompletions(token)) {
        candidates.set(name, (candidates.get(name) ?? 0) + 1);
      }
    }

    let best: { name: string; hits: number } | null = null;
    for (const [name, hits] of candidates) {
      if (best === null || hits > best.hits) best = { name, hits };
    }

    if (best === null) {
      entry.durationMs = Date.now() - start;
      return null;
    }

    const routine = this.routines.get(best.name)!;
    const output = routine.execute(input);
    const durationMs = Date.now() - start;

    entry.routine = routine.name;
    entry.durationMs = durationMs;

    return { routine: routine.name, output, durationMs };
  }

  getStats(): FastPathStats {
    const totalCalls = this.calls.length;
    const resolved = this.calls.filter((c) => c.routine !== null).length;
    const resolvedCalls = this.calls.filter((c) => c.routine !== null);
    const avgResolutionMs =
      resolvedCalls.length > 0
        ? resolvedCalls.reduce((s, c) => s + c.durationMs, 0) / resolvedCalls.length
        : 0;
    return {
      totalCalls,
      resolved,
      missRate: totalCalls > 0 ? (totalCalls - resolved) / totalCalls : 0,
      avgResolutionMs,
      routines: this.routines.size,
    };
  }

  getRoutine(name: string): RoutineHandler | undefined {
    return this.routines.get(name);
  }

  listRoutines(): string[] {
    return [...this.routines.keys()];
  }

  trim(maxCalls = this.maxCalls): void {
    if (this.calls.length > maxCalls) {
      this.calls = this.calls.slice(-maxCalls);
    }
  }
}
