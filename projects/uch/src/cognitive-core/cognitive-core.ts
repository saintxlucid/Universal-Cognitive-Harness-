import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { join } from 'node:path';
import { AetherCore, type AetherConfig } from '../aether/aether-core.js';
import { Consciousness } from '../aether/consciousness.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { TraceRecorder } from '../cognitive-plane/trace-engine/trace-recorder.js';
import { CognitiveReplay } from '../cognitive-plane/replay/cognitive-replay.js';
import { TracePersistence } from '../cognitive-plane/persistence/trace-persistence.js';
import { PersistenceProvider } from '../cognitive-plane/persistence/persistence-provider.js';
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

/** Result of one boot phase. A failed phase degrades the core instead of
 * aborting boot (W-09). */
export interface BootPhaseResult {
  phase: string;
  ok: boolean;
  error?: string;
}

/** Health report of the last boot: overall verdict + per-phase results. */
export interface BootReport {
  ok: boolean;
  startedAt: Date;
  results: BootPhaseResult[];
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
  /** Organism-wide store coordinator — every registered Storable organ is
   * loaded at boot and flushed on an interval + shutdown (W-02). */
  readonly organismPersistence: PersistenceProvider;
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
  private bootReport: BootReport | null = null;

  constructor(config: CognitiveCoreConfig) {
    this.config = config;

    const conscious = this.buildConsciousnessPlane(config);
    this.eventBus = conscious.eventBus;
    this.nervousSystem = conscious.nervousSystem;
    this.metabolism = conscious.metabolism;
    this.consciousness = conscious.consciousness;
    this.aether = conscious.aether;

    const cognition = this.buildCognitionPlane(config);
    this.kernel = cognition.kernel;
    this.workspace = cognition.workspace;
    this.executive = cognition.executive;

    const trace = this.buildTracePlane(config);
    this.persistence = trace.persistence;
    this.traceRecorder = trace.recorder;
    this.replay = trace.replay;
    this.signals = trace.signals;

    const defense = this.buildDefensePlane(config);
    this.policies = defense.policies;
    this.auth = defense.auth;
    this.immuneSystem = defense.immuneSystem;
    this.endocrineSystem = defense.endocrineSystem;
    this.sleepCycle = defense.sleepCycle;
    this.actionSelector = defense.actionSelector;

    const learning = this.buildLearningPlane();
    this.connectome = learning.connectome;
    this.hippocampus = learning.hippocampus;
    this.neocortex = learning.neocortex;
    this.cortexKernel = learning.cortexKernel;

    this.organismPersistence = this.buildOrganismPersistence();

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

  /** Arousal plane: the bus, nervous system, metabolism, consciousness, and
   * the aether orchestrator. No cross-organ dependencies. */
  private buildConsciousnessPlane(config: CognitiveCoreConfig) {
    const eventBus = new NeuralEventBus();
    const nervousSystem = new NervousSystem({ trackEnergy: true });
    const metabolism = new Metabolism();
    const consciousness = new Consciousness();
    const aether = new AetherCore(eventBus, {
      tickIntervalMs: 5000,
      ...config.aetherConfig,
    });
    return { eventBus, nervousSystem, metabolism, consciousness, aether };
  }

  /** Cognition plane: kernel (working memory), workspace brain, executive. */
  private buildCognitionPlane(config: CognitiveCoreConfig) {
    const kernel = new CognitiveKernel({
      agent_id: config.agentId ?? 'cognitive-core',
      user_id: 'system',
      project_id: config.workspaceId,
    });
    const workspace = new WorkspaceBrain({
      workspace_id: config.workspaceId,
      name: config.workspaceName,
      root_path: config.workspaceRoot,
      eventBus: this.eventBus,
    });
    const executive = new ExecutiveBrain({ eventBus: this.eventBus });
    return { kernel, workspace, executive };
  }

  /** Trace plane: the ADR-002 ledger, recorder, replay, signals, and the
   * journal persistence sink. The journal defaults to the workspace root,
   * never the process CWD (W-07). */
  private buildTracePlane(config: CognitiveCoreConfig) {
    const persistence = new TracePersistence(
      config.traceFile ?? join(config.workspaceRoot, '.uccp', 'traces.jsonl'),
    );
    const recorder = new TraceRecorder(this.eventBus, {
      onTrace: (trace) => persistence.append(trace),
    });
    const replay = new CognitiveReplay(recorder.ledger);
    const signals = new SignalStore(recorder.ledger);
    return { persistence, recorder, replay, signals };
  }

  /** Defense + regulation plane: policies, auth, immune, endocrine, sleep,
   * and the basal-ganglia action selector. */
  private buildDefensePlane(config: CognitiveCoreConfig) {
    const policies = config.policies ?? new PolicyEngine();
    const auth = config.auth ?? new Auth();
    const immuneSystem = new ImmuneSystem(
      policies,
      auth,
      config.reflexEngine ?? new ReflexEngine(),
    );
    const endocrineSystem = new EndocrineSystem(this.nervousSystem, this.consciousness);
    const sleepCycle = new SleepCycle(
      this.nervousSystem,
      this.aether,
      createKernelMemorySource(this.kernel),
      null,
    );
    const actionSelector = new ActionSelector();
    return { policies, auth, immuneSystem, endocrineSystem, sleepCycle, actionSelector };
  }

  /** Learning plane: connectome, hippocampus, neocortex, cortex kernel. */
  private buildLearningPlane() {
    const connectome = new Connectome();
    const hippocampus = new Hippocampus(this.kernel);
    const neocortex = new Neocortex();
    const cortexKernel = new CortexKernel(
      this.consciousness,
      this.kernel,
      this.executive,
      this.eventBus,
    );
    return { connectome, hippocampus, neocortex, cortexKernel };
  }

  /** Organism-wide store coordinator — registers every durable Storable organ
   * and persists them under {workspaceRoot}/.uccp/persist/organism (W-02). */
  private buildOrganismPersistence(): PersistenceProvider {
    const provider = new PersistenceProvider({
      baseDir: this.persistenceBaseDir(),
      files: {
        connectome: 'connectome.json',
        signals: 'signals.json',
      },
    });
    provider.register('connectome', this.connectome, 'connectome.json');
    provider.register('signals', this.signals, 'signals.json');
    return provider;
  }

  /** Where the organism-wide store snapshots live, relative to the workspace
   * root (not the process CWD — W-07). */
  private persistenceBaseDir(): string {
    return join(this.config.workspaceRoot, '.uccp', 'persist', 'organism');
  }

  private registerAetherSubsystems(): void {
    this.aether.register('endocrine', {
      name: 'endocrine',
      tick: async () => {
        await this.endocrineSystem.tick();
      },
      status: () => this.endocrineSystem.getStatus(),
    });
    this.aether.register('immune', {
      name: 'immune',
      tick: async () => {
        await this.immuneSystem.tick();
      },
      status: () => this.immuneSystem.getStatus(),
    });
    this.aether.register('hippocampus', {
      name: 'hippocampus',
      tick: async () => {
        await this.hippocampus.tick();
      },
      status: () => this.hippocampus.getStatus(),
    });
  }

  private wireNervousSystem(): void {
    this.nervousSystem.subscribe(
      'cortex',
      async (signal) => {
        this.consciousness.observe('working', `Signal: ${signal.type}`, signal.source);
      },
      undefined,
      'consciousness-feed',
    );
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
        if (
          typeof from !== 'string' ||
          typeof to !== 'string' ||
          from.length === 0 ||
          to.length === 0
        ) {
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
      {
        from: 'eventBus',
        to: 'traceRecorder',
        type: 'event-driven',
        description: 'Events flow from bus to recorder',
      },
      {
        from: 'traceRecorder',
        to: 'signals',
        type: 'data-flow',
        description: 'Trace ledger feeds signal detection',
      },
      {
        from: 'eventBus',
        to: 'endocrine',
        type: 'event-driven',
        description: 'Events trigger neuromodulation updates',
      },
      {
        from: 'aether',
        to: 'consciousness',
        type: 'control',
        description: 'Aether orchestrates consciousness layers',
      },
      {
        from: 'fsDriver',
        to: 'eventBus',
        type: 'event-driven',
        description: 'Filesystem changes propagate as events',
      },
    ];
    for (const seed of seeds) {
      void this.nervousSystem.emit(
        createSignal('connectome:link', this.config.agentId ?? 'cognitive-core', seed),
      );
    }
  }

  async start(): Promise<void> {
    const results: BootPhaseResult[] = [];

    await this.runBootPhase(
      'trace-persistence',
      async () => {
        this.persistence.open();
        await this.persistence.loadInto(this.traceRecorder.ledger);
      },
      results,
    );
    await this.runBootPhase(
      'organism-persistence',
      async () => {
        await this.organismPersistence.loadAll();
        this.organismPersistence.startAutoSave();
      },
      results,
    );
    await this.runBootPhase(
      'aether',
      async () => {
        this.aether.start();
      },
      results,
    );
    await this.runBootPhase(
      'metabolism',
      async () => {
        this.metabolism.start();
      },
      results,
    );

    this.bootReport = {
      ok: results.every((r) => r.ok),
      startedAt: new Date(),
      results,
    };

    const sig = createSignal('aether:started', 'cognitive-core', {
      workspaceId: this.config.workspaceId,
      startedAt: new Date().toISOString(),
    });
    await this.nervousSystem.emit(sig);

    this.aether.observeThought('meta', 'Cognitive Core booted', 'cognitive-core', ['startup']);
  }

  /** Boot-phase runner: a failing phase degrades the core instead of aborting
   * boot; the failure is recorded in the boot report for health inspection. */
  private async runBootPhase(
    phase: string,
    fn: () => Promise<void>,
    results: BootPhaseResult[],
  ): Promise<void> {
    try {
      await fn();
      results.push({ phase, ok: true });
    } catch (err) {
      results.push({
        phase,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Report of the last boot — null until start() has run once. */
  getBootReport(): BootReport | null {
    return this.bootReport;
  }

  async stop(): Promise<void> {
    this.organismPersistence.stopAutoSave();
    await this.organismPersistence.persistAll();
    this.metabolism.stop();
    this.aether.stop();
    await this.persistence.close();
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
