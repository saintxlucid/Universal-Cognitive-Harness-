import { type EventType } from '../event-bus/neural-event-bus.js';
import type { AetherCore, AetherConfig } from '../aether/aether-core.js';
import type { Consciousness } from '../aether/consciousness.js';
import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import type { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import type { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import type { TraceRecorder } from '../cognitive-plane/trace-engine/trace-recorder.js';
import type { CognitiveReplay } from '../cognitive-plane/replay/cognitive-replay.js';
import type { SignalStore } from '../cognitive-plane/signals/signal-store.js';
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
import type { ImmuneSystem } from '../cognitive-core/immune.js';
import type { EndocrineSystem } from '../cognitive-core/endocrine.js';
import type { SleepCycle } from '../sleep_cycle/cycle.js';
import type { ActionSelector } from '../basal_ganglia/action-selector.js';
import type { Connectome } from '../connectome/wiring.js';
import { EngineeringEnrichment } from '../engineering-intelligence/index.js';
import { FrameworkTraceRecorder, frameworkProblemTypeOf } from '../cognitive-plane/frameworks/tracing/trace-recorder.js';
import { createFrameworkRegistry } from '../cognitive-plane/frameworks/registry.js';
import { prosCons } from '../cognitive-plane/frameworks/decisions/decision-models.js';
import { rcaAnalyze } from '../cognitive-plane/frameworks/rca/rca.js';
import { planTasks } from '../cognitive-plane/frameworks/productivity/productivity-os.js';
import { detectGaps } from '../cognitive-plane/frameworks/research/methodology.js';
import { dikwTransform } from '../cognitive-plane/frameworks/knowledge/dikw.js';
import type { Hippocampus } from '../hippocampus/consolidator.js';
import type { Neocortex } from '../neocortex/pattern-learner.js';
import type { CortexKernel } from '../cortex_kernel/integrator.js';
import type { NervousSystem } from '../nervous-system/nervous-system.js';
import { createSignal } from '../nervous-system/signal.js';
import type { Metabolism } from '../metabolism/metabolism.js';
import type { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import type { TracePersistence } from '../cognitive-plane/persistence/trace-persistence.js';
import { CognitiveCore } from '../cognitive-core/cognitive-core.js';
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
  readonly core: CognitiveCore;
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
  readonly engineeringEnrichment: EngineeringEnrichment;
  readonly frameworkTracer: FrameworkTraceRecorder;
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

    // Control plane first — governance instances are injected INTO the core.
    this.auth = new Auth();
    this.secrets = new SecretsStore();
    this.policies = new PolicyEngine();
    this.budgets = new BudgetTracker();
    this.otlp = new OTLPExporter();
    this.lifecycle = new Lifecycle();
    this.plugins = new PluginLoader();

    // Suit intelligence.
    this.codeScorer = new CodeScorer();
    this.reflexEngine = new ReflexEngine();

    // The brain — owns every cognitive organ, the ledger, and the aether loop.
    this.core = new CognitiveCore({
      workspaceId: this.config.workspaceId,
      workspaceName: this.config.workspaceName,
      workspaceRoot: this.config.workspaceRoot,
      traceFile: this.config.traceFile,
      aetherConfig: this.config.aetherConfig,
      agentId: 'exoskeleton',
      policies: this.policies,
      auth: this.auth,
      reflexEngine: this.reflexEngine,
    });

    // Cognitive members — direct references into the core.
    this.eventBus = this.core.eventBus;
    this.nervousSystem = this.core.nervousSystem;
    this.metabolism = this.core.metabolism;
    this.aether = this.core.aether;
    this.consciousness = this.core.consciousness;
    this.kernel = this.core.kernel;
    this.workspace = this.core.workspace;
    this.executive = this.core.executive;
    this.traceRecorder = this.core.traceRecorder;
    this.replay = this.core.replay;
    this.signals = this.core.signals;
    this.persistence = this.core.persistence;
    this.immuneSystem = this.core.immuneSystem;
    this.endocrineSystem = this.core.endocrineSystem;
    this.sleepCycle = this.core.sleepCycle;
    this.actionSelector = this.core.actionSelector;
    this.connectome = this.core.connectome;
    this.hippocampus = this.core.hippocampus;
    this.neocortex = this.core.neocortex;
    this.cortexKernel = this.core.cortexKernel;

    // Suit-side cognitive companions.
    this.frameworkTracer = new FrameworkTraceRecorder(this.eventBus);
    this.engineeringEnrichment = new EngineeringEnrichment(this.eventBus);
    this.metabolism.registerComponent('engineering');

    // Embodiment — drivers attach to the core's event bus.
    this.fsDriver = new FileSystemDriver(this.eventBus, {
      rootPath: this.config.workspaceRoot,
    });
    this.gitDriver = new GitDriver(this.eventBus, {
      repoPath: this.config.workspaceRoot,
    });

    this.registerCoreServices();
    this.setupPolicies();
    this.wireFrameworkConnectome();

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
      // Framework routines (blueprint §5.3): the most common reasoning
      // requests resolve to the deterministic engines — no LLM, no catalog
      // traversal. Law 13 applied to thinking itself.
      {
        name: 'framework-decide',
        description: 'runs a deterministic decision engine (pros & cons or model selection) without the LLM',
        keywords: ['fw', 'framework', 'decide', 'decision', 'pros-cons', 'pros and cons'],
        execute: (input) => {
          const pros = parseList(input, 'pros');
          const cons = parseList(input, 'cons');
          if (pros.length > 0 || cons.length > 0) {
            const result = prosCons({ pros, cons });
            this.frameworkTracer.recordCompletion({
              engine: 'pros-cons', family: 'decisions', problem: input,
              profile: {}, result: result as unknown as Record<string, unknown>, verdict: result.verdict,
            });
            return JSON.stringify(result);
          }
          const registry = createFrameworkRegistry(this.frameworkTracer);
          const result = registry.select({ problem: input, ...parseProfile(input) });
          return JSON.stringify({
            selected: result.selected.id,
            name: result.selected.name,
            family: result.selected.family,
            rationale: result.rationale,
          });
        },
      },
      {
        name: 'framework-rca',
        description: 'runs the F.O.C.U.S. root-cause analysis engine without the LLM',
        keywords: ['rca', 'root-cause', 'root cause', 'fishbone', 'diagnose'],
        execute: (input) => {
          const result = rcaAnalyze({
            problem: input,
            evidence: parseList(input, 'fact').map((fact) => ({ fact, source: 'fast-path' })),
          });
          this.frameworkTracer.recordCompletion({
            engine: 'rca-focus', family: 'rca', problem: input,
            profile: { rootCauseNeeded: true }, result: result as unknown as Record<string, unknown>,
          });
          return JSON.stringify(result);
        },
      },
      {
        name: 'framework-plan',
        description: 'runs the Productivity OS planner without the LLM',
        keywords: ['plan', 'plan-day', 'plan day', 'mit', 'eisenhower'],
        execute: (input) => {
          const names = parseList(input, 'task');
          const tasks = names.length > 0 ? names.map((name) => ({ name })) : [{ name: input }];
          const result = planTasks({ tasks });
          const mit = result.mostImportantTasks.length > 0
            ? result.mostImportantTasks
            : tasks.slice(0, 3).map((t) => t.name);
          this.frameworkTracer.recordCompletion({
            engine: 'productivity-os', family: 'productivity', problem: input,
            profile: {}, result: result as unknown as Record<string, unknown>,
          });
          return JSON.stringify({ mit, frog: result.frog, quickTasks: result.quickTasks });
        },
      },
      {
        name: 'framework-gap',
        description: 'runs research gap analysis without the LLM',
        keywords: ['gap', 'research-gap', 'research gap', 'literature gap'],
        execute: (input) => {
          const result = detectGaps({
            topic: input,
            notes: parseList(input, 'note').map((finding, i) => ({ title: `note ${i + 1}`, finding })),
          });
          this.frameworkTracer.recordCompletion({
            engine: 'research-gap', family: 'research', problem: input,
            profile: {}, result: result as unknown as Record<string, unknown>,
          });
          return JSON.stringify(result.ranked);
        },
      },
      {
        name: 'framework-dikw',
        description: 'runs the DIKW transform without the LLM',
        keywords: ['dikw', 'transform', 'sense-making', 'sense making'],
        execute: (input) => {
          const result = dikwTransform({
            dataPoints: parseList(input, 'datum').map((value, i) => ({ value, attribute: `datum ${i + 1}` })),
          });
          this.frameworkTracer.recordCompletion({
            engine: 'dikw', family: 'knowledge', problem: input,
            profile: {}, result: result as unknown as Record<string, unknown>,
          });
          return JSON.stringify(result.wisdom);
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
      name: 'otlp-exporter',
      version: '0.1.0',
      dependencies: [],
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
      name: 'agentic-history',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        await this.history.open();
      },
      stop: async () => {},
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

  private wireFrameworkConnectome(): void {
    // Framework traces auto-wire the graph (blueprint §5.1): every
    // selection/completion links its problem-type node to the framework
    // node via the register-or-strengthen `connectome:link` path — the
    // harness learns which frameworks it actually uses for which problems.
    // The core's own wireConnectome handles the generic connectome:link
    // auto-wiring and boot seeds; this suit-side wiring feeds the graph
    // from the suit's framework tracer.
    this.eventBus.subscribe(
      ['framework:selected', 'framework:completed'] as EventType[],
      async (event) => {
        const payload = event.payload as {
          engine?: unknown;
          selected?: unknown;
          problemType?: unknown;
          profile?: Record<string, unknown>;
        };
        const engine =
          typeof payload.engine === 'string'
            ? payload.engine
            : typeof payload.selected === 'string'
              ? payload.selected
              : null;
        if (!engine) return;
        const problemType =
          typeof payload.problemType === 'string'
            ? payload.problemType
            : frameworkProblemTypeOf(payload.profile ?? {});
        await this.nervousSystem.emit(
          createSignal('connectome:link', 'framework-tracing', {
            from: `problem-type:${problemType}`,
            to: `framework:${engine}`,
            type: 'reference',
            description: `framework '${engine}' applied to ${problemType} problem`,
          }),
        );
      },
      undefined,
      'framework-connectome-wiring',
    );
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
    await this.core.start();
    await this.lifecycle.startAll();

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

    await this.lifecycle.stopAll();
    await this.core.stop();
  }

  getState(): ExoskeletonState {
    const state = this.core.getState();
    return {
      running: state.running,
      startedAt: state.startedAt,
      aetherPhase: state.aetherPhase,
      connectedAgents: state.connectedAgents,
      consciousness: state.consciousness,
      subsystems: state.subsystems,
    };
  }

  getStats(): Record<string, unknown> {
    return {
      ...this.core.getStats(),
      transports: this.getTransports(),
      litmus: { threshold: this.codeScorer['config'].threshold },
      instinct: { reflexCount: this.reflexEngine.getReflexes().length },
      frameworks: this.frameworkTracer.getStats(),
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
        roots: [this.config.workspaceRoot],
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

/* ── Fast-path framework routine helpers ────────────────────────────── */

/** Extract `key: item1, item2` lists from a free-text routine input. */
function parseList(input: string, key: string): string[] {
  const pattern = new RegExp(`\\b${key}\\s*:\\s*([^\\n]+)`, 'i');
  const match = input.match(pattern);
  if (!match?.[1]) return [];
  return match[1]
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Parse `key=value` profile flags (data, time, risk, complexity, stakeholders) from routine input. */
function parseProfile(input: string): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  const map: Record<string, string> = {
    data: 'dataAvailability',
    time: 'timePressure',
    risk: 'risk',
    complexity: 'complexity',
    stakeholders: 'stakeholderInvolvement',
  };
  for (const [alias, field] of Object.entries(map)) {
    const match = input.match(new RegExp(`\\b${alias}\\s*=\\s*(\\d(?:\\.\\d+)?)`, 'i'));
    if (match?.[1]) {
      const value = Number.parseFloat(match[1]);
      if (Number.isFinite(value)) out[field] = value;
    }
  }
  for (const flag of ['root-cause', 'human-centered', 'continuous-improvement', 'speed']) {
    if (new RegExp(`\\b${flag}\\b`, 'i').test(input)) {
      out[flag === 'root-cause' ? 'rootCauseNeeded' : flag === 'human-centered' ? 'humanCentered' : flag === 'continuous-improvement' ? 'continuousImprovement' : 'speedAdaptability'] = true;
    }
  }
  return out;
}
