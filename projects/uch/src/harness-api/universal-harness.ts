import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { BiologicalFunctions } from './biological-functions.js';
import { StateVirtualization } from '../state-virtualization/state-virtualization.js';
import { ScientificMemory } from '../cognitive-plane/memory/scientific-memory.js';
import { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';
import { KnowledgeCompiler } from '../cognitive-plane/compiler/knowledge-compiler.js';
import { TrustEngine } from '../cognitive-plane/trust/trust-engine.js';
import { Conscience } from '../cognitive-brain/conscience.js';
import { EventLedger } from '../cognitive-recorder/event-ledger.js';
import { CognitiveOrganism } from '../cognitive-plane/organism/organism.js';

export interface UCHConfig {
  workspace_id: string;
  workspace_name: string;
  workspace_root: string;
  agent_id?: string;
  user_id?: string;
}

export class UniversalCognitiveHarness {
  readonly eventBus: NeuralEventBus;
  readonly kernel: CognitiveKernel;
  readonly workspace: WorkspaceBrain;
  readonly executive: ExecutiveBrain;
  readonly bio: BiologicalFunctions;
  readonly cognitiveOrganism: CognitiveOrganism;
  readonly eventLedger: EventLedger;
  readonly stateVirtualization: StateVirtualization;
  readonly config: UCHConfig;

  constructor(config: UCHConfig) {
    this.config = config;
    this.eventBus = new NeuralEventBus();
    this.eventLedger = new EventLedger();
    this.kernel = new CognitiveKernel({
      agent_id: config.agent_id ?? 'uch',
      user_id: config.user_id ?? 'default',
      project_id: config.workspace_id,
    });

    this.workspace = new WorkspaceBrain({
      workspace_id: config.workspace_id,
      name: config.workspace_name,
      root_path: config.workspace_root,
      eventBus: this.eventBus,
    });

    this.executive = new ExecutiveBrain({
      eventBus: this.eventBus,
    });

    this.bio = new BiologicalFunctions(this.kernel, this.workspace, this.executive);

    this.cognitiveOrganism = new CognitiveOrganism({
      eventBus: this.eventBus,
      kernel: this.kernel,
      semanticMemory: new ScientificMemory(),
      identity: this.workspace.identity,
      constitution: new CognitiveConstitution(),
      knowledgeCompiler: new KnowledgeCompiler(),
      trustEngine: new TrustEngine(),
      conscience: new Conscience(this.eventLedger, this.kernel),
    });

    this.stateVirtualization = new StateVirtualization({
      kernel: this.kernel,
      workspace: this.workspace,
      executive: this.executive,
      eventBus: this.eventBus,
    });

    this.eventBus.registerModule('memory', [
      'memory:ingest',
      'memory:recall',
      'memory:consolidate',
    ]);
    this.eventBus.registerModule('workspace', ['module:message', 'module:handoff']);
    this.eventBus.registerModule('executive', ['module:message', 'module:handoff']);

    // Wire event bus to workspace brain
    this.wireEventBus();
  }

  private wireEventBus(): void {
    // File events → memory updates
    this.eventBus.subscribe('file:saved', async (event) => {
      const observation = `File saved: ${String(event.payload.path ?? '')}`;
      await this.kernel.remember({
        content: { type: 'observation', observation },
      });
      await this.eventBus.publishProtocol('memory:ingest', 'uch', { observation }, ['memory']);
      await this.eventBus.publishToModule('workspace', {
        type: 'module:message',
        source: 'uch',
        payload: { intent: 'workspace-update', observation },
      });
    });

    // Git commit → timeline + graph update
    this.eventBus.subscribe('git:commit', async (event) => {
      const message = String(event.payload.message ?? '').split('\n')[0]!;
      this.workspace.timeline.addEvent({
        type: 'commit',
        timestamp: new Date(),
        title: `Commit: ${message}`,
        description: String(event.payload.message ?? ''),
        tags: ['git', 'commit'],
        metadata: event.payload,
      });
      await this.eventBus.publishProtocol(
        'module:handoff',
        'uch',
        { intent: 'git-commit', message },
        ['executive'],
      );
    });

    // Error events → health tracking
    this.eventBus.subscribe('error:occurred', async (event) => {
      const message = String(event.payload.message ?? 'Unknown error');
      this.workspace.health.logIncident(message);
      this.workspace.health.setMetric(
        'recent_errors',
        this.workspace.health.getIncidents().length,
        10,
        'count',
      );
      await this.eventBus.publishProtocol(
        'module:handoff',
        'uch',
        { intent: 'error-report', message },
        ['executive'],
      );
    });

    // Agent attachment → state virtualization
    this.eventBus.subscribe('agent:attached', async (event) => {
      const agentId = String(event.payload.agent_id ?? event.source);
      this.stateVirtualization.attachAgent(agentId, event.payload);
    });

    this.eventBus.subscribe('agent:detached', async (event) => {
      const agentId = String(event.payload.agent_id ?? event.source);
      this.stateVirtualization.detachAgent(agentId);
    });

    // Session lifecycle
    this.eventBus.subscribe('session:started', async () => {
      this.kernel.startSleep();
    });
  }

  async start(): Promise<void> {
    this.kernel.startSleep();
    await this.cognitiveOrganism.initialize();
    await this.eventBus.publish({
      type: 'workspace:opened',
      source: 'uch',
      payload: { workspace_id: this.config.workspace_id, name: this.config.workspace_name },
    });
  }

  async stop(): Promise<void> {
    this.kernel.stopSleep();
    await this.eventBus.publish({
      type: 'workspace:closed',
      source: 'uch',
      payload: { workspace_id: this.config.workspace_id },
    });
  }

  getStatus(): UCHStatus {
    const kernelStats = this.kernel.getStats();
    return {
      version: '0.1.0',
      workspace: this.config.workspace_name,
      uptime_seconds: 0,
      episodes: kernelStats.episodes,
      concepts: kernelStats.concepts,
      relationships: kernelStats.relationships,
      beliefs: kernelStats.beliefs,
      events_processed: this.eventBus.getHistory().length,
      subscriptions: this.eventBus.getSubscriptionCount(),
      health: this.workspace.health.getOverallStatus(),
      attached_agents: this.stateVirtualization.getAttachedAgents(),
      sleep_active: kernelStats.sleep_active,
    };
  }
}

export interface UCHStatus {
  version: string;
  workspace: string;
  uptime_seconds: number;
  episodes: number;
  concepts: number;
  relationships: number;
  beliefs: number;
  events_processed: number;
  subscriptions: number;
  health: string;
  attached_agents: string[];
  sleep_active: boolean;
}
