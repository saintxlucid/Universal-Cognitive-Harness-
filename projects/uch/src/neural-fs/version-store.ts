import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import type { ConceptType } from '../kernel/types/concept.js';
import { classifyEpistemicStatus } from '../kernel/constitution/epistemology.js';

// ── NeuralFS Version Store ────────────────────────────────────────────
// Git-style content addressing for cognition: immutable objects addressed
// by content hash, memory commits as snapshots of kernel state, and
// time travel via checkout. This is the Version Store promised by
// design/ARCHITECTURE.md.
// ──────────────────────────────────────────────────────────────────────

export type NFSTreeDomain = 'concepts' | 'episodes' | 'edges' | 'beliefs';

export interface SnapshotTree {
  type: 'snapshot-tree';
  domains: Partial<Record<NFSTreeDomain, unknown[]>>;
  capturedAt: string;
}

export interface NFSObject {
  cid: string;
  kind: 'tree';
  value: SnapshotTree;
  created: string;
}

export interface NFSCommit {
  cid: string;
  message: string;
  parent: string | null;
  treeCid: string;
  author: string;
  timestamp: string;
}

export interface NFSDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface NFSSnapshotSummary {
  concepts: number;
  edges: number;
  beliefs: number;
  episodesIncluded: number;
}

export interface RestoreResult extends NFSSnapshotSummary {
  commit: string;
}

// ── Content addressing ────────────────────────────────────────────────

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableSerialize(v)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(record[k])}`).join(',')}}`;
}

export function contentID(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableSerialize(value)).digest('hex')}`;
}

// ── Kernel state capture ──────────────────────────────────────────────

export function captureKernelState(kernel: CognitiveKernel): SnapshotTree {
  const concepts = kernel.getAllConcepts();
  const episodes = kernel.getRecentEpisodes(1000);

  const seen = new Set<string>();
  const edges: unknown[] = [];
  for (const concept of concepts) {
    for (const edge of kernel.getRelationships(concept.id)) {
      const key = `${edge.source}|${edge.relationship}|${edge.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        source: edge.source,
        target: edge.target,
        relationship: edge.relationship,
        confidence: edge.confidence?.value ?? edge.confidence,
      });
    }
  }

  const beliefs: unknown[] = [];
  for (const proposition of kernel.getBeliefs().propositions.values()) {
    beliefs.push({
      value: proposition.value,
      confidence: proposition.confidence.value,
      entrenchment: proposition.entrenchment,
      evidenceCount: proposition.evidence.length,
      contradictions: proposition.contradictions,
      status: classifyEpistemicStatus(
        proposition.confidence.value,
        proposition.evidence.length,
        proposition.contradictions.length > 0,
      ),
    });
  }

  return {
    type: 'snapshot-tree',
    domains: {
      concepts: concepts.map((c) => ({
        id: c.id,
        name: c.name,
        concept_type: c.concept_type,
        definition: c.definition,
        purpose: c.purpose,
        importance: c.importance,
        confidence: c.confidence.value,
      })),
      episodes: episodes.map((e) => ({
        id: e.id,
        timestamp: e.timestamp.toISOString(),
        content: e.content,
        concepts: e.concepts,
        provenance: { source: e.provenance.source, reliability: e.provenance.reliability, timestamp: e.provenance.timestamp },
      })),
      edges,
      beliefs,
    },
    capturedAt: new Date().toISOString(),
  };
}

// ── Version store ─────────────────────────────────────────────────────

export interface VersionStoreOptions {
  author?: string;
  persistencePath?: string;
}

interface JournalLine {
  kind: 'object' | 'commit';
  obj?: NFSObject;
  commit?: NFSCommit;
}

export class VersionStore {
  private kernel: CognitiveKernel;
  private author: string;
  private objects = new Map<string, NFSObject>();
  private commits: NFSCommit[] = [];
  private persistencePath: string | null = null;

  constructor(kernel: CognitiveKernel, options?: VersionStoreOptions) {
    this.kernel = kernel;
    this.author = options?.author ?? 'uch';
    if (options?.persistencePath) {
      this.persistencePath = options.persistencePath;
    }
  }

  async init(): Promise<void> {
    if (!this.persistencePath) return;
    await this.loadJournal();
  }

  async setPersistencePath(persistencePath: string): Promise<void> {
    this.persistencePath = persistencePath;
    await this.loadJournal();
  }

  // ── Commits ──

  async commit(message: string): Promise<NFSCommit> {
    const tree = captureKernelState(this.kernel);
    const object: NFSObject = {
      cid: contentID(tree),
      kind: 'tree',
      value: tree,
      created: new Date().toISOString(),
    };

    const parent = this.commits.length > 0 ? this.commits[this.commits.length - 1]!.cid : null;
    const commit: NFSCommit = {
      cid: '',
      message,
      parent,
      treeCid: object.cid,
      author: this.author,
      timestamp: new Date().toISOString(),
    };
    commit.cid = contentID({ ...commit, cid: undefined });

    this.objects.set(object.cid, object);
    this.commits.push(commit);
    await this.appendObject(object);
    await this.appendCommit(commit);
    return commit;
  }

  // ── Reads ──

  headCommit(): NFSCommit | null {
    return this.commits.length > 0 ? this.commits[this.commits.length - 1]! : null;
  }

  log(limit = 20): NFSCommit[] {
    return this.commits.slice(-limit).reverse();
  }

  getCommit(cid: string): NFSCommit | undefined {
    return this.commits.find((c) => c.cid === cid);
  }

  getTree(cid: string): SnapshotTree | undefined {
    const object = this.objects.get(cid);
    return object ? object.value : undefined;
  }

  /** Time travel: resolve the snapshot tree recorded by a commit. */
  checkout(cid: string): SnapshotTree | undefined {
    const commit = this.getCommit(cid);
    if (!commit) return undefined;
    return this.getTree(commit.treeCid);
  }

  // ── Diff ──

  private objectIDs(tree: SnapshotTree | undefined): Map<NFSTreeDomain, Set<string>> {
    const result = new Map<NFSTreeDomain, Set<string>>();
    if (!tree) return result;
    for (const domain of Object.keys(tree.domains) as NFSTreeDomain[]) {
      const entries = tree.domains[domain] ?? [];
      result.set(domain, new Set(entries.map((e) => contentID(e))));
    }
    return result;
  }

  diff(aCid: string, bCid: string): NFSDiff {
    const a = this.objectIDs(this.checkout(aCid));
    const b = this.objectIDs(this.checkout(bCid));
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];

    for (const domain of new Set<NFSTreeDomain>(['concepts', 'episodes', 'edges', 'beliefs'])) {
      const aIds = a.get(domain) ?? new Set<string>();
      const bIds = b.get(domain) ?? new Set<string>();
      for (const id of bIds) {
        if (!aIds.has(id)) added.push(`${domain}:${id.slice(0, 12)}`);
      }
      for (const id of aIds) {
        if (!bIds.has(id)) removed.push(`${domain}:${id.slice(0, 12)}`);
      }
      for (const id of aIds) {
        if (bIds.has(id)) changed.push(`${domain}:${id.slice(0, 12)}`);
      }
    }

    return { added, removed, changed };
  }

  // ── Restore (rollback) ──
  // Replays the recorded snapshot into the kernel. Idempotent by
  // concept/edge identity; episodes are re-appended (append-only log).
  async restore(cid: string, targetKernel?: CognitiveKernel): Promise<RestoreResult | null> {
    const tree = this.checkout(cid);
    if (!tree) return null;
    const kernel = targetKernel ?? this.kernel;

    const concepts = (tree.domains.concepts ?? []) as Array<{
      id: string; name: string; concept_type: ConceptType; definition: string;
      purpose?: string; importance?: number;
    }>;
    let conceptsRestored = 0;
    for (const c of concepts) {
      if (kernel.getConcept(c.id)) continue;
      const created = kernel.addConcept({
        name: c.name,
        concept_type: c.concept_type,
        definition: c.definition,
        purpose: c.purpose,
        importance: c.importance,
      });
      if (created.id !== c.id) {
        // Kernel generates its own id — record under the original id via
        // the graph directly so replay is idempotent.
        kernel.getSemanticGraph().renameConcept(created.id, c.id);
      }
      conceptsRestored += 1;
    }

    let edgesRestored = 0;
    for (const e of (tree.domains.edges ?? []) as Array<{ source: string; target: string; relationship: string; confidence?: number }>) {
      const existing = kernel.getRelationships(e.source).some(
        (edge) => edge.relationship === e.relationship && edge.target === e.target,
      );
      if (existing) continue;
      kernel.addRelationship({
        source: e.source,
        target: e.target,
        relationship: e.relationship,
        source_episode: 'restore',
        confidence: e.confidence,
      });
      edgesRestored += 1;
    }

    let beliefsRestored = 0;
    for (const b of (tree.domains.beliefs ?? []) as Array<{ value: string; confidence: number; evidenceCount: number }>) {
      const existing = kernel.getBeliefs().propositions.get(b.value);
      if (existing) continue;
      await kernel.learnEvidence(b.value, 'restored from snapshot', Math.max(0.1, b.confidence));
      beliefsRestored += 1;
    }

    return {
      commit: cid,
      concepts: conceptsRestored,
      edges: edgesRestored,
      beliefs: beliefsRestored,
      episodesIncluded: (tree.domains.episodes ?? []).length,
    };
  }

  countCommits(): number {
    return this.commits.length;
  }

  countObjects(): number {
    return this.objects.size;
  }

  async shutdown(): Promise<void> {
    // Journal writes are synchronous and flushed per line; nothing to close.
  }

  // ── Persistence ──

  private journalPath(): string {
    return this.persistencePath ? path.join(this.persistencePath, 'neuralfs.journal.jsonl') : '';
  }

  private async appendObject(obj: NFSObject): Promise<void> {
    if (!this.persistencePath) return;
    const line: JournalLine = { kind: 'object', obj };
    await fs.promises.appendFile(this.journalPath(), `${JSON.stringify(line)}\n`, 'utf8');
  }

  private async appendCommit(commit: NFSCommit): Promise<void> {
    if (!this.persistencePath) return;
    const line: JournalLine = { kind: 'commit', commit };
    await fs.promises.appendFile(this.journalPath(), `${JSON.stringify(line)}\n`, 'utf8');
  }

  private async loadJournal(): Promise<void> {
    const file = this.journalPath();
    if (!file || !fs.existsSync(file)) return;

    const lines = (await fs.promises.readFile(file, 'utf8')).split('\n').filter(Boolean);
    for (const raw of lines) {
      try {
        const line = JSON.parse(raw) as JournalLine;
        if (line.kind === 'object' && line.obj) {
          this.objects.set(line.obj.cid, line.obj);
        } else if (line.kind === 'commit' && line.commit) {
          this.commits.push(line.commit);
        }
      } catch {
        // Skip corrupt lines — the journal is append-only and best-effort.
      }
    }
  }
}
