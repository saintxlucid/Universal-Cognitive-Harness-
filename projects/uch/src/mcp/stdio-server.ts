import * as readline from 'node:readline';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { LLMClient } from '../llm/provider.js';
import { Embedder } from '../embeddings/embedder.js';
import { SessionManager } from '../session/manager.js';
import { GitIngester } from '../git/ingester.js';
import { ScientificMemory } from '../cognitive-plane/memory/scientific-memory.js';
import { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';
import { InferenceFabric, ACCELERATORS, CognitiveScheduler } from '../accelerators/index.js';
import type { Accelerator, AcceleratorKind, CognitiveProfile } from '../accelerators/index.js';
import { CodingPrinciplesEngine } from '../kernel/constitution/coding-principles.js';
import { OrganicScoreEngine } from '../kernel/constitution/organic-score.js';
import {
  autoTarget,
  coerceFindings,
  createEngineeringJudgment,
} from '../engineering-intelligence/index.js';
import type { EngineeringFinding, EngineeringReview } from '../engineering-intelligence/types.js';
import { GapAnalysisEngine, type GapAnalysisResultItem } from '../kernel/retrieval/gap-analysis.js';
import { ProgressiveMemorySearch } from '../memory/progressive-search.js';
import { CPServer, createDefaultCPServer, createCPTools } from '../protocol/index.js';
import { createFrameworkRegistry } from '../cognitive-plane/frameworks/registry.js';
import {
  decisionMatrix,
  costBenefit,
  paretoAnalysis,
  decisionTree,
  swotAnalysis,
  premortem,
  prosCons,
} from '../cognitive-plane/frameworks/decisions/decision-models.js';
import { FRAMEWORK_CATALOG_VERSION } from '../cognitive-plane/frameworks/registry.js';
import { rcaAnalyze } from '../cognitive-plane/frameworks/rca/rca.js';
import { strategyWheel, strategyVsPlan } from '../cognitive-plane/frameworks/strategy/strategy-wheel.js';
import { planTasks } from '../cognitive-plane/frameworks/productivity/productivity-os.js';
import { validateMethodology, detectGaps } from '../cognitive-plane/frameworks/research/methodology.js';
import { assessInformation } from '../cognitive-plane/frameworks/critical/critical-evaluator.js';
import { dikwTransform } from '../cognitive-plane/frameworks/knowledge/dikw.js';
import { fuseSignals } from '../cognitive-plane/frameworks/signals/signal-fusion.js';
import { auditCodePrinciples } from '../cognitive-plane/frameworks/code/code-principles.js';
import { ideal, fiveWhys, ooda, kepnerTregoe, pdcaPlan } from '../cognitive-plane/frameworks/problems/problem-solver.js';
import { FrameworkTraceRecorder } from '../cognitive-plane/frameworks/tracing/trace-recorder.js';
import { FrameworkDecisionJournal } from '../cognitive-plane/frameworks/journal/decision-journal.js';
import { FrameworkComposer } from '../cognitive-plane/frameworks/composer/composer.js';
import {
  PackageGate,
  PackageStore,
  defaultGrantedCapabilities,
  validatePackageManifest,
} from '../control-plane/packages/index.js';
import { UCH_RUNTIME_VERSION } from '../workspace-manifest/attach.js';

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export class MCPStdioServer {
  private kernel: CognitiveKernel;
  private bio: BiologicalFunctions;
  private executive: ExecutiveBrain;
  private workspace: WorkspaceBrain;
  private llm: LLMClient;
  private embedder: Embedder;
  private sessionManager: SessionManager;
  private gitIngester: GitIngester;
  private scientificMemory: ScientificMemory;
  private constitution: CognitiveConstitution;
  private fabric: InferenceFabric;
  private scheduler: CognitiveScheduler;
  private protocol: CPServer;
  private tools: Map<string, Tool> = new Map();
  private initialized = false;
  private rl: readline.Interface | null = null;
  private frameworkTracer: FrameworkTraceRecorder;
  private frameworkJournal: FrameworkDecisionJournal;
  private packageStore: PackageStore | null = null;
  private packageStorePath?: string;

  constructor(config: {
    kernel: CognitiveKernel;
    bio: BiologicalFunctions;
    executive: ExecutiveBrain;
    workspace: WorkspaceBrain;
    llm?: LLMClient;
    embedder?: Embedder;
    sessionManager?: SessionManager;
    gitIngester?: GitIngester;
    scientificMemory?: ScientificMemory;
    constitution?: CognitiveConstitution;
    protocol?: CPServer;
    frameworkTracer?: FrameworkTraceRecorder;
    frameworkJournal?: FrameworkDecisionJournal;
    /** Where package installs persist; omit for in-memory (session-scoped) package state. */
    packageStorePath?: string;
  }) {
    this.kernel = config.kernel;
    this.bio = config.bio;
    this.executive = config.executive;
    this.workspace = config.workspace;
    this.llm = config.llm ?? new LLMClient();
    this.embedder = config.embedder ?? new Embedder({ provider: this.llm });
    this.sessionManager = config.sessionManager ?? new SessionManager({ kernel: this.kernel });
    this.gitIngester = config.gitIngester ?? new GitIngester({ kernel: this.kernel, llm: this.llm });
    this.scientificMemory = config.scientificMemory ?? new ScientificMemory();
    this.constitution = config.constitution ?? new CognitiveConstitution();
    this.fabric = new InferenceFabric(true);
    this.scheduler = new CognitiveScheduler(this.fabric);
    this.protocol = config.protocol ?? createDefaultCPServer(this.kernel);
    this.frameworkTracer = config.frameworkTracer ?? new FrameworkTraceRecorder();
    this.frameworkJournal = config.frameworkJournal ?? new FrameworkDecisionJournal();
    this.packageStorePath = config.packageStorePath;
    this.registerTools();
  }

  /** Lazy, load-once access to the package store (in-memory unless a path is configured). */
  private async getPackageStore(): Promise<PackageStore> {
    if (this.packageStore) return this.packageStore;
    const store = new PackageStore();
    if (this.packageStorePath) {
      await store.load(this.packageStorePath);
    }
    this.packageStore = store;
    return store;
  }

  private async persistPackageStore(store: PackageStore): Promise<void> {
    if (this.packageStorePath) {
      await store.persist(this.packageStorePath);
    }
  }

  /**
   * Framework trace helpers — record completion/error traces for every
   * framework tool invocation so usage stats and the decision journal
   * (blueprint §5.1, §5.4) see the actual engine activity.
   */
  private completed(
    args: Record<string, unknown>,
    result: unknown,
    engine: string,
    family: string,
    verdict?: string | null,
  ): unknown {
    const problem = String(args.problem ?? args.target ?? args.topic ?? args.question ?? '');
    const profile = this.profileFromArgs(args);
    this.frameworkTracer.recordCompletion({
      engine,
      family,
      problem,
      profile,
      result: (result ?? {}) as Record<string, unknown>,
      verdict,
    });
    this.frameworkJournal.record({
      engine,
      family,
      problem,
      profile,
      verdict: verdict ?? null,
      mode: 'deterministic',
    });
    return result;
  }

  private failed(args: Record<string, unknown>, result: unknown, engine: string, family: string): unknown {
    const message =
      typeof result === 'object' && result !== null
        ? String((result as { error?: string }).error ?? 'unknown error')
        : 'unknown error';
    this.frameworkTracer.recordError({
      engine,
      family,
      problem: String(args.problem ?? args.target ?? args.topic ?? args.question ?? ''),
      message,
    });
    return result;
  }

  private profileFromArgs(args: Record<string, unknown>): Record<string, unknown> {
    const profile: Record<string, unknown> = {};
    for (const key of [
      'dataAvailability', 'timePressure', 'stakeholderInvolvement', 'risk',
      'complexity', 'rootCauseNeeded', 'humanCentered', 'continuousImprovement',
      'speedAdaptability',
    ]) {
      if (args[key] !== undefined) profile[key] = args[key];
    }
    return profile;
  }

  private registerTools(): void {
    this.registerTool('observe', 'Record an observation into cognitive memory', {
      type: 'object', properties: { text: { type: 'string', description: 'Observation text' }, source: { type: 'string', description: 'Source identifier' } }, required: ['text'],
    }, async (args) => this.bio.observe({ text: args.text as string, source: args.source as string | undefined }));

    this.registerTool('remember', 'Store content in episodic memory', {
      type: 'object', properties: { content: { type: 'string', description: 'Content to remember' }, importance: { type: 'number', description: 'Importance 0-1' } }, required: ['content'],
    }, async (args) => this.bio.remember({ content: args.content as string, importance: args.importance as number | undefined }));

    this.registerTool('recall', 'Search cognitive memory for relevant information', {
      type: 'object', properties: { query: { type: 'string', description: 'Search query' }, topK: { type: 'number', description: 'Max results' } }, required: ['query'],
    }, async (args) => {
      const query = args.query as string;
      const topK = (args.topK as number) ?? 5;

      const episodes = this.kernel.getRecentEpisodes(50);
      const items = episodes.map((e) => ({
        id: e.id,
        text: typeof e.content === 'object' && e.content !== null ? JSON.stringify(e.content) : String(e.content),
      }));

      if (this.embedder.available) {
        const results = await this.embedder.search(query, items, topK);
        return {
          results: results.map((r) => ({ id: r.id, score: r.score, content: (r.item as { text: string }).text })),
          method: 'semantic',
        };
      }

      const formatted = this.kernel.recallFormatted({ text: query });
      return { results: formatted, count: episodes.length, method: 'keyword' };
    });

    this.registerTool('session-save', 'Save current session state for later resumption', {
      type: 'object', properties: { name: { type: 'string', description: 'Session name (optional)' }, memories: { type: 'array', description: 'Key memories to persist', items: { type: 'object' } } },
    }, async (args) => {
      const name = args.name as string | undefined;
      const memories = args.memories as Array<{ key?: string; value: string; type: string; importance?: number }> | undefined;
      if (memories) {
        for (const m of memories) {
          this.sessionManager.addMemory({
            key: m.key,
            value: m.value,
            type: m.type as 'decision' | 'fact' | 'observation' | 'task' | 'convention',
            importance: m.importance ?? 0.5,
          });
        }
      }
      const path = await this.sessionManager.saveSession(name);
      return { path, sessionId: this.sessionManager.getSession()?.id };
    });

    this.registerTool('session-load', 'Load a previously saved session', {
      type: 'object', properties: { session: { type: 'string', description: 'Session name or ID to load' } }, required: ['session'],
    }, async (args) => {
      const session = await this.sessionManager.loadSession(args.session as string);
      if (!session) return { error: `Session not found: ${args.session}` };
      return {
        id: session.id,
        toolName: session.toolName,
        timestamp: session.timestamp,
        memories: session.memories,
        context: session.context,
        conversationCount: session.conversation.length,
      };
    });

    this.registerTool('session-list', 'List all saved sessions', {
      type: 'object', properties: {},
    }, async () => {
      const sessions = this.sessionManager.listSessions();
      return { sessions: sessions.slice(0, 20) };
    });

    this.registerTool('session-handoff', 'Export session as handoff document for another AI tool', {
      type: 'object', properties: { session: { type: 'string', description: 'Session name or ID' } },
    }, async (args) => {
      if (args.session) await this.sessionManager.loadSession(args.session as string);
      const handoff = this.sessionManager.exportSessionHandoff();
      return { handoff };
    });

    this.registerTool('git-ingest', 'Ingest recent git commits into memory', {
      type: 'object', properties: { count: { type: 'number', description: 'Number of commits to ingest' } },
    }, async (args) => {
      const result = await this.gitIngester.ingestRecent(args.count as number | undefined);
      return result;
    });

    this.registerTool('plan', 'Create a plan to achieve a goal', {
      type: 'object', properties: { goal: { type: 'string', description: 'The goal to plan for' } }, required: ['goal'],
    }, async (args) => this.bio.plan(args.goal as string));

    this.registerTool('reflect', 'Reflect on current cognitive state', {
      type: 'object', properties: {},
    }, async () => this.bio.reflect());

    this.registerTool('learn', 'Learn from a proposition with supporting evidence', {
      type: 'object', properties: { proposition: { type: 'string', description: 'Proposition to evaluate' }, evidence: { type: 'string', description: 'Supporting evidence' } }, required: ['proposition', 'evidence'],
    }, async (args) => this.bio.learn(args.proposition as string, args.evidence as string));

    this.registerTool('critique', 'Critically evaluate a target', {
      type: 'object', properties: { target: { type: 'string', description: 'The target to critique' } }, required: ['target'],
    }, async (args) => this.bio.critique(args.target as string));

    this.registerTool('status', 'Get UCH system status', {
      type: 'object', properties: {},
    }, async () => {
      const stats = this.kernel.getStats();
      return {
        ...stats,
        llmAvailable: this.llm.isAvailable,
        embedderAvailable: this.embedder.available,
        embedderMode: this.embedder.useLocalFallback ? 'local-fallback' : 'api',
        sessions: this.sessionManager.listSessions().length,
        episodeCount: this.kernel.getRecentEpisodes().length,
      };
    });

    this.registerTool('sm-store', 'Store a fact in scientific memory with evidence tracking', {
      type: 'object', properties: { key: { type: 'string', description: 'Fact key' }, value: { type: 'string', description: 'Fact value' }, source: { type: 'string', description: 'Source' }, tags: { type: 'array', items: { type: 'string' }, description: 'Tags' } }, required: ['key', 'value', 'source'],
    }, async (args) => {
      const entry = this.scientificMemory.store({
        key: args.key as string,
        value: args.value as string,
        source: args.source as string,
        tags: args.tags as string[] | undefined,
      });
      return { id: entry.id, certainty: entry.certainty, confidence: entry.confidence };
    });

    this.registerTool('sm-recall', 'Retrieve facts from scientific memory', {
      type: 'object', properties: { key: { type: 'string', description: 'Fact key to look up' }, tag: { type: 'string', description: 'Filter by tag' } },
    }, async (args) => {
      const key = args.key as string | undefined;
      const tag = args.tag as string | undefined;

      if (key) {
        const entry = this.scientificMemory.getByKey(key);
        if (!entry) return { found: false };
        return { found: true, entry };
      }
      if (tag) {
        const all = this.scientificMemory.getAll(200);
        const entries = all.filter((e) => e.tags.includes(tag));
        return { found: entries.length > 0, entries: entries.slice(0, 20), count: entries.length };
      }
      const all = this.scientificMemory.getAll();
      return { entries: all.slice(0, 20), count: all.length };
    });

    this.registerTool('sm-facts', 'List all stored scientific facts', {
      type: 'object', properties: {},
    }, async () => {
      const entries = this.scientificMemory.getAll();
      return { count: entries.length, entries: entries.slice(0, 50).map((e) => ({ key: e.key, certainty: e.certainty, confidence: e.confidence, tags: e.tags })) };
    });

    this.registerTool('constitution-check', 'Check cognitive constitution compliance', {
      type: 'object', properties: { subject: { type: 'string', description: 'Subject to check' } },
    }, async (args) => {
      const violations = await this.constitution.checkCompliance(args.subject as string ?? 'check', {});
      return { compliant: violations.length === 0, violations };
    });

    this.registerTool('summarize', 'Summarize text (compression accelerator)', {
      type: 'object', properties: { text: { type: 'string', description: 'Text to summarize' }, maxWords: { type: 'number', description: 'Max words' } }, required: ['text'],
    }, async (args) => {
      const result = await this.fabric.dispatch(
        ACCELERATORS.compression,
        { text: args.text as string, maxWords: (args.maxWords as number) ?? 100 },
        { maxTokens: (args.maxWords as number) ?? 100, priority: 1 },
      );
      return { summary: result.output.summary, fired: result.fired, provider: result.provider };
    });

    this.registerTool('extract-concepts', 'Extract key concepts from text (semantic accelerator)', {
      type: 'object', properties: { text: { type: 'string', description: 'Text to analyze' } }, required: ['text'],
    }, async (args) => {
      const result = await this.fabric.dispatch(
        ACCELERATORS.semantic,
        { text: args.text as string },
        { maxTokens: 300, priority: 1 },
      );
      return { concepts: [...result.output.entities, ...result.output.topics], fired: result.fired, provider: result.provider };
    });

    this.registerTool('schedule', 'Dispatch an accelerator under a cognitive profile (cognitive scheduler decides the execution strategy)', {
      type: 'object', properties: {
        kind: { type: 'string', description: 'Accelerator kind: semantic, compression, reasoning, prediction, memory, ontology, classification' },
        input: { type: 'object', description: 'Accelerator input (e.g. { text: "..." } or { memories: [...] })' },
        complexity: { type: 'number', description: 'Task complexity 0-1' },
        reasoningNeeded: { type: 'number', description: 'Deep reasoning required 0-1' },
        verificationNeeded: { type: 'number', description: 'Independent verification required 0-1' },
        creativityNeeded: { type: 'number', description: 'Divergent generation required 0-1' },
        risk: { type: 'number', description: 'Consequence severity 0-1; >= 0.8 forces human approval' },
      }, required: ['kind', 'input'],
    }, async (args) => {
      const kind = args.kind as string;
      const accelerator = ACCELERATORS[kind as AcceleratorKind] as unknown as Accelerator<Record<string, unknown>, Record<string, unknown>> | undefined;
      if (!accelerator) return { error: `unknown accelerator kind: ${kind}` };
      const profile: Partial<CognitiveProfile> = {};
      for (const field of ['complexity', 'reasoningNeeded', 'verificationNeeded', 'creativityNeeded', 'risk'] as const) {
        const value = args[field];
        if (typeof value === 'number') profile[field] = value;
      }
      const result = await this.scheduler.dispatch(accelerator, (args.input as Record<string, unknown>) ?? {}, profile);
      return {
        strategy: result.strategy.kind,
        rationale: result.strategy.rationale,
        fired: result.fired,
        provider: result.provider,
        confidence: result.confidence,
        approvalNeeded: result.approvalNeeded,
        cached: result.cached,
        output: result.output,
      };
    });

    this.registerTool('principles-check', 'Evaluate an intended change against the 4 coding principles (think before coding, simplicity first, surgical changes, goal-driven execution)', {
      type: 'object', properties: {
        intent: { type: 'string', description: 'The task or request as stated' },
        proposedChange: { type: 'string', description: 'The proposed implementation change' },
        plan: { type: 'array', items: { type: 'string' }, description: 'Optional planned steps' },
      }, required: ['intent'],
    }, async (args) => {
      const engine = new CodingPrinciplesEngine();
      const plan = args.plan as string[] | undefined;
      return engine.evaluate({
        intent: args.intent as string,
        proposedChange: (args.proposedChange as string) ?? '',
        context: plan ? { plan } : undefined,
      });
    });

    this.registerTool('organic-score', 'Evaluate a code change against the 15-metric Organic Score rubric (gates: >=90 pass, 70-89 revise, <70 reject). Engineering findings with gate=veto (SPOF, unrecovered failure, pathological complexity) hard-reject regardless of score. Use before landing any generated code.', {
      type: 'object', properties: {
        change: { type: 'string', description: 'The proposed change — description or diff snippet' },
        intent: { type: 'string', description: 'The task or request as stated' },
        filesTouched: { type: 'array', items: { type: 'string' }, description: 'Files modified by the change' },
        testsRun: { type: 'array', items: { type: 'string' }, description: 'Verification commands already run' },
        engineeringTarget: {
          type: 'object',
          description: 'Run the deterministic EngineeringEvaluator on this target and feed its findings into the score (veto findings hard-reject).',
          properties: {
            kind: { type: 'string', enum: ['code', 'design', 'plan', 'architecture'], description: 'Target kind; auto-detected from the change text when omitted' },
            diff: { type: 'string', description: 'Code diff (kind=code)' },
            paths: { type: 'array', items: { type: 'string' }, description: 'Changed file paths (kind=code)' },
            text: { type: 'string', description: 'Prose target (kind=design/plan/architecture)' },
          },
        },
        engineeringFindings: {
          type: 'array',
          description: 'Explicit pre-computed engineering findings [{ tier, severity, conceptId, message, evidence, suggestion, gate }]; gate=veto hard-rejects.',
          items: { type: 'object' },
        },
      }, required: ['change'],
    }, async (args) => {
      const engine = new OrganicScoreEngine();
      const findings: EngineeringFinding[] = [];

      let engineeringReview: EngineeringReview | undefined;
      const target = args.engineeringTarget as Record<string, unknown> | undefined;
      if (target && typeof target.kind === 'string') {
        const review = createEngineeringJudgment().evaluator.evaluate(
          target.kind === 'code'
            ? { kind: 'code', diff: (target.diff as string) ?? args.change as string, paths: Array.isArray(target.paths) ? target.paths as string[] : [] }
            : { kind: target.kind as 'design' | 'plan' | 'architecture', text: (target.text as string) ?? args.change as string },
        );
        engineeringReview = review;
        findings.push(...review.findings);
      }

      const explicit = args.engineeringFindings;
      if (explicit !== undefined) findings.push(...coerceFindings(explicit));

      const result = engine.evaluate({
        change: args.change as string,
        intent: (args.intent as string) ?? undefined,
        context: {
          filesTouched: (args.filesTouched as string[] | undefined) ?? [],
          testsRun: (args.testsRun as string[] | undefined) ?? [],
        },
        ...(findings.length > 0 ? { engineeringFindings: findings } : {}),
      });
      return engineeringReview
        ? { ...result, engineeringReview: { score: engineeringReview.score, summary: engineeringReview.summary } }
        : result;
    });

    this.registerTool('engineering-review', 'Run the deterministic engineering gates over a code diff or design/plan/architecture prose (Tier I-X concepts: complexity, data-structure smells, coupling, SPOF, failure surfaces, economics, laws). Returns findings with gate classification; gate=veto findings (SPOF, unrecovered failure, pathological complexity) hard-reject through organic-score. Zero-LLM.', {
      type: 'object', properties: {
        change: { type: 'string', description: 'The target — code diff or prose' },
        kind: { type: 'string', enum: ['code', 'design', 'plan', 'architecture'], description: 'Target kind; auto-detected from the change text when omitted' },
        paths: { type: 'array', items: { type: 'string' }, description: 'Changed file paths (code targets)' },
      }, required: ['change'],
    }, async (args) => {
      const kind = args.kind as 'code' | 'design' | 'plan' | 'architecture' | undefined;
      const target = autoTarget(args.change as string, kind);
      if (target.kind === 'code' && Array.isArray(args.paths)) {
        target.paths = args.paths.filter((p): p is string => typeof p === 'string');
      }
      return createEngineeringJudgment().evaluator.evaluate(target);
    });

    this.registerTool('gap-analysis', 'Synthesize what memory knows about a query: citations, coverage gaps, contradictions, stale sources, and confidence', {
      type: 'object', properties: {
        query: { type: 'string', description: 'The question or topic to analyze' },
        maxResults: { type: 'number', description: 'Max sources to consider' },
      }, required: ['query'],
    }, async (args) => {
      const episodes = this.kernel.getRecentEpisodes(200);
      const results: GapAnalysisResultItem[] = episodes.map((e) => ({
        id: e.id,
        text: typeof e.content === 'object' && e.content !== null ? JSON.stringify(e.content) : String(e.content),
        timestamp: e.timestamp,
        source: e.session_id,
      }));
      const engine = new GapAnalysisEngine();
      return engine.analyze(args.query as string, results, {
        maxResults: (args.maxResults as number | undefined) ?? 10,
      });
    });

    this.registerTool('mem-search', 'Progressive memory search (layer 1): compact ranked index of matching episodes, token-efficient', {
      type: 'object', properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results' },
        projectId: { type: 'string', description: 'Filter by project' },
      }, required: ['query'],
    }, async (args) => {
      const searcher = new ProgressiveMemorySearch(this.kernel.getEpisodicStore());
      return searcher.search(args.query as string, {
        limit: (args.limit as number | undefined) ?? 10,
        projectId: args.projectId as string | undefined,
      });
    });

    this.registerTool('mem-get', 'Fetch full observation details for specific memory IDs (layer 3 of progressive search)', {
      type: 'object', properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Memory IDs from mem-search' },
      }, required: ['ids'],
    }, async (args) => {
      const searcher = new ProgressiveMemorySearch(this.kernel.getEpisodicStore());
      return searcher.getObservations((args.ids as string[]) ?? []);
    });

    for (const tool of createCPTools(this.protocol)) {
      this.registerTool(tool.name, tool.description, tool.inputSchema, tool.handler);
    }

    this.registerFrameworkTools();
    this.registerPackageTools();
  }

  /**
   * Cognitive Package tools — the governed install/update/revoke surface
   * (COGNITIVE-PACKAGES.md §4): every install passes the package gate
   * (signature, content hash, dependency closure, capability intersection,
   * level claims, vetoes) and is audited. Nothing executes on install; a
   * package becomes active only when a driver session attaches to it.
   */
  private registerPackageTools(): void {
    const gateFor = (args: Record<string, unknown>, store: PackageStore) =>
      new PackageGate({
        grantedCapabilities: defaultGrantedCapabilities(args.grantedCapabilities as string[] | undefined),
        substrateVersion: UCH_RUNTIME_VERSION,
        installedPackages: new Map(
          store.list().filter((p) => !p.revoked).map((p) => [p.manifest.name, p.manifest.version]),
        ),
      });

    const summarize = (decision: { admitted: boolean; reason?: string; violations: string[] }) => ({
      admitted: decision.admitted,
      ...(decision.reason !== undefined ? { reason: decision.reason } : {}),
      violations: decision.violations,
    });

    this.registerTool('package-install', 'Governed install of a Cognitive Package: the manifest passes the package gate (schema, signature, content hash, dependency closure, capability intersection, level claims, vetoes) and the package is installed atomically, inactive until a driver session attaches. Audited. Pass the manifest object; optionally scope grantedCapabilities.', {
      type: 'object', properties: {
        manifest: { type: 'object', description: 'The cognitive package manifest (uch.package.v1)' },
        grantedCapabilities: { type: 'array', items: { type: 'string' }, description: 'Optional capability override; defaults to the substrate surface (workspace capabilities + CIC op vocabulary)' },
      }, required: ['manifest'],
    }, async (args) => {
      const manifest = args.manifest as unknown;
      const validated = validatePackageManifest(manifest);
      if (!validated.ok) {
        return { admitted: false, violations: validated.errors, reason: 'malformed manifest' };
      }
      const store = await this.getPackageStore();
      const decision = await gateFor(args, store).evaluate(validated.manifest);
      if (!decision.admitted) return summarize(decision);
      const installed = store.install(validated.manifest);
      await this.persistPackageStore(store);
      return {
        ...summarize(decision),
        installed,
        package: { name: validated.manifest.name, version: validated.manifest.version, kind: validated.manifest.kind },
      };
    });

    this.registerTool('package-update', 'Governed update of an installed Cognitive Package to a new version: same gate as install; a failed gate leaves the previous version byte-identical. Audited.', {
      type: 'object', properties: {
        manifest: { type: 'object', description: 'The new cognitive package manifest (uch.package.v1)' },
        grantedCapabilities: { type: 'array', items: { type: 'string' }, description: 'Optional capability override; defaults to the substrate surface' },
      }, required: ['manifest'],
    }, async (args) => {
      const manifest = args.manifest as unknown;
      const validated = validatePackageManifest(manifest);
      if (!validated.ok) {
        return { admitted: false, violations: validated.errors, reason: 'malformed manifest' };
      }
      const store = await this.getPackageStore();
      const decision = await gateFor(args, store).evaluate(validated.manifest);
      if (!decision.admitted) return summarize(decision);
      const updated = store.update(validated.manifest);
      await this.persistPackageStore(store);
      return {
        ...summarize(decision),
        updated,
        package: { name: validated.manifest.name, version: validated.manifest.version, kind: validated.manifest.kind },
      };
    });

    this.registerTool('package-revoke', 'Revoke an installed Cognitive Package: stops new execution and drains active sessions. Audited.', {
      type: 'object', properties: {
        name: { type: 'string', description: 'Package name to revoke' },
      }, required: ['name'],
    }, async (args) => {
      const store = await this.getPackageStore();
      const revoked = store.revoke(args.name as string);
      await this.persistPackageStore(store);
      return { revoked, name: args.name as string };
    });

    this.registerTool('package-list', 'List installed Cognitive Packages with activation state', {
      type: 'object', properties: {}, required: [],
    }, async () => {
      const store = await this.getPackageStore();
      return {
        count: store.list().length,
        packages: store.list().map((p) => ({
          name: p.manifest.name, version: p.manifest.version, kind: p.manifest.kind,
          active: p.active, revoked: p.revoked, activeSessions: p.activeSessions,
          installedAt: p.installedAt.toISOString(),
        })),
      };
    });

    this.registerTool('package-audit', 'Show the package audit ledger: every install, update, and revocation in order', {
      type: 'object', properties: {}, required: [],
    }, async () => {
      const store = await this.getPackageStore();
      return {
        count: store.audit().length,
        audit: store.audit().map((e) => ({ ...e, at: e.at.toISOString() })),
      };
    });

    this.registerTool('package-attach', 'Attach a driver session to an installed, non-revoked package (activation — the only state in which a package executes)', {
      type: 'object', properties: {
        name: { type: 'string', description: 'Package name' },
      }, required: ['name'],
    }, async (args) => {
      const store = await this.getPackageStore();
      const attached = store.attach(args.name as string);
      await this.persistPackageStore(store);
      return { attached, name: args.name as string };
    });
  }

  /**
   * Cognitive Frameworks Library tools — the codified reasoning, decision,
   * strategy, productivity, research, and quality frameworks as MCP tools.
   * All deterministic (no LLM required); see `src/cognitive-plane/frameworks/`.
   */
  private registerFrameworkTools(): void {
    const registry = createFrameworkRegistry(this.frameworkTracer);

    this.registerTool('framework-catalog', 'List the Cognitive Frameworks Library: every codified framework (decision models, problem-solving, RCA, strategy, productivity, research, critical thinking, DIKW, signal fusion, code principles) with selection metadata', {
      type: 'object', properties: {
        family: { type: 'string', description: 'Optional family filter: decisions, problems, rca, strategy, productivity, research, critical, knowledge, signals, code' },
      }, required: [],
    }, async (args) => {
      const family = args.family as string | undefined;
      const frameworks = family
        ? registry.list(family as never)
        : registry.list();
      return {
        version: FRAMEWORK_CATALOG_VERSION,
        families: registry.families(),
        count: frameworks.length,
        frameworks: frameworks.map((f) => ({
          id: f.id, family: f.family, name: f.name, purpose: f.purpose,
          bestFor: f.bestFor, stages: f.stages.map((s) => s.name),
        })),
      };
    });

    this.registerTool('framework-select', 'Select the right framework for a problem (decision-about-decisions): profile clarity, data, time pressure, stakeholders, risk, complexity', {
      type: 'object', properties: {
        problem: { type: 'string', description: 'The problem or decision description' },
        family: { type: 'string', description: 'Optional family filter' },
        dataAvailability: { type: 'number', description: '0-1 how much reliable data is available' },
        timePressure: { type: 'number', description: '0-1 time pressure' },
        stakeholderInvolvement: { type: 'number', description: '0-1 stakeholder/group involvement' },
        risk: { type: 'number', description: '0-1 risk/uncertainty' },
        complexity: { type: 'number', description: '0-1 complexity' },
        rootCauseNeeded: { type: 'boolean', description: 'Root-cause diagnosis required?' },
        humanCentered: { type: 'boolean', description: 'Human-centered (users involved)?' },
        continuousImprovement: { type: 'boolean', description: 'Continuous improvement goal?' },
        speedAdaptability: { type: 'boolean', description: 'Must adapt fast to change?' },
      }, required: ['problem'],
    }, async (args) => {
      return registry.select({
        problem: args.problem as string,
        family: args.family as never,
        dataAvailability: args.dataAvailability as number | undefined,
        timePressure: args.timePressure as number | undefined,
        stakeholderInvolvement: args.stakeholderInvolvement as number | undefined,
        risk: args.risk as number | undefined,
        complexity: args.complexity as number | undefined,
        rootCauseNeeded: args.rootCauseNeeded as boolean | undefined,
        humanCentered: args.humanCentered as boolean | undefined,
        continuousImprovement: args.continuousImprovement as boolean | undefined,
        speedAdaptability: args.speedAdaptability as boolean | undefined,
      });
    });

    this.registerTool('decide', 'Run a deterministic decision model: decision matrix, cost-benefit, pareto, decision tree, SWOT, pros & cons, or pre-mortem', {
      type: 'object', properties: {
        model: { type: 'string', description: 'decision-matrix | cost-benefit | pareto | decision-tree | swot | pros-cons | pre-mortem' },
        options: { type: 'array', items: { type: 'string' }, description: 'Option names (matrix, cost-benefit, tree, pre-mortem)' },
        criteria: { type: 'array', items: { type: 'string' }, description: 'Criterion names for decision-matrix' },
        weights: { type: 'array', items: { type: 'number' }, description: 'Criterion weights for decision-matrix' },
        scores: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Per-option scores aligned with criteria (matrix)' },
        costs: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Per-option cost arrays (cost-benefit)' },
        benefits: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Per-option benefit arrays (cost-benefit)' },
        impacts: { type: 'array', items: { type: 'number' }, description: 'Impact values (pareto)' },
        probabilities: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Per-option branch probabilities (decision-tree)' },
        values: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Per-option branch values (decision-tree)' },
        strengths: { type: 'array', items: { type: 'string' }, description: 'SWOT strengths' },
        weaknesses: { type: 'array', items: { type: 'string' }, description: 'SWOT weaknesses' },
        opportunities: { type: 'array', items: { type: 'string' }, description: 'SWOT opportunities' },
        threats: { type: 'array', items: { type: 'string' }, description: 'SWOT threats' },
        pros: { type: 'array', items: { type: 'string' }, description: 'Pros & cons: advantages' },
        cons: { type: 'array', items: { type: 'string' }, description: 'Pros & cons: disadvantages' },
        causes: { type: 'array', items: { type: 'string' }, description: 'Pre-mortem failure causes' },
        plan: { type: 'string', description: 'Pre-mortem plan description' },
      }, required: ['model'],
    }, async (args) => {
      const model = args.model as string;
      const options = (args.options as string[] | undefined) ?? [];
      switch (model) {
        case 'decision-matrix': {
          const criteria = ((args.criteria as string[] | undefined) ?? []).map((name, i) => ({
            name, weight: ((args.weights as number[] | undefined) ?? [])[i] ?? 1,
          }));
          const optionScores = ((args.scores as number[][] | undefined) ?? []).map((s, i) => ({
            name: options[i] ?? `Option ${i + 1}`, scores: s,
          }));
          return this.completed(args, decisionMatrix(criteria, optionScores), model, 'decisions');
        }
        case 'cost-benefit': {
          const costs = (args.costs as number[][] | undefined) ?? [];
          const benefits = (args.benefits as number[][] | undefined) ?? [];
          return this.completed(args, costBenefit(options.map((name, i) => ({
            name, costs: costs[i] ?? [], benefits: benefits[i] ?? [],
          }))), model, 'decisions');
        }
        case 'pareto': {
          const impacts = (args.impacts as number[] | undefined) ?? [];
          return this.completed(args, paretoAnalysis(options.map((name, i) => ({ name, impact: impacts[i] ?? 0 }))), model, 'decisions');
        }
        case 'decision-tree': {
          const probabilities = (args.probabilities as number[][] | undefined) ?? [];
          const values = (args.values as number[][] | undefined) ?? [];
          return this.completed(args, decisionTree(options.map((name, i) => ({
            name,
            branches: (probabilities[i] ?? []).map((p, j) => ({
              label: `branch ${j + 1}`, probability: p, value: values[i]?.[j] ?? 0,
            })),
          }))), model, 'decisions');
        }
        case 'swot': {
          return this.completed(args, swotAnalysis({
            strengths: (args.strengths as string[] | undefined) ?? [],
            weaknesses: (args.weaknesses as string[] | undefined) ?? [],
            opportunities: (args.opportunities as string[] | undefined) ?? [],
            threats: (args.threats as string[] | undefined) ?? [],
          }), model, 'decisions');
        }
        case 'pros-cons': {
          const result = prosCons({
            pros: (args.pros as string[] | undefined) ?? [],
            cons: (args.cons as string[] | undefined) ?? [],
          });
          return this.completed(args, result, model, 'decisions', result.verdict);
        }
        case 'pre-mortem': {
          return this.completed(args, premortem({
            plan: (args.plan as string) ?? '',
            possibleCauses: (args.causes as string[] | undefined) ?? [],
          }), model, 'decisions');
        }
        default:
          return this.failed(args, { error: `unknown model: ${model}. Use: decision-matrix, cost-benefit, pareto, decision-tree, swot, pros-cons, pre-mortem` }, model, 'decisions');
      }
    });

    this.registerTool('analyze-problem', 'Run a problem-solving framework: IDEAL, five-whys, pdca, ooda, or kepner-tregoe', {
      type: 'object', properties: {
        framework: { type: 'string', description: 'ideal | five-whys | pdca | ooda | kepner-tregoe' },
        problem: { type: 'string', description: 'The problem statement' },
        whyAnswers: { type: 'array', items: { type: 'string' }, description: 'Five Whys answers' },
        objective: { type: 'string', description: 'PDCA objective' },
        observations: { type: 'array', items: { type: 'string' }, description: 'OODA observations' },
        issues: { type: 'array', items: { type: 'string' }, description: 'Kepner-Tregoe issue descriptions' },
      }, required: ['framework'],
    }, async (args) => {
      const framework = args.framework as string;
      const problem = (args.problem as string) ?? '';
      switch (framework) {
        case 'ideal':
          return this.completed(args, ideal({ problem }), framework, 'problems');
        case 'five-whys':
          return this.completed(args, fiveWhys({ symptom: problem, whyAnswers: (args.whyAnswers as string[] | undefined) ?? [] }), framework, 'problems');
        case 'pdca':
          return this.completed(args, pdcaPlan({ objective: problem }), framework, 'problems');
        case 'ooda':
          return this.completed(args, ooda({ observations: (args.observations as string[] | undefined) ?? [problem] }), framework, 'problems');
        case 'kepner-tregoe':
          return this.completed(args, kepnerTregoe({
            issues: ((args.issues as string[] | undefined) ?? [problem]).map((description) => ({ description })),
          }), framework, 'problems');
        default:
          return this.failed(args, { error: `unknown framework: ${framework}. Use: ideal, five-whys, pdca, ooda, kepner-tregoe` }, framework, 'problems');
      }
    });

    this.registerTool('rca', 'Root cause analysis (F.O.C.U.S.): problem, evidence, hypotheses → ranked root cause, corrective actions, prevention', {
      type: 'object', properties: {
        problem: { type: 'string', description: 'Measurable problem statement' },
        evidenceFacts: { type: 'array', items: { type: 'string' }, description: 'Evidence facts (logs, metrics, observations)' },
        evidenceSources: { type: 'array', items: { type: 'string' }, description: 'Source per evidence fact' },
        causes: { type: 'array', items: { type: 'string' }, description: 'Candidate causes' },
        categories: { type: 'array', items: { type: 'string' }, description: 'Category per cause (people, process, technology, materials, environment, management)' },
        likelihoods: { type: 'array', items: { type: 'number' }, description: 'Likelihood 0-1 per cause' },
        impacts: { type: 'array', items: { type: 'number' }, description: 'Impact 0-1 per cause' },
      }, required: ['problem'],
    }, async (args) => {
      const facts = (args.evidenceFacts as string[] | undefined) ?? [];
      const sources = (args.evidenceSources as string[] | undefined) ?? [];
      const causes = (args.causes as string[] | undefined) ?? [];
      const categories = (args.categories as string[] | undefined) ?? [];
      const likelihoods = (args.likelihoods as number[] | undefined) ?? [];
      const impacts = (args.impacts as number[] | undefined) ?? [];
      return this.completed(args, rcaAnalyze({
        problem: args.problem as string,
        evidence: facts.map((fact, i) => ({ fact, source: sources[i] ?? 'observation' })),
        hypotheses: causes.map((cause, i) => ({
          cause,
          category: (categories[i] as never) ?? 'process',
          likelihood: likelihoods[i] ?? 0.5,
          impact: impacts[i] ?? 0.5,
        })),
      }), 'rca-focus', 'rca');
    });

    this.registerTool('strategy', 'Run strategy frameworks: strategy-wheel (20 questions) or strategy-vs-plan (direction vs execution gap diagnosis)', {
      type: 'object', properties: {
        framework: { type: 'string', description: 'strategy-wheel | strategy-vs-plan' },
        purpose: { type: 'string' }, arena: { type: 'string' }, advantage: { type: 'string' },
        capabilities: { type: 'string' }, revenueLogic: { type: 'string' },
        planGoals: { type: 'string' }, planOwnership: { type: 'string' }, planResources: { type: 'string' },
        planTimeline: { type: 'string' }, planTracking: { type: 'string' },
      }, required: ['framework'],
    }, async (args) => {
      const framework = args.framework as string;
      if (framework === 'strategy-wheel') {
        return this.completed(args, strategyWheel(), framework, 'strategy');
      }
      return this.completed(args, strategyVsPlan({
        strategy: {
          purpose: args.purpose as string | undefined,
          arena: args.arena as string | undefined,
          advantage: args.advantage as string | undefined,
          capabilities: args.capabilities as string | undefined,
          revenueLogic: args.revenueLogic as string | undefined,
        },
        plan: {
          goals: args.planGoals as string | undefined,
          ownership: args.planOwnership as string | undefined,
          resources: args.planResources as string | undefined,
          timeline: args.planTimeline as string | undefined,
          tracking: args.planTracking as string | undefined,
        },
      }), framework, 'strategy');
    });

    this.registerTool('plan-day', 'Plan work with the Productivity OS: Eisenhower classification, MIT, Pareto vital few, eat-the-frog, time blocks, two-minute rule, SMART gaps', {
      type: 'object', properties: {
        tasks: { type: 'array', items: { type: 'string' }, description: 'Task names' },
        durations: { type: 'array', items: { type: 'number' }, description: 'Minutes per task' },
        urgencies: { type: 'array', items: { type: 'string' }, description: 'urgent | not-urgent per task' },
        importances: { type: 'array', items: { type: 'string' }, description: 'important | not-important per task' },
        leverages: { type: 'array', items: { type: 'number' }, description: '0-1 leverage per task' },
        resistances: { type: 'array', items: { type: 'number' }, description: '0-1 resistance per task' },
        notes: { type: 'array', items: { type: 'string' }, description: 'Goal notes (first task notes used for SMART check)' },
        focusHours: { type: 'number', description: 'Focus hours available' },
      }, required: ['tasks'],
    }, async (args) => {
      const names = (args.tasks as string[]) ?? [];
      const tasks = names.map((name, i) => ({
        name,
        durationMin: (args.durations as number[] | undefined)?.[i],
        urgency: (args.urgencies as string[] | undefined)?.[i] as never,
        importance: (args.importances as string[] | undefined)?.[i] as never,
        leverage: (args.leverages as number[] | undefined)?.[i],
        resistance: (args.resistances as number[] | undefined)?.[i],
        notes: (args.notes as string[] | undefined)?.[i],
      }));
      return this.completed(args, planTasks({ tasks, focusHours: (args.focusHours as number | undefined) ?? 4 }), 'productivity-os', 'productivity');
    });

    this.registerTool('evaluate-info', 'Critical thinking: evaluate information against the 9 critical questions (maps to the 5 Information Integrity laws)', {
      type: 'object', properties: {
        target: { type: 'string', description: 'What is being evaluated' },
        answers: { type: 'object', description: 'Map of question id → answer: needs, qualified_source, currency, prejudice, fact_vs_opinion, propaganda, motivation, whole_story, better_sources' },
      }, required: ['target'],
    }, async (args) => {
      return assessInformation({
        target: args.target as string,
        answers: (args.answers as Record<string, string> | undefined) ?? {},
      });
    });

    this.registerTool('research-methodology', 'Validate a research methodology against the 5-stage structure (design, collection, analysis, sampling, ethics) with quality controls', {
      type: 'object', properties: {
        question: { type: 'string', description: 'Research question' },
        designApproach: { type: 'string', description: 'qualitative | quantitative | mixed' },
        designJustification: { type: 'string' },
        collectionMethods: { type: 'array', items: { type: 'string' } },
        collectionDetail: { type: 'string' },
        analysisMethods: { type: 'array', items: { type: 'string' } },
        analysisDescription: { type: 'string' },
        population: { type: 'string' }, samplingMethod: { type: 'string' },
        sampleSize: { type: 'string' }, sampleJustification: { type: 'string' },
        informedConsent: { type: 'boolean' }, confidentiality: { type: 'boolean' },
        voluntary: { type: 'boolean' }, dataProtection: { type: 'boolean' },
      }, required: ['question'],
    }, async (args) => {
      return validateMethodology({
        researchQuestion: args.question as string,
        design: {
          approach: args.designApproach as never,
          justification: args.designJustification as string | undefined,
        },
        collection: {
          methods: (args.collectionMethods as string[] | undefined) ?? [],
          detail: args.collectionDetail as string | undefined,
        },
        analysis: {
          methods: (args.analysisMethods as string[] | undefined) ?? [],
          description: args.analysisDescription as string | undefined,
        },
        sampling: {
          population: args.population as string | undefined,
          method: args.samplingMethod as string | undefined,
          size: args.sampleSize as string | undefined,
          justification: args.sampleJustification as string | undefined,
        },
        ethics: {
          informedConsent: Boolean(args.informedConsent),
          confidentiality: Boolean(args.confidentiality),
          voluntary: Boolean(args.voluntary),
          dataProtection: Boolean(args.dataProtection),
        },
      });
    });

    this.registerTool('research-gap', 'Research gap analysis: detect knowledge, evidence, methodological, population, context, time, contradiction, and theory gaps from literature notes', {
      type: 'object', properties: {
        topic: { type: 'string', description: 'Research topic' },
        titles: { type: 'array', items: { type: 'string' }, description: 'Paper titles' },
        findings: { type: 'array', items: { type: 'string' }, description: 'Key findings per paper' },
        years: { type: 'array', items: { type: 'number' }, description: 'Publication years' },
        limitations: { type: 'array', items: { type: 'string' }, description: 'Limitations per paper' },
        futureRecommendations: { type: 'array', items: { type: 'string' }, description: 'Future-research recommendations per paper' },
      }, required: ['topic'],
    }, async (args) => {
      const titles = (args.titles as string[] | undefined) ?? [];
      const findings = (args.findings as string[] | undefined) ?? [];
      const years = (args.years as number[] | undefined) ?? [];
      const limitations = (args.limitations as string[] | undefined) ?? [];
      const futures = (args.futureRecommendations as string[] | undefined) ?? [];
      return detectGaps({
        topic: args.topic as string,
        notes: titles.map((title, i) => ({
          title,
          finding: findings[i] ?? '',
          year: years[i],
          limitation: limitations[i],
          futureRecommendation: futures[i],
        })),
      });
    });

    this.registerTool('dikw', 'DIKW transform: elevate data → information → knowledge → wisdom, and check representation invariance (truth across representations)', {
      type: 'object', properties: {
        attributes: { type: 'array', items: { type: 'string' }, description: 'Data attribute names' },
        values: { type: 'array', items: { type: 'string' }, description: 'Data values' },
        priorities: { type: 'array', items: { type: 'string' }, description: 'Judgment priorities (adds wisdom)' },
        tradeoffs: { type: 'array', items: { type: 'string' }, description: 'Judgment trade-offs' },
      }, required: ['attributes'],
    }, async (args) => {
      const attributes = (args.attributes as string[]) ?? [];
      const values = (args.values as string[]) ?? [];
      return dikwTransform({
        dataPoints: attributes.map((attribute, i) => ({ attribute, value: values[i] ?? '' })),
        judgment: (args.priorities as string[] | undefined)?.length
          ? {
              priorities: args.priorities as string[],
              tradeoffs: (args.tradeoffs as string[] | undefined) ?? [],
              ethicalConsiderations: [],
            }
          : undefined,
      });
    });

    this.registerTool('compose-signals', 'Composite signal fusion: combine weak signals into a ranked composite with risk controls (quant-style multi-factor scoring)', {
      type: 'object', properties: {
        candidates: { type: 'array', items: { type: 'string' }, description: 'Candidate names' },
        factors: { type: 'array', items: { type: 'object' }, description: 'Per-candidate factors: [{id, label, score}...]' },
        maxAllocationPct: { type: 'number' },
        topN: { type: 'number' },
      }, required: ['candidates'],
    }, async (args) => {
      const candidates = (args.candidates as string[]) ?? [];
      const factors = (args.factors as { id: string; label: string; score: number }[][] | undefined) ?? [];
      return fuseSignals(
        candidates.map((name, i) => ({
          name,
          factors: (factors[i] ?? []).map((f) => ({ id: f.id as never, label: f.label, score: f.score })),
        })),
        {
          maxAllocationPct: args.maxAllocationPct as number | undefined,
          topN: args.topN as number | undefined,
        },
      );
    });

    this.registerTool('code-audit', 'Audit a design or change against the Clean Code principles (SOC, DRY, KISS, DYC, YAGNI) including the trade-off layer', {
      type: 'object', properties: {
        change: { type: 'string', description: 'The proposed change or design description' },
        intent: { type: 'string', description: 'Task intent (context for YAGNI/DYC)' },
      }, required: ['change'],
    }, async (args) => {
      return auditCodePrinciples({
        change: args.change as string,
        intent: (args.intent as string | undefined) ?? '',
      });
    });

    this.registerTool('framework-stats', 'Framework usage analytics: usage counts per model/family, dominant framework per problem type, drift over time, and per-model accuracy from the decision journal (which models got reversed). Zero-LLM.', {
      type: 'object', properties: {
        includeTraces: { type: 'boolean', description: 'Include the raw usage-trace stats in addition to journal stats (default true)' },
      }, required: [],
    }, async (args) => {
      const usage = this.frameworkTracer.getStats();
      const journal = this.frameworkJournal.getStats();
      return {
        version: FRAMEWORK_CATALOG_VERSION,
        journal: {
          total: journal.total,
          open: journal.open,
          resolved: journal.resolved,
          usageByModel: journal.usageByModel,
          accuracyByModel: journal.accuracyByModel,
          dominantPerProblemType: journal.dominantPerProblemType,
          reversed: journal.reversed,
          drift: journal.drift,
        },
        ...(args.includeTraces === false
          ? {}
          : {
              traces: {
                traceCount: usage.traceCount,
                usageByFramework: usage.usageByFramework,
                usageByFamily: usage.usageByFamily,
                dominantPerProblemType: usage.dominantPerProblemType,
                drift: usage.drift,
              },
            }),
      };
    });

    this.registerTool('framework-run', 'Run the full solve pipeline end-to-end: select model → understand (IDEAL) → diagnose (RCA when root-cause needed) → decide (matrix or pros-cons when alternatives given) → pre-mortem risk gate → plan. One call, full trace tree.', {
      type: 'object', properties: {
        problem: { type: 'string', description: 'The problem or decision to solve' },
        family: { type: 'string', description: 'Optional family filter for model selection' },
        dataAvailability: { type: 'number', description: '0-1 how much reliable data is available' },
        timePressure: { type: 'number', description: '0-1 time pressure' },
        stakeholderInvolvement: { type: 'number', description: '0-1 stakeholder/group involvement' },
        risk: { type: 'number', description: '0-1 risk/uncertainty' },
        complexity: { type: 'number', description: '0-1 complexity' },
        rootCauseNeeded: { type: 'boolean', description: 'Run the RCA diagnose stage' },
        humanCentered: { type: 'boolean' },
        continuousImprovement: { type: 'boolean' },
        speedAdaptability: { type: 'boolean' },
        options: { type: 'array', items: { type: 'string' }, description: 'Decide-stage alternatives (with criteria+scores for matrix)' },
        criteria: { type: 'array', items: { type: 'string' }, description: 'Decision-matrix criteria' },
        weights: { type: 'array', items: { type: 'number' }, description: 'Decision-matrix weights' },
        scores: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Per-option scores aligned with criteria (0-10)' },
        pros: { type: 'array', items: { type: 'string' }, description: 'Pros & cons mode: advantages' },
        cons: { type: 'array', items: { type: 'string' }, description: 'Pros & cons mode: disadvantages' },
        riskCauses: { type: 'array', items: { type: 'string' }, description: 'Pre-mortem failure causes (defaults to standard checklist)' },
        riskLikelihood: { type: 'array', items: { type: 'number' }, description: 'Pre-mortem likelihood 0-1 per risk cause' },
        riskImpact: { type: 'array', items: { type: 'number' }, description: 'Pre-mortem impact 0-1 per risk cause' },
        evidenceFacts: { type: 'array', items: { type: 'string' }, description: 'RCA evidence facts' },
      }, required: ['problem'],
    }, async (args) => {
      try {
        const composer = new FrameworkComposer(this.frameworkTracer);
        const result = composer.solve(args.problem as string, {
          family: args.family as never,
          dataAvailability: args.dataAvailability as number | undefined,
          timePressure: args.timePressure as number | undefined,
          stakeholderInvolvement: args.stakeholderInvolvement as number | undefined,
          risk: args.risk as number | undefined,
          complexity: args.complexity as number | undefined,
          rootCauseNeeded: args.rootCauseNeeded as boolean | undefined,
          humanCentered: args.humanCentered as boolean | undefined,
          continuousImprovement: args.continuousImprovement as boolean | undefined,
          speedAdaptability: args.speedAdaptability as boolean | undefined,
          options: args.options as string[] | undefined,
          criteria: args.criteria as string[] | undefined,
          weights: args.weights as number[] | undefined,
          scores: args.scores as number[][] | undefined,
          pros: args.pros as string[] | undefined,
          cons: args.cons as string[] | undefined,
          riskCauses: args.riskCauses as string[] | undefined,
          riskLikelihood: args.riskLikelihood as number[] | undefined,
          riskImpact: args.riskImpact as number[] | undefined,
          evidenceFacts: args.evidenceFacts as string[] | undefined,
        });
        for (const stage of result.stages) {
          this.frameworkJournal.record({
            engine: stage.engine,
            family: stage.family,
            problem: result.problem,
            profile: result.profile,
            verdict: stage.verdict,
            mode: 'deterministic',
          });
        }
        return result;
      } catch (err) {
        this.frameworkTracer.recordError({
          engine: 'composer',
          family: 'problems',
          problem: String(args.problem ?? ''),
          message: err instanceof Error ? err.message : String(err),
        });
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  private registerTool(name: string, description: string, inputSchema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>): void {
    this.tools.set(name, { name, description, inputSchema, handler });
  }

  private sendMessage(msg: Record<string, unknown> | string): void {
    process.stdout.write((typeof msg === 'string' ? msg : JSON.stringify(msg)) + '\n');
  }

  private errorResponse(id: unknown, code: number, message: string): Record<string, unknown> {
    return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
  }

  private async handleMessage(line: string): Promise<void> {
    let msg: { id?: unknown; method?: string; params?: Record<string, unknown>; jsonrpc?: string };
    try {
      msg = JSON.parse(line);
    } catch {
      this.sendMessage({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }

    if (msg.method === 'initialize') {
      this.initialized = true;
      this.sendMessage({
        jsonrpc: '2.0', id: msg.id,
        result: {
          protocolVersion: '2025-03-26',
          serverInfo: { name: 'uch', version: '0.2.0' },
          capabilities: { tools: {}, resources: {}, prompts: {} },
        },
      });
      return;
    }

    if (msg.method === 'notifications/initialized') return;

    if (msg.method === 'tools/list') {
      const toolList = [...this.tools.values()].map((t) => ({
        name: t.name, description: t.description, inputSchema: t.inputSchema,
      }));
      this.sendMessage({ jsonrpc: '2.0', id: msg.id, result: { tools: toolList } });
      return;
    }

    if (msg.method === 'tools/call') {
      const toolName = msg.params?.name as string;
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = this.tools.get(toolName);
      if (!tool) {
        this.sendMessage(this.errorResponse(msg.id, -32602, `Unknown tool: ${toolName}`));
        return;
      }
      try {
        const result = await tool.handler(args);
        this.sendMessage({
          jsonrpc: '2.0', id: msg.id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
        });
      } catch (err) {
        this.sendMessage({
          jsonrpc: '2.0', id: msg.id,
          error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
        });
      }
      return;
    }

    if (msg.method === 'resources/list') {
      this.sendMessage({
        jsonrpc: '2.0', id: msg.id,
        result: { resources: [
          { uri: 'uch://cognitive/state', name: 'Cognitive State', description: 'Current system state', mimeType: 'application/json' },
          { uri: 'uch://sessions', name: 'Sessions', description: 'Saved sessions', mimeType: 'application/json' },
        ]},
      });
      return;
    }

    if (msg.method === 'resources/read') {
      const uri = msg.params?.uri as string;
      if (uri === 'uch://cognitive/state') {
        this.sendMessage({
          jsonrpc: '2.0', id: msg.id,
          result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(this.kernel.getStats(), null, 2) }] },
        });
        return;
      }
      if (uri === 'uch://sessions') {
        this.sendMessage({
          jsonrpc: '2.0', id: msg.id,
          result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(this.sessionManager.listSessions(), null, 2) }] },
        });
        return;
      }
      this.sendMessage(this.errorResponse(msg.id, -32602, `Unknown resource: ${uri}`));
      return;
    }

    if (msg.method === 'prompts/list') {
      this.sendMessage({
        jsonrpc: '2.0', id: msg.id,
        result: { prompts: [
          { name: 'cognitive-status', description: 'Current cognitive state', arguments: [] },
          { name: 'session-summary', description: 'Summarize current session', arguments: [] },
        ]},
      });
      return;
    }

    if (msg.method === 'prompts/get') {
      const promptName = msg.params?.name as string;
      if (promptName === 'cognitive-status') {
        const stats = this.kernel.getStats();
        this.sendMessage({
          jsonrpc: '2.0', id: msg.id,
          result: { messages: [{ role: 'assistant', content: { type: 'text', text: `Episodes: ${stats.episodes}\nConcepts: ${stats.concepts}\nRelationships: ${stats.relationships}\nBeliefs: ${stats.beliefs}\nSleep: ${stats.sleep_cycles}` } }] },
        });
        return;
      }
      if (promptName === 'session-summary') {
        const session = this.sessionManager.getSession();
        this.sendMessage({
          jsonrpc: '2.0', id: msg.id,
          result: { messages: [{ role: 'assistant', content: { type: 'text', text: session ? `Active session: ${session.id}\nTool: ${session.toolName}\nMemories: ${session.memories.length}\nConversation turns: ${session.conversation.length}` : 'No active session' } }] },
        });
        return;
      }
      this.sendMessage(this.errorResponse(msg.id, -32602, `Unknown prompt: ${promptName}`));
      return;
    }

    this.sendMessage(this.errorResponse(msg.id, -32601, `Method not found: ${msg.method}`));
  }

  start(): void {
    this.rl = readline.createInterface({ input: process.stdin });
    this.rl.on('line', async (line) => {
      try {
        await this.handleMessage(line);
      } catch (err) {
        this.sendMessage({ jsonrpc: '2.0', id: null, error: { code: -32603, message: String(err) } });
      }
    });
    this.rl.on('close', () => process.exit(0));
  }

  stop(): void {
    this.rl?.close();
  }
}
