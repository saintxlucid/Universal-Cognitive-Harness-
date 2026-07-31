import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { AetherCore, type AetherConfig } from '../aether/aether-core.js';
import { Consciousness } from '../aether/consciousness.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { TraceRecorder } from '../cognitive-plane/trace-engine/trace-recorder.js';
import { CognitiveReplay } from '../cognitive-plane/replay/cognitive-replay.js';
import { TracePersistence } from '../cognitive-plane/persistence/trace-persistence.js';
import { SignalStore } from '../cognitive-plane/signals/signal-store.js';
import { PolicyEngine } from '../control-plane/policies.js';
import { Auth } from '../control-plane/auth/auth.js';
import { ImmuneSystem } from './immune.js';
import { EndocrineSystem } from './endocrine.js';
import { SleepCycle, createKernelMemorySource } from '../sleep_cycle/cycle.js';
import { ActionSelector } from '../basal_ganglia/action-selector.js';
import { Connectome, type ConnectionType } from '../connectome/wiring.js';
import { Hippocampus } from '../hippocampus/consolidator.js';
import { Neocortex } from '../neocortex/pattern-learner.js';
import { CortexKernel } from '../cortex_kernel/integrator.js';
import { NervousSystem } from '../nervous-system/nervous-system.js';
import { createSignal } from '../nervous-system/signal.js';
import { Metabolism } from '../metabolism/metabolism.js';
import { ReflexEngine } from '../suit/instinct/reflex-engine.js';

export interface CognitiveCoreConfig {
  workspaceId: string;
  workspaceName: string;
  workspaceRoot: string;
  traceFile?: string;
  aetherConfig?: Partial<AetherConfig>;
  agentId?: string;
  policies?: PolicyEngine;
  auth?: Auth;
  reflexEngine?: ReflexEngine;
}

export interface CognitiveCoreState {
  running: boolean;
  startedAt: Date | null;
  aetherPhase: string;
  consciousness: ReturnType<Consciousness['getState']>;
  subsystems: string[];
  connectedAgents: number;
}

export class CognitiveCore {
  readonly eventBus: NeuralEventBus;
  readonly nervousSystem: NervousSystem;
  readonly metabolism: Metabolism;
  readonly consciousness: Consciousness;
  readonly aether: AetherCore;
  readonly kernel: CognitiveKernel;
  readonly workspace: WorkspaceBrain;
  readonly executive: ExecutiveBrain;
  readonly traceRecorder: TraceRecorder;
  readonly replay: CognitiveReplay;
  readonly signals: SignalStore;
  readonly persistence: TracePersistence;
  readonly immuneSystem: ImmuneSystem;
  readonly endocrineSystem: EndocrineSystem;
  readonly sleepCycle: SleepCycle;
  readonly actionSelector: ActionSelector;
  readonly connectome: Connectome;
  readonly hippocampus: Hippocampus;
  readonly neocortex: Neocortex;
  readonly cortexKernel: CortexKernel;
  readonly policies: PolicyEngine;
  readonly auth: Auth;

  private config: CognitiveCoreConfig;

  constructor(config: CognitiveCoreConfig) {
    this.config = config;

    this.eventBus = new NeuralEventBus();
    this.nervousSystem = new NervousSystem({ trackEnergy: true });
    this.metabolism = new Metabolism();
    this.consciousness = new Consciousness();
    this.aether = new AetherCore(this.eventBus, {
      tickIntervalMs: 5000,
      ...config.aetherConfig,
    });
    this.kernel = new CognitiveKernel({
      agent_id: config.agentId ?? 'cognitive-core',
      user_id: 'system',
      project_id: config.workspaceId,
    });
    this.workspace = new WorkspaceBrain({
      workspace_id: config.workspaceId,
      name: config.workspaceName,
      root_path: config.workspaceRoot,
      eventBus: this.eventBus,
    });
    this.executive = new ExecutiveBrain({ eventBus: this.eventBus });

    this.traceRecorder = new TraceRecorder(this.eventBus);
    this.replay = new CognitiveReplay(this.traceRecorder.ledger);
    this.signals = new SignalStore(this.traceRecorder.ledger);
    this.persistence = new TracePersistence(config.traceFile ?? '.uccp/traces.jsonl');

    this.policies = config.policies ?? new PolicyEngine();
    this.auth = config.auth ?? new Auth();
    this.immuneSystem = new ImmuneSystem(this.policies, this.auth, config.reflexEngine ?? new ReflexEngine());
    this.endocrineSystem = new EndocrineSystem(this.nervousSystem, this.consciousness);
    this.sleepCycle = new SleepCycle(
      this.nervousSystem,
      this.aether,
      createKernelMemorySource(this.kernel),
      null,
    );
    this.actionSelector = new ActionSelector();
    this.connectome = new Connectome();
    this.hippocampus = new Hippocampus(this.kernel);
    this.neocortex = new Neocortex();
    this.cortexKernel = new CortexKernel(this.consciousness, this.kernel, this.executive, this.eventBus);

    this.metabolism.registerComponent('exoskeleton', { cpu: 5000, tokens: 500000 });
    this.metabolism.registerComponent('aether');
    this.metabolism.registerComponent('endocrine');
    this.metabolism.registerComponent('immune');
    this.metabolism.registerComponent('sleep-cycle');
    this.metabolism.registerComponent('reflex');

    this.registerAetherSubsystems();
    this.wireNervousSystem();
    this.wireConnectome();
  }

  private registerAetherSubsystems(): void {
    this.aether.register('endocrine', {
      name: 'endocrine',
      tick: async () => { await this.endocrineSystem.tick(); },
      status: () => this.endocrineSystem.getStatus(),
    });
    this.aether.register('immune', {
      name: 'immune',
      tick: async () => { await this.immuneSystem.tick(); },
      status: () => this.immuneSystem.getStatus(),
    });
    this.aether.register('hippocampus', {
      name: 'hippocampus',
      tick: async () => { await this.hippocampus.tick(); },
      status: () => this.hippocampus.getStatus(),
    });
  }

  private wireNervousSystem(): void {
    this.nervousSystem.subscribe('cortex', async (signal) => {
      this.consciousness.observe('working', `Signal: ${signal.type}`, signal.source);
    }, undefined, 'consciousness-feed');
  }

  private wireConnectome(): void {
    this.nervousSystem.subscribeToAll(
      (signal) => {
        if (signal.type !== 'connectome:link') return;
        const { from, to, type, description } = signal.payload as {
          from?: string;
          to?: string;
          type?: ConnectionType;
          description?: string;
        };
        if (typeof from !== 'string' || typeof to !== 'string' || from.length === 0 || to.length === 0) {
          return;
        }
        this.connectome.link(
          from,
          to,
          type ?? 'reference',
          typeof description === 'string' ? description : '',
        );
      },
      (signal) => signal.type === 'connectome:link',
      'connectome-auto-wiring',
    );

    const seeds: Array<{ from: string; to: string; type: ConnectionType; description: string }> = [
      { from: 'eventBus', to: 'traceRecorder', type: 'event-driven', description: 'Events flow from bus to recorder' },
      { from: 'traceRecorder', to: 'signals', type: 'data-flow', description: 'Trace ledger feeds signal detection' },
      { from: 'eventBus', to: 'endocrine', type: 'event-driven', description: 'Events trigger neuromodulation updates' },
      { from: 'aether', to: 'consciousness', type: 'control', description: 'Aether orchestrates consciousness layers' },
      { from: 'fsDriver', to: 'eventBus', type: 'event-driven', description: 'Filesystem changes propagate as events' },
    ];
    for (const seed of seeds) {
      void this.nervousSystem.emit(
        createSignal('connectome:link', this.config.agentId ?? 'cognitive-core', seed),
      );
    }
  }

  async start(): Promise<void> {
    this.persistence.open();
    await this.persistence.loadInto(this.traceRecorder.ledger);
    this.aether.start();
    this.metabolism.start();

    const sig = createSignal('aether:started', 'cognitive-core', {
      workspaceId: this.config.workspaceId,
      startedAt: new Date().toISOString(),
    });
    await this.nervousSystem.emit(sig);

    this.aether.observeThought('meta', 'Cognitive Core booted', 'cognitive-core', [
      'startup',
    ]);
  }

  async stop(): Promise<void> {
    this.metabolism.stop();
    this.aether.stop();
    this.persistence.close();
  }

  getState(): CognitiveCoreState {
    const aether = this.aether.getState();
    return {
      running: aether.running,
      startedAt: aether.startedAt,
      aetherPhase: this.aether.phase,
      consciousness: this.consciousness.getState(),
      subsystems: aether.subsystems,
      connectedAgents: aether.connectedAgents,
    };
  }

  getStats(): Record<string, unknown> {
    return {
      aether: this.aether.getStats(),
      nervousSystem: this.nervousSystem.getStats(),
      metabolism: this.metabolism.getStats(),
      endocrine: this.endocrineSystem.getStatus(),
      immune: this.immuneSystem.getStatus(),
      sleep: this.sleepCycle.getStatus(),
      connectome: this.connectome.getConnections().length,
      actionSelector: this.actionSelector.getStats(),
      hippocampus: this.hippocampus.getStatus(),
      neocortex: this.neocortex.getStatus(),
    };
  }
}
