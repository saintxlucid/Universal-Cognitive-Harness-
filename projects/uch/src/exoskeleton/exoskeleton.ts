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
import { FastPathRouter, type RoutineHandler } from '../agentic/fastpath/fast-path-router.js';
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
import { getTools } from '../agentic/tools/registry.js';
import type { Tool } from '../agentic/tools/types.js';
import { QueryEngine, type QueryEngineConfig } from '../agentic/query/engine.js';
import { LLMClientAdapter, type ModelCaller } from '../agentic/model/caller.js';
import { createPermissionRuleSet, type PermissionRuleSet, type PermissionMode } from '../agentic/permissions/permissions.js';
import { HistoryManager } from '../agentic/history/history.js';
import { LLMClient } from '../llm/provider.js';
import { MEMORY_EXTRACTION_HOOK, DREAM_TRIGGER_HOOK, type StopHook } from '../agentic/query/stop-hooks.js';

export interface ExoskeletonConfig {
  workspaceId: string;
  workspaceName: string;
  workspaceRoot: string;
  traceFile?: string;
  apiKey?: string;
  aetherConfig?: Partial<AetherConfig>;
  llm?: LLMClient;
  model?: string;
  permissionMode?: PermissionMode;
  permissionRules?: PermissionRuleSet;
  agenticTools?: Tool[];
  historyFile?: string;
  stopHooks?: StopHook[];
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
  readonly fastPath: FastPathRouter;
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
  readonly agenticTools: Tool[];
  readonly agenticModel: ModelCaller | null;
  readonly history: HistoryManager;
  readonly agenticStopHooks: StopHook[];
  readonly permissionMode: PermissionMode;
  readonly permissionRules: PermissionRuleSet;

  private config: ExoskeletonConfig & {
    traceFile: string;
    apiKey: string;
    historyFile: string;
    permissionMode: PermissionMode;
  };
  private transports: Map<string, ExoskeletonTransport> = new Map();

  constructor(config: ExoskeletonConfig) {
    this.config = {
      workspaceId: config.workspaceId,
      workspaceName: config.workspaceName,
      workspaceRoot: config.workspaceRoot,
      traceFile: config.traceFile ?? '.uccp/traces.jsonl',
      apiKey: config.apiKey ?? 'dev-key',
      aetherConfig: config.aetherConfig ?? {},
      llm: config.llm,
      model: config.model,
      permissionMode: config.permissionMode ?? 'default',
      permissionRules: config.permissionRules,
      agenticTools: config.agenticTools,
      historyFile: config.historyFile ?? '.uccp/history.jsonl',
      stopHooks: config.stopHooks,
    };

    this.agenticTools = config.agenticTools ?? getTools('reasoning');
    this.permissionMode = config.permissionMode ?? 'default';
    this.permissionRules = config.permissionRules ?? createPermissionRuleSet();
    this.history = new HistoryManager(config.historyFile ?? '.uccp/history.jsonl');
    this.agenticStopHooks = config.stopHooks ?? [MEMORY_EXTRACTION_HOOK, DREAM_TRIGGER_HOOK];

    const llm = config.llm ?? new LLMClient(config.apiKey ? { apiKey: config.apiKey } : undefined);
    this.agenticModel = llm.isAvailable
      ? new LLMClientAdapter(llm, { model: config.model })
      : null;
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
    this.otlp = new OTLPExporter();
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

    this.registerCoreServices();
    this.setupPolicies();
    this.wireNervousSystem();
    this.wireConnectome();

    this.fastPath = this.buildFastPathRouter();
  }

  private buildFastPathRouter(): FastPathRouter {
    const router = new FastPathRouter();
    const state = (): string => {
      const s = this.getState();
      return `running=${s.running} phase=${s.aetherPhase} agents=${s.connectedAgents} subsystems=${s.subsystems.length}`;
    };
    const routines: RoutineHandler[] = [
      {
        name: 'status-routine',
        description: 'reports runtime status without invoking the LLM',
        keywords: ['status', 'state', 'phase'],
        execute: () => state(),
      },
      {
        name: 'health-routine',
        description: 'reports health metrics without invoking the LLM',
        keywords: ['health', 'healthy', 'doctor'],
        execute: () => {
          const stats = this.getStats();
          const sleep = stats.sleep as { phase?: string } | undefined;
          const instinct = stats.instinct as { reflexCount?: number } | undefined;
          return `sleep=${sleep?.phase ?? 'unknown'} connectome=${stats.connectome} reflexes=${instinct?.reflexCount ?? 0}`;
        },
      },
      {
        name: 'memory-routine',
        description: 'reports memory size without invoking the LLM',
        keywords: ['memory', 'episodes', 'episodic'],
        execute: () => {
          const k = this.kernel.getStats();
          return `episodes=${k.episodes}`;
        },
      },
    ];
    for (const routine of routines) {
      router.register(routine);
    }
    return router;
  }

  resolveFastPath(input: string) {
    return this.fastPath.resolve(input);
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
    this.lifecycle.register({
      name: 'agentic-history',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        await this.history.open();
      },
      stop: async () => {},
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
    // Auto-wiring: the Connectome learns the substrate's shape from
    // `connectome:link` signals rather than hand-registration (CONNECTOME §4.3).
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

    // Seed wiring emitted as events — boot organ registration drives the graph.
    const seeds: Array<{ from: string; to: string; type: ConnectionType; description: string }> = [
      { from: 'eventBus', to: 'traceRecorder', type: 'event-driven', description: 'Events flow from bus to recorder' },
      { from: 'traceRecorder', to: 'signals', type: 'data-flow', description: 'Trace ledger feeds signal detection' },
      { from: 'eventBus', to: 'endocrine', type: 'event-driven', description: 'Events trigger neuromodulation updates' },
      { from: 'aether', to: 'consciousness', type: 'control', description: 'Aether orchestrates consciousness layers' },
      { from: 'fsDriver', to: 'eventBus', type: 'event-driven', description: 'Filesystem changes propagate as events' },
    ];
    for (const seed of seeds) {
      void this.nervousSystem.emit(
        createSignal('connectome:link', 'exoskeleton', seed),
      );
    }
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
      reflex: {
        ...this.fastPath.getStats(),
        routines: this.fastPath.listRoutines(),
      },
      agentic: {
        model: this.agenticModel?.modelName ?? null,
        tools: this.agenticTools.length,
        historyEntries: this.history.getEntries().length,
        permissionMode: this.permissionMode,
      },
    };
  }

  getMemoryAdapter() {
    const kernel = this.kernel;
    return {
      remember: async (content: string, importance: number) =>
        kernel.remember({
          content: { type: 'text', text: content },
          provenance: { source: 'agentic', reliability: Math.max(0.3, Math.min(1, importance)) },
        }),
      recall: async (query: string) =>
        kernel.recallCompressed({ text: query }).text,
    };
  }
  createEngine(overrides?: Partial<QueryEngineConfig>): QueryEngine | null {
    if (!this.agenticModel) return null;
    const sessionId = `${this.config.workspaceId}-${Date.now()}`;
    const memory = this.getMemoryAdapter();
    const systemPrompt =
      overrides?.systemPrompt ??
      `You are the cognitive agent for workspace "${this.config.workspaceName}".`;
    return new QueryEngine({
      cwd: this.config.workspaceRoot,
      tools: this.agenticTools,
      model: this.agenticModel,
      systemPrompt,
      permissionMode: this.permissionMode,
      permissionRules: this.permissionRules,
      headless: overrides?.headless ?? true,
      abortController: overrides?.abortController,
      toolContext: {
        cwd: this.config.workspaceRoot,
        abortController: overrides?.abortController ?? new AbortController(),
        getSessionId: () => sessionId,
        memory,
      },
      stopHooks: this.agenticStopHooks,
      extractMemories: async (text: string) => {
        const chunks = text.split('\n').filter((line) => line.trim().length > 20).slice(0, 5);
        for (const chunk of chunks) {
          await memory.remember(chunk, 0.6);
        }
        return chunks.length;
      },
      triggerDream: async () => {
        await this.sleepCycle.deepSleep();
        return true;
      },
      ...overrides,
    });
  }

  async runAgentic(
    prompt: string,
    options?: { maxTurns?: number; onMessage?: (m: import('../agentic/types.js').Message) => void },
  ): Promise<{ text: string; toolCalls: number; terminal: import('../agentic/types.js').Terminal }> {
    const engine = this.createEngine({ maxTurns: options?.maxTurns });
    if (!engine) {
      throw new Error('No LLM configured — set OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }
    const texts: string[] = [];
    let toolCalls = 0;
    for await (const event of engine.submitMessage(prompt)) {
      if (event.type === 'message' && event.message) {
        options?.onMessage?.(event.message);
        for (const block of event.message.content) {
          if (block.type === 'text') texts.push(block.text);
          if (block.type === 'tool_use') toolCalls += 1;
        }
      }
    }
    const terminal = engine.getTerminal() ?? {
      state: 'success' as const,
      message: 'Completed',
      turnCount: 0,
      usage: engine.usage,
    };
    return { text: texts.join('\n').trim(), toolCalls, terminal };
  }
}
