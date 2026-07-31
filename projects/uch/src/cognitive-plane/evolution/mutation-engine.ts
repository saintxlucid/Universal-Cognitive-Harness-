import * as crypto from 'node:crypto';

export type MutationType =
  | 'config-change'
  | 'algorithm-swap'
  | 'threshold-adjust'
  | 'feature-toggle'
  | 'param-tune'
  | 'structure-change';

export interface Mutation {
  id: string;
  subsystem: string;
  type: MutationType;
  description: string;
  configDelta: Record<string, unknown>;
  applied: boolean;
  timestamp: Date;
  rollbacked?: boolean;
  score?: number;
}

export interface MutationProposal {
  subsystem: string;
  type: MutationType;
  description: string;
  configDelta: Record<string, unknown>;
  expectedImpact: string;
  risk: 'low' | 'medium' | 'high';
}

export interface MutationResult {
  mutationId: string;
  beforeMetrics: Record<string, number>;
  afterMetrics: Record<string, number>;
  improvement: Record<string, number>;
  score: number;
  keep: boolean;
}

export interface MutableSubsystem {
  name: string;
  getConfig(): Record<string, unknown>;
  applyConfig(delta: Record<string, unknown>): void;
  rollbackConfig(): void;
}

export class MutationEngine {
  private mutations: Mutation[] = [];
  private maxMutations: number;
  private subsystems = new Map<string, MutableSubsystem>();
  private configHistory = new Map<string, Record<string, unknown>>();

  constructor(maxMutations = 1000) {
    this.maxMutations = maxMutations;
  }

  register(subsystem: MutableSubsystem): void {
    this.subsystems.set(subsystem.name, subsystem);
    this.configHistory.set(subsystem.name, { ...subsystem.getConfig() });
  }

  propose(proposal: MutationProposal): Mutation {
    const mutation: Mutation = {
      id: crypto.randomUUID(),
      subsystem: proposal.subsystem,
      type: proposal.type,
      description: proposal.description,
      configDelta: proposal.configDelta,
      applied: false,
      timestamp: new Date(),
    };
    this.mutations.push(mutation);
    if (this.mutations.length > this.maxMutations) this.mutations.shift();
    return mutation;
  }

  apply(mutationId: string): boolean {
    const mutation = this.mutations.find((m) => m.id === mutationId);
    if (!mutation || mutation.applied) return false;
    const sub = this.subsystems.get(mutation.subsystem);
    if (!sub) return false;
    this.configHistory.set(mutation.subsystem, { ...sub.getConfig() });
    sub.applyConfig(mutation.configDelta);
    mutation.applied = true;
    mutation.timestamp = new Date();
    return true;
  }

  rollback(mutationId: string): boolean {
    const mutation = this.mutations.find((m) => m.id === mutationId);
    if (!mutation || !mutation.applied || mutation.rollbacked) return false;
    const sub = this.subsystems.get(mutation.subsystem);
    if (!sub) return false;
    sub.rollbackConfig();
    mutation.rollbacked = true;
    return true;
  }

  recordResult(mutationId: string, result: MutationResult): void {
    const mutation = this.mutations.find((m) => m.id === mutationId);
    if (mutation) {
      mutation.score = result.score;
    }
  }

  getMutations(subsystem?: string): Mutation[] {
    if (subsystem) return this.mutations.filter((m) => m.subsystem === subsystem);
    return [...this.mutations];
  }

  getApplied(): Mutation[] {
    return this.mutations.filter((m) => m.applied && !m.rollbacked);
  }

  getSuccessful(threshold = 0.1): Mutation[] {
    return this.mutations.filter((m) => m.applied && !m.rollbacked && (m.score ?? 0) >= threshold);
  }

  generateProposals(metrics: Record<string, number>): MutationProposal[] {
    const proposals: MutationProposal[] = [];
    for (const [name, sub] of this.subsystems) {
      const config = sub.getConfig();
      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'number') {
          proposals.push({
            subsystem: name, type: 'param-tune',
            description: `Tune ${key} from ${value}`,
            configDelta: { [key]: typeof value === 'number' ? value * (Math.random() > 0.5 ? 1.1 : 0.9) : value },
            expectedImpact: `Adjust ${key} by 10%`,
            risk: 'low',
          });
        }
      }
    }
    return proposals;
  }

  getStats(): Record<string, unknown> {
    return {
      totalMutations: this.mutations.length,
      applied: this.mutations.filter((m) => m.applied).length,
      rollbacked: this.mutations.filter((m) => m.rollbacked).length,
      subsystems: this.subsystems.size,
    };
  }
}
