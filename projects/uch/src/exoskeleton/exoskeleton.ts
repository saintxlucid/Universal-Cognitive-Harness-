import { NeuralEventBus, type EventType } from '../event-bus/neural-event-bus.js';
import { AetherCore, type AetherConfig, type AetherSubsystem } from '../aether/aether-core.js';
import { Consciousness } from '../aether/consciousness.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { TraceRecorder } from '../cognitive-plane/trace-engine/trace-recorder.js';
import { CognitiveReplay } from '../cognitive-plane/replay/cognitive-replay.js';
import { TracePersistence } from '../cognitive-plane/persistence/trace-persistence.js';
import { SignalStore } from '../cognitive-plane/signals/signal-store.js';
import { Auth } from '../control-plane/auth/auth.js';
import { SecretsStore } from '../control-plane/secrets/secrets-store.js';
import { PolicyEngine } from '../control-plane/policies.js';
import { BudgetTracker } from '../control-plane/budgets/budgets.js';
import { OTLPExporter } from '../control-plane/telemetry/otlp-exporter.js';
import { Lifecycle } from '../control-plane/lifecycle.js';
import { PluginLoader } from '../control-plane/plugins/plugin-loader.js';
import { FileSystemDriver } from '../drivers/filesystem/filesystem-driver.js';
import { GitDriver } from '../drivers/git/git-driver.js';
import { CodeScorer } from '../suit/litmus/code-scorer.js';
import { ReflexEngine } from '../suit/instinct/reflex-engine.js';
import { ImmuneSystem } from './immune.js';
import { EndocrineSystem } from './endocrine.js';
import { SleepCycle } from '../sleep_cycle/cycle.js';
import { ActionSelector } from '../basal_ganglia/action-selector.js';
import { Connectome } from '../connectome/wiring.js';
import { Hippocampus } from '../hippocampus/consolidator.js';
import { Neocortex } from '../neocortex/pattern-learner.js';
import { CortexKernel } from '../cortex_kernel/integrator.js';
import { NervousSystem } from '../nervous-system/nervous-system.js';
import { createSignal } from '../nervous-system/signal.js';
import type { Signal } from '../nervous-system/signal.js';
import { Metabolism } from '../metabolism/metabolism.js';

export interface ExoskeletonConfig {
  workspaceId: string;
  workspaceName: string;
  workspaceRoot: string;
  traceFile?: string;
  apiKey?: string;
  aetherConfig?: Partial<AetherConfig>;
}

export interface ExoskeletonState {
  running: boolean;
  startedAt: Date | null;
  aetherPhase: string;
  connectedAgents: number;
  consciousness: ReturnType<Consciousness['getState']>;
  subsystems: string[];
}

export interface ExoskeletonTransport {
  name: string;
  attach(exoskeleton: CognitiveExoskeleton): void;
  detach(): void;
  status(): Record<string, unknown>;
}

export class CognitiveExoskeleton {
  readonly eventBus: NeuralEventBus;
  readonly nervousSystem: NervousSystem;
  readonly metabolism: Metabolism;
  readonly aether: AetherCore;
  readonly consciousness: Consciousness;
  readonly kernel: CognitiveKernel;
  readonly workspace: WorkspaceBrain;
  readonly executive: ExecutiveBrain;
  readonly traceRecorder: TraceRecorder;
  readonly replay: CognitiveReplay;
  readonly signals: SignalStore;
  readonly auth: Auth;
  readonly secrets: SecretsStore;
  readonly policies: PolicyEngine;
  readonly budgets: BudgetTracker;
  readonly otlp: OTLPExporter;
  readonly persistence: TracePersistence;
  readonly lifecycle: Lifecycle;
  readonly plugins: PluginLoader;
  readonly codeScorer: CodeScorer;
  readonly reflexEngine: ReflexEngine;
  readonly immuneSystem: ImmuneSystem;
  readonly endocrineSystem: EndocrineSystem;
  readonly sleepCycle: SleepCycle;
  readonly actionSelector: ActionSelector;
  readonly connectome: Connectome;
  readonly hippocampus: Hippocampus;
  readonly neocortex: Neocortex;
  readonly cortexKernel: CortexKernel;
  readonly fsDriver: FileSystemDriver;
  readonly gitDriver: GitDriver;

  private config: Required<ExoskeletonConfig>;
  private transports: Map<string, ExoskeletonTransport> = new Map();

  constructor(config: ExoskeletonConfig) {
    this.config = {
      workspaceId: config.workspaceId,
      workspaceName: config.workspaceName,
      workspaceRoot: config.workspaceRoot,
      traceFile: config.traceFile ?? '.uccp/traces.jsonl',
      apiKey: config.apiKey ?? 'dev-key',
      aetherConfig: config.aetherConfig ?? {},
    };

    this.eventBus = new NeuralEventBus();
    this.nervousSystem = new NervousSystem({ trackEnergy: true });
    this.metabolism = new Metabolism();
    this.consciousness = new Consciousness();
    this.aether = new AetherCore(this.eventBus, {
      tickIntervalMs: 5000,
      ...this.config.aetherConfig,
    });
    this.kernel = new CognitiveKernel({
      agent_id: 'exoskeleton',
      user_id: 'system',
      project_id: this.config.workspaceId,
    });
    this.workspace = new WorkspaceBrain({
      workspace_id: this.config.workspaceId,
      name: this.config.workspaceName,
      root_path: this.config.workspaceRoot,
      eventBus: this.eventBus,
    });
    this.executive = new ExecutiveBrain({ eventBus: this.eventBus });

    this.traceRecorder = new TraceRecorder(this.eventBus);
    this.replay = new CognitiveReplay(this.traceRecorder.ledger);
    this.signals = new SignalStore(this.traceRecorder.ledger);
    this.auth = new Auth();
    this.secrets = new SecretsStore();
    this.policies = new PolicyEngine();
    this.budgets = new BudgetTracker();
    this.otlp = new OTLPExporter(this.traceRecorder.ledger);
    this.persistence = new TracePersistence(this.config.traceFile);
    this.lifecycle = new Lifecycle();
    this.plugins = new PluginLoader();
    this.codeScorer = new CodeScorer();
    this.reflexEngine = new ReflexEngine();
    this.fsDriver = new FileSystemDriver(this.eventBus, {
      rootPath: this.config.workspaceRoot,
    });
    this.gitDriver = new GitDriver(this.eventBus, {
      repoPath: this.config.workspaceRoot,
    });

    this.immuneSystem = new ImmuneSystem(this.policies, this.auth, this.reflexEngine);
    this.endocrineSystem = new EndocrineSystem(this.nervousSystem, this.consciousness);
    this.sleepCycle = new SleepCycle(this.nervousSystem, this.aether);
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

    this.registerCoreServices();
    this.setupPolicies();
    this.wireNervousSystem();
    this.wireConnectome();
  }

  private registerCoreServices(): void {
    this.lifecycle.register({
      name: 'trace-persistence',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        this.persistence.open();
        await this.persistence.loadInto(this.traceRecorder.ledger);
      },
      stop: async () => {
        this.persistence.close();
      },
    });
    this.lifecycle.register({
      name: 'otlp-exporter',
      version: '0.1.0',
      dependencies: ['trace-persistence'],
      start: async () => {
        this.otlp.start();
      },
      stop: async () => {
        this.otlp.stop();
      },
    });
    this.lifecycle.register({
      name: 'plugins',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        await this.plugins.loadAll();
        await this.plugins.initializeAll();
      },
      stop: async () => {
        await this.plugins.shutdownAll();
      },
    });
    this.lifecycle.register({
      name: 'filesystem-driver',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        this.fsDriver.start();
      },
      stop: async () => {
        this.fsDriver.stop();
      },
    });
    this.lifecycle.register({
      name: 'aether',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        this.aether.start();
      },
      stop: async () => {
        this.aether.stop();
      },
    });

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

  private setupPolicies(): void {
    this.policies.addRule({
      id: 'allow-all',
      effect: 'allow',
      principals: ['*'],
      actions: ['*'],
      resources: ['*'],
      priority: 1,
    });
    this.policies.addRule({
      id: 'admin-only-secrets',
      effect: 'deny',
      principals: ['*'],
      actions: ['secrets:read'],
      resources: ['*'],
      priority: 10,
    });
    this.policies.addRule({
      id: 'admin-secrets-access',
      effect: 'allow',
      principals: ['admin'],
      actions: ['secrets:read'],
      resources: ['*'],
      priority: 20,
    });

    this.auth.registerAgent('exoskeleton', 'system', 'Cognitive Exoskeleton', ['*']);
    this.auth.registerAgent('connected-agent', 'agent', 'Connected Agent', [
      'observe', 'remember', 'retrieve', 'plan', 'reflect', 'learn', 'critique',
    ]);
  }

  private wireNervousSystem(): void {
    this.nervousSystem.subscribe('cortex', async (signal) => {
      this.consciousness.observe('working', `Signal: ${signal.type}`, signal.source);
    }, undefined, 'consciousness-feed');
  }

  private wireConnectome(): void {
    this.connectome.registerConnection({
      from: 'eventBus',
      to: 'traceRecorder',
      type: 'event-driven',
      description: 'Events flow from bus to recorder',
    });
    this.connectome.registerConnection({
      from: 'traceRecorder',
      to: 'signals',
      type: 'data-flow',
      description: 'Trace ledger feeds signal detection',
    });
    this.connectome.registerConnection({
      from: 'eventBus',
      to: 'endocrine',
      type: 'event-driven',
      description: 'Events trigger neuromodulation updates',
    });
    this.connectome.registerConnection({
      from: 'aether',
      to: 'consciousness',
      type: 'control',
      description: 'Aether orchestrates consciousness layers',
    });
    this.connectome.registerConnection({
      from: 'fsDriver',
      to: 'eventBus',
      type: 'event-driven',
      description: 'Filesystem changes propagate as events',
    });
  }

  attachTransport(transport: ExoskeletonTransport): void {
    this.transports.set(transport.name, transport);
    transport.attach(this);
  }

  detachTransport(name: string): void {
    const transport = this.transports.get(name);
    if (transport) {
      transport.detach();
      this.transports.delete(name);
    }
  }

  getTransports(): string[] {
    return [...this.transports.keys()];
  }

  async start(): Promise<void> {
    await this.lifecycle.startAll();
    this.metabolism.start();

    const sig = createSignal('aether:started', 'exoskeleton', {
      workspaceId: this.config.workspaceId,
      startedAt: new Date().toISOString(),
    });
    await this.nervousSystem.emit(sig);

    this.nervousSystem.emitFromEvent(
      {
        id: '',
        type: 'session:started',
        timestamp: new Date(),
        source: 'exoskeleton',
        payload: { workspaceId: this.config.workspaceId },
      },
      'exoskeleton',
    );

    this.aether.observeThought('meta', 'Cognitive Exoskeleton fully booted', 'exoskeleton', [
      'startup',
    ]);
  }

  async stop(): Promise<void> {
    this.nervousSystem.emitFromEvent(
      {
        id: '',
        type: 'session:ended',
        timestamp: new Date(),
        source: 'exoskeleton',
        payload: { workspaceId: this.config.workspaceId },
      },
      'exoskeleton',
    );

    for (const [, transport] of this.transports) {
      transport.detach();
    }
    this.transports.clear();

    this.metabolism.stop();
    await this.lifecycle.stopAll();
  }

  getState(): ExoskeletonState {
    return {
      running: this.aether.getState().running,
      startedAt: this.aether.getState().startedAt,
      aetherPhase: this.aether.phase,
      connectedAgents: this.aether.getState().connectedAgents,
      consciousness: this.consciousness.getState(),
      subsystems: this.aether.getState().subsystems,
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
      transports: this.getTransports(),
      litmus: { threshold: this.codeScorer['config'].threshold },
      instinct: { reflexCount: this.reflexEngine.getReflexes().length },
    };
  }
}
