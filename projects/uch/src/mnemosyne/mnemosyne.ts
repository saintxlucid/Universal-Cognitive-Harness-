// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — the cognitive memory brain of UCH
// Orchestrator: sensory write path → gate → hippocampus; retrieval → gate →
// evidence packets; sleep → consolidation; compiler → context banks.
// Ground truth is sacred; everything derived is traceable.
// ═══════════════════════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SensoryCortex, type RawObservation } from './sensory-cortex.js';
import { ParahippocampalGate } from './parahippocampal-gate.js';
import { RetrievalCortex, type RetrievalQuery } from './retrieval-cortex.js';
import { SleepCycle, type ClaimExtractor } from './sleep-cycle.js';
import { ContextCompiler, type BankKind } from './context-compiler.js';
import { EpisodicStore } from './stores/episodic-store.js';
import { SemanticStore } from './stores/semantic-store.js';
import { ProceduralStore } from './stores/procedural-store.js';
import { DEFAULT_DECAY, type DecaySchedule } from './activation.js';
import { ImportanceEconomy, RoiLedger } from './economy.js';
import type { EvidencePacket, MnemEpisode, MnemosyneStats, Scope, SleepReport } from './types.js';

export interface MnemosyneConfig {
  scope: Scope;
  decay?: Partial<DecaySchedule>;
  extractor?: ClaimExtractor;
}

export interface IngestResult {
  episodeId: string;
  admitted: boolean;
  flags: string[];
  reason: string;
}

export interface MnemosyneSnapshot {
  scope: Scope;
  episodes: MnemEpisode[];
  claims: ReturnType<SemanticStore['snapshot']>;
  procedural: ReturnType<ProceduralStore['snapshot']>;
  banks: ReturnType<ContextCompiler['snapshot']>;
  gate: ReturnType<ParahippocampalGate['snapshot']>;
  economy: Array<{ id: string; sti: number; lti: number; vlti: number }>;
}

export class Mnemosyne {
  readonly sensory: SensoryCortex;
  readonly gate: ParahippocampalGate;
  readonly episodic: EpisodicStore;
  readonly semantic: SemanticStore;
  readonly procedural: ProceduralStore;
  readonly retrieval: RetrievalCortex;
  readonly sleep: SleepCycle;
  readonly compiler: ContextCompiler;
  readonly economy: ImportanceEconomy;
  readonly roi: RoiLedger;

  private scope: Scope;
  private decay: DecaySchedule;

  constructor(config: MnemosyneConfig) {
    this.scope = config.scope;
    this.decay = { ...DEFAULT_DECAY, ...(config.decay ?? {}) };
    this.sensory = new SensoryCortex();
    this.gate = new ParahippocampalGate();
    this.episodic = new EpisodicStore();
    this.semantic = new SemanticStore();
    this.procedural = new ProceduralStore();
    this.retrieval = new RetrievalCortex(this.episodic, this.semantic, this.procedural, this.gate, this.decay);
    this.sleep = new SleepCycle(this.episodic, this.semantic, this.procedural, this.gate, this.decay, config.extractor);
    this.compiler = new ContextCompiler();
    this.economy = new ImportanceEconomy();
    this.roi = new RoiLedger();
  }

  /** Write path: sanitize → contextualize → encode → gate → append (immutable). */
  ingest(raw: Omit<RawObservation, 'scope'> & { scope?: Scope }): IngestResult {
    const scope = raw.scope ?? this.scope;
    const id = `ep-${randomUUID()}`;
    const encoded = this.sensory.encode({ ...raw, scope }, id);

    const decision = this.gate.admitWrite({
      scope,
      channel: encoded.channel,
      reliability: encoded.reliability,
      instructionLikeness: encoded.instructionLikeness,
      text: encoded.content.text,
      targetId: id,
      op: 'write',
    });
    this.gate.observeWrite(scope, encoded.channel, encoded.instructionLikeness, id);

    if (decision.admitted) {
      this.episodic.append(encoded);
      this.economy.seed(id, encoded.importance);
    } else {
      this.gate.quarantine(id);
    }

    return { episodeId: id, admitted: decision.admitted, flags: decision.flags, reason: decision.reason };
  }

  /** Outcome feedback: reward shapes the importance economy (DA). */
  observeOutcome(episodeId: string, outcome: number, note?: string): void {
    const episode = this.episodic.peek(episodeId);
    if (!episode) return;
    if (note) this.episodic.addCrossRef(episodeId, `outcome:${note}`);
    this.economy.reinforce(episodeId, outcome);
    if (outcome < 0) {
      this.economy.disconfirm(episodeId);
    }
  }

  /** Read path: five-gate admission pipeline → budgeted evidence packet. */
  recall(query: Omit<RetrievalQuery, 'scope'> & { scope?: Scope }): EvidencePacket {
    const result = this.retrieval.retrieve({ ...query, scope: query.scope ?? this.scope });
    for (const item of result.packet.items) {
      this.economy.boostSti(item.id);
      this.roi.recordUse(item.id, this.classOf(item.id), item.tokens, 0);
    }
    return result.packet;
  }

  /** Reinforce memories that were actually used with good outcomes. */
  rewardUsed(ids: string[], reward: number): void {
    for (const id of ids) {
      this.economy.reinforce(id, reward);
      this.roi.recordUse(id, this.classOf(id), 0, reward);
    }
  }

  /** Off-critical-path consolidation. */
  runSleep(options?: { phase?: 'nap' | 'deep'; limit?: number }): SleepReport {
    return this.sleep.run(options ?? {});
  }

  /** Context compilation: memory banks for the always-in-context layer. */
  banks(): ReturnType<ContextCompiler['compile']> {
    return this.compiler.compile();
  }

  setBankBlock(kind: BankKind, label: string, content: string): void {
    this.compiler.setBlock(kind, label, content, 'sleep');
  }

  /** Sync economy state into store tiers (ECAN retention policy). */
  applyEconomy(): { promoted: number; archived: number } {
    let promoted = 0;
    let archived = 0;
    for (const episode of this.episodic.all()) {
      const tier = this.economy.tierOf(episode.id, episode.importance);
      if (tier === 'archive' && episode.tier !== 'archive') {
        this.episodic.setTier(episode.id, 'archive');
        archived++;
      } else if (tier === 'core' && episode.tier !== 'core') {
        this.episodic.setTier(episode.id, 'core');
        promoted++;
      }
    }
    return { promoted, archived };
  }

  stats(): MnemosyneStats {
    const semanticCount = this.semantic.count();
    const proceduralCount = this.procedural.count();
    const roiByClass = {
      episodic: this.roi.classRoi('episodic'),
      working: this.roi.classRoi('working'),
      semantic: this.roi.classRoi('semantic'),
      preference: this.roi.classRoi('preference'),
      behavior: this.roi.classRoi('behavior'),
      procedure: this.roi.classRoi('procedure'),
    };
    const budget = this.compiler.compile();
    return {
      episodes: this.episodic.count(),
      episodesArchived: this.episodic.byTier('archive').length,
      claims: semanticCount.claims,
      claimsActive: semanticCount.claimsActive,
      entities: semanticCount.entities,
      patterns: proceduralCount.patterns,
      lessons: proceduralCount.lessons,
      auditEntries: this.gate.auditLog().length,
      quarantined: this.gate.auditLog().length,
      tokenBudget: { admitted: budget.tokens, spent: budget.tokens },
      roiByClass,
    };
  }

  /** Ground-truth contract: derived objects enumerate their source episodes. */
  provenanceOf(claimId: string): MnemEpisode[] {
    const claim = this.semantic.peek(claimId);
    if (!claim) return [];
    return claim.sourceEpisodes.map((id) => this.episodic.peek(id)).filter((e): e is MnemEpisode => e !== undefined);
  }

  async persist(filePath: string): Promise<void> {
    const snapshot: MnemosyneSnapshot = {
      scope: this.scope,
      episodes: this.episodic.snapshot(),
      claims: this.semantic.snapshot(),
      procedural: this.procedural.snapshot(),
      banks: this.compiler.snapshot(),
      gate: this.gate.snapshot(),
      economy: Array.from(this.economy.snapshot().entries()).map(([id, v]) => ({ id, ...v })),
    };
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  async load(filePath: string): Promise<void> {
    const raw = await readFile(filePath, 'utf8');
    const data = JSON.parse(raw) as MnemosyneSnapshot;
    this.scope = data.scope;
    this.episodic.restore(data.episodes);
    this.semantic.restore(data.claims);
    this.procedural.restore(data.procedural);
    this.compiler.restore(data.banks);
    this.gate.restore(data.gate);
    const economyMap = new Map<string, { sti: number; lti: number; vlti: number }>();
    for (const entry of data.economy ?? []) {
      economyMap.set(entry.id, { sti: entry.sti, lti: entry.lti, vlti: entry.vlti });
    }
    this.economy.restore(economyMap);
  }

  private classOf(id: string): MnemEpisode['class'] {
    const episode = this.episodic.peek(id);
    if (episode) return episode.class;
    const claim = this.semantic.peek(id);
    if (claim) return claim.class;
    const pattern = this.procedural.get(id);
    if (pattern) return 'procedure';
    return 'semantic';
  }
}
