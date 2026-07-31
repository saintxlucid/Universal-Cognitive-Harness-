import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import type { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import type { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

interface AttachedAgent {
  agent_id: string;
  agent_type: 'ide' | 'cli' | 'agent' | 'runtime';
  connected_at: Date;
  last_active: Date;
  capabilities: string[];
  metadata: Record<string, unknown>;
}

interface CognitiveStateSnapshot {
  timestamp: Date;
  episodes_count: number;
  concepts_count: number;
  active_plans: number;
  beliefs_count: number;
  attached_agents: string[];
  health_status: string;
}

export interface StateVirtualizationConfig {
  kernel: CognitiveKernel;
  workspace: WorkspaceBrain;
  executive: ExecutiveBrain;
  eventBus: NeuralEventBus;
}

export class StateVirtualization {
  private kernel: CognitiveKernel;
  private workspace: WorkspaceBrain;
  private executive: ExecutiveBrain;
  private eventBus: NeuralEventBus;
  private agents: Map<string, AttachedAgent> = new Map();
  private snapshots: CognitiveStateSnapshot[] = [];
  private sharedState: Map<string, unknown> = new Map();

  constructor(config: StateVirtualizationConfig) {
    this.kernel = config.kernel;
    this.workspace = config.workspace;
    this.executive = config.executive;
    this.eventBus = config.eventBus;
  }

  attachAgent(agentId: string, metadata?: Record<string, unknown>): void {
    const agent: AttachedAgent = {
      agent_id: agentId,
      agent_type: (metadata?.type as 'ide' | 'cli' | 'agent' | 'runtime') ?? 'agent',
      connected_at: new Date(),
      last_active: new Date(),
      capabilities: (metadata?.capabilities as string[]) ?? [],
      metadata: metadata ?? {},
    };
    this.agents.set(agentId, agent);
  }

  detachAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  getAttachedAgents(): string[] {
    return [...this.agents.keys()];
  }

  getAgentInfo(agentId: string): AttachedAgent | undefined {
    return this.agents.get(agentId);
  }

  setSharedState(key: string, value: unknown): void {
    this.sharedState.set(key, value);
  }

  getSharedState(key: string): unknown {
    return this.sharedState.get(key);
  }

  snapshot(): CognitiveStateSnapshot {
    const snapshot: CognitiveStateSnapshot = {
      timestamp: new Date(),
      episodes_count: this.kernel.getStats().episodes,
      concepts_count: this.kernel.getStats().concepts,
      active_plans: this.executive.planner.getActivePlans().length,
      beliefs_count: this.kernel.getStats().beliefs,
      attached_agents: this.getAttachedAgents(),
      health_status: this.workspace.health.getOverallStatus(),
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  getSnapshots(count = 10): CognitiveStateSnapshot[] {
    return this.snapshots.slice(-count);
  }

  getStateSummary(): string {
    const snapshot = this.snapshot();
    return [
      `Cognitive State (${snapshot.timestamp.toISOString()})`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Episodes: ${snapshot.episodes_count}`,
      `Concepts: ${snapshot.concepts_count}`,
      `Active Plans: ${snapshot.active_plans}`,
      `Beliefs: ${snapshot.beliefs_count}`,
      `Attached Agents: ${snapshot.attached_agents.join(', ') || 'none'}`,
      `Health: ${snapshot.health_status}`,
    ].join('\n');
  }
}
