import { ACCELERATORS } from '../../accelerators/index.js';
import type { Accelerator, AcceleratorKind, CognitiveProfile } from '../../accelerators/index.js';
import { CodingPrinciplesEngine } from '../../kernel/constitution/coding-principles.js';
import { OrganicScoreEngine } from '../../kernel/constitution/organic-score.js';
import {
  GapAnalysisEngine,
  type GapAnalysisResultItem,
} from '../../kernel/retrieval/gap-analysis.js';
import { ProgressiveMemorySearch } from '../../memory/progressive-search.js';
import {
  autoTarget,
  coerceFindings,
  createEngineeringJudgment,
} from '../../engineering-intelligence/index.js';
import type {
  EngineeringFinding,
  EngineeringReview,
} from '../../engineering-intelligence/types.js';
import { createCPTools } from '../../protocol/index.js';
import type { MCPToolContext, ToolRegistrar } from './types.js';

/** Core cognitive, memory, retrieval, and quality-gate MCP tools. */
export function registerCoreTools(ctx: MCPToolContext, register: ToolRegistrar): void {
  register(
    'observe',
    'Record an observation into cognitive memory',
    {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Observation text' },
        source: { type: 'string', description: 'Source identifier' },
      },
      required: ['text'],
    },
    async (args) =>
      ctx.bio.observe({ text: args.text as string, source: args.source as string | undefined }),
  );

  register(
    'remember',
    'Store content in episodic memory',
    {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to remember' },
        importance: { type: 'number', description: 'Importance 0-1' },
      },
      required: ['content'],
    },
    async (args) =>
      ctx.bio.remember({
        content: args.content as string,
        importance: args.importance as number | undefined,
      }),
  );

  register(
    'recall',
    'Search cognitive memory for relevant information',
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        topK: { type: 'number', description: 'Max results' },
      },
      required: ['query'],
    },
    async (args) => {
      const query = args.query as string;
      const topK = (args.topK as number) ?? 5;

      const episodes = ctx.kernel.getRecentEpisodes(50);
      const items = episodes.map((e) => ({
        id: e.id,
        text:
          typeof e.content === 'object' && e.content !== null
            ? JSON.stringify(e.content)
            : String(e.content),
      }));

      if (ctx.embedder.available) {
        const results = await ctx.embedder.search(query, items, topK);
        return {
          results: results.map((r) => ({
            id: r.id,
            score: r.score,
            content: (r.item as { text: string }).text,
          })),
          method: 'semantic',
        };
      }

      const formatted = ctx.kernel.recallFormatted({ text: query });
      return { results: formatted, count: episodes.length, method: 'keyword' };
    },
  );

  register(
    'session-save',
    'Save current session state for later resumption',
    {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Session name (optional)' },
        memories: {
          type: 'array',
          description: 'Key memories to persist',
          items: { type: 'object' },
        },
      },
    },
    async (args) => {
      const name = args.name as string | undefined;
      const memories = args.memories as
        Array<{ key?: string; value: string; type: string; importance?: number }> | undefined;
      if (memories) {
        for (const m of memories) {
          ctx.sessionManager.addMemory({
            key: m.key,
            value: m.value,
            type: m.type as 'decision' | 'fact' | 'observation' | 'task' | 'convention',
            importance: m.importance ?? 0.5,
          });
        }
      }
      const path = await ctx.sessionManager.saveSession(name);
      return { path, sessionId: ctx.sessionManager.getSession()?.id };
    },
  );

  register(
    'session-load',
    'Load a previously saved session',
    {
      type: 'object',
      properties: { session: { type: 'string', description: 'Session name or ID to load' } },
      required: ['session'],
    },
    async (args) => {
      const session = await ctx.sessionManager.loadSession(args.session as string);
      if (!session) return { error: `Session not found: ${args.session}` };
      return {
        id: session.id,
        toolName: session.toolName,
        timestamp: session.timestamp,
        memories: session.memories,
        context: session.context,
        conversationCount: session.conversation.length,
      };
    },
  );

  register(
    'session-list',
    'List all saved sessions',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      const sessions = ctx.sessionManager.listSessions();
      return { sessions: sessions.slice(0, 20) };
    },
  );

  register(
    'session-handoff',
    'Export session as handoff document for another AI tool',
    {
      type: 'object',
      properties: { session: { type: 'string', description: 'Session name or ID' } },
    },
    async (args) => {
      if (args.session) await ctx.sessionManager.loadSession(args.session as string);
      const handoff = ctx.sessionManager.exportSessionHandoff();
      return { handoff };
    },
  );

  register(
    'git-ingest',
    'Ingest recent git commits into memory',
    {
      type: 'object',
      properties: { count: { type: 'number', description: 'Number of commits to ingest' } },
    },
    async (args) => {
      const result = await ctx.gitIngester.ingestRecent(args.count as number | undefined);
      return result;
    },
  );

  register(
    'plan',
    'Create a plan to achieve a goal',
    {
      type: 'object',
      properties: { goal: { type: 'string', description: 'The goal to plan for' } },
      required: ['goal'],
    },
    async (args) => ctx.bio.plan(args.goal as string),
  );

  register(
    'reflect',
    'Reflect on current cognitive state',
    {
      type: 'object',
      properties: {},
    },
    async () => ctx.bio.reflect(),
  );

  register(
    'learn',
    'Learn from a proposition with supporting evidence',
    {
      type: 'object',
      properties: {
        proposition: { type: 'string', description: 'Proposition to evaluate' },
        evidence: { type: 'string', description: 'Supporting evidence' },
      },
      required: ['proposition', 'evidence'],
    },
    async (args) => ctx.bio.learn(args.proposition as string, args.evidence as string),
  );

  register(
    'critique',
    'Critically evaluate a target',
    {
      type: 'object',
      properties: { target: { type: 'string', description: 'The target to critique' } },
      required: ['target'],
    },
    async (args) => ctx.bio.critique(args.target as string),
  );

  register(
    'status',
    'Get UCH system status',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      const stats = ctx.kernel.getStats();
      return {
        ...stats,
        llmAvailable: ctx.llm.isAvailable,
        embedderAvailable: ctx.embedder.available,
        embedderMode: ctx.embedder.useLocalFallback ? 'local-fallback' : 'api',
        sessions: ctx.sessionManager.listSessions().length,
        episodeCount: ctx.kernel.getRecentEpisodes().length,
      };
    },
  );

  register(
    'sm-store',
    'Store a fact in scientific memory with evidence tracking',
    {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Fact key' },
        value: { type: 'string', description: 'Fact value' },
        source: { type: 'string', description: 'Source' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
      },
      required: ['key', 'value', 'source'],
    },
    async (args) => {
      const entry = ctx.scientificMemory.store({
        key: args.key as string,
        value: args.value as string,
        source: args.source as string,
        tags: args.tags as string[] | undefined,
      });
      return { id: entry.id, certainty: entry.certainty, confidence: entry.confidence };
    },
  );

  register(
    'sm-recall',
    'Retrieve facts from scientific memory',
    {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Fact key to look up' },
        tag: { type: 'string', description: 'Filter by tag' },
      },
    },
    async (args) => {
      const key = args.key as string | undefined;
      const tag = args.tag as string | undefined;

      if (key) {
        const entry = ctx.scientificMemory.getByKey(key);
        if (!entry) return { found: false };
        return { found: true, entry };
      }
      if (tag) {
        const all = ctx.scientificMemory.getAll(200);
        const entries = all.filter((e) => e.tags.includes(tag));
        return { found: entries.length > 0, entries: entries.slice(0, 20), count: entries.length };
      }
      const all = ctx.scientificMemory.getAll();
      return { entries: all.slice(0, 20), count: all.length };
    },
  );

  register(
    'sm-facts',
    'List all stored scientific facts',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      const entries = ctx.scientificMemory.getAll();
      return {
        count: entries.length,
        entries: entries.slice(0, 50).map((e) => ({
          key: e.key,
          certainty: e.certainty,
          confidence: e.confidence,
          tags: e.tags,
        })),
      };
    },
  );

  register(
    'constitution-check',
    'Check cognitive constitution compliance',
    {
      type: 'object',
      properties: { subject: { type: 'string', description: 'Subject to check' } },
    },
    async (args) => {
      const violations = await ctx.constitution.checkCompliance(
        (args.subject as string) ?? 'check',
        {},
      );
      return { compliant: violations.length === 0, violations };
    },
  );

  register(
    'summarize',
    'Summarize text (compression accelerator)',
    {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to summarize' },
        maxWords: { type: 'number', description: 'Max words' },
      },
      required: ['text'],
    },
    async (args) => {
      const result = await ctx.fabric.dispatch(
        ACCELERATORS.compression,
        { text: args.text as string, maxWords: (args.maxWords as number) ?? 100 },
        { maxTokens: (args.maxWords as number) ?? 100, priority: 1 },
      );
      return { summary: result.output.summary, fired: result.fired, provider: result.provider };
    },
  );

  register(
    'extract-concepts',
    'Extract key concepts from text (semantic accelerator)',
    {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to analyze' } },
      required: ['text'],
    },
    async (args) => {
      const result = await ctx.fabric.dispatch(
        ACCELERATORS.semantic,
        { text: args.text as string },
        { maxTokens: 300, priority: 1 },
      );
      return {
        concepts: [...result.output.entities, ...result.output.topics],
        fired: result.fired,
        provider: result.provider,
      };
    },
  );

  register(
    'schedule',
    'Dispatch an accelerator under a cognitive profile (cognitive scheduler decides the execution strategy)',
    {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          description:
            'Accelerator kind: semantic, compression, reasoning, prediction, memory, ontology, classification',
        },
        input: {
          type: 'object',
          description: 'Accelerator input (e.g. { text: "..." } or { memories: [...] })',
        },
        complexity: { type: 'number', description: 'Task complexity 0-1' },
        reasoningNeeded: { type: 'number', description: 'Deep reasoning required 0-1' },
        verificationNeeded: {
          type: 'number',
          description: 'Independent verification required 0-1',
        },
        creativityNeeded: { type: 'number', description: 'Divergent generation required 0-1' },
        risk: {
          type: 'number',
          description: 'Consequence severity 0-1; >= 0.8 forces human approval',
        },
      },
      required: ['kind', 'input'],
    },
    async (args) => {
      const kind = args.kind as string;
      const accelerator = ACCELERATORS[kind as AcceleratorKind] as unknown as
        Accelerator<Record<string, unknown>, Record<string, unknown>> | undefined;
      if (!accelerator) return { error: `unknown accelerator kind: ${kind}` };
      const profile: Partial<CognitiveProfile> = {};
      for (const field of [
        'complexity',
        'reasoningNeeded',
        'verificationNeeded',
        'creativityNeeded',
        'risk',
      ] as const) {
        const value = args[field];
        if (typeof value === 'number') profile[field] = value;
      }
      const result = await ctx.scheduler.dispatch(
        accelerator,
        (args.input as Record<string, unknown>) ?? {},
        profile,
      );
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
    },
  );

  register(
    'principles-check',
    'Evaluate an intended change against the 4 coding principles (think before coding, simplicity first, surgical changes, goal-driven execution)',
    {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'The task or request as stated' },
        proposedChange: { type: 'string', description: 'The proposed implementation change' },
        plan: { type: 'array', items: { type: 'string' }, description: 'Optional planned steps' },
      },
      required: ['intent'],
    },
    async (args) => {
      const engine = new CodingPrinciplesEngine();
      const plan = args.plan as string[] | undefined;
      return engine.evaluate({
        intent: args.intent as string,
        proposedChange: (args.proposedChange as string) ?? '',
        context: plan ? { plan } : undefined,
      });
    },
  );

  register(
    'organic-score',
    'Evaluate a code change against the 15-metric Organic Score rubric (gates: >=90 pass, 70-89 revise, <70 reject). Engineering findings with gate=veto (SPOF, unrecovered failure, pathological complexity) hard-reject regardless of score. Use before landing any generated code.',
    {
      type: 'object',
      properties: {
        change: {
          type: 'string',
          description: 'The proposed change — description or diff snippet',
        },
        intent: { type: 'string', description: 'The task or request as stated' },
        filesTouched: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files modified by the change',
        },
        testsRun: {
          type: 'array',
          items: { type: 'string' },
          description: 'Verification commands already run',
        },
        engineeringTarget: {
          type: 'object',
          description:
            'Run the deterministic EngineeringEvaluator on this target and feed its findings into the score (veto findings hard-reject).',
          properties: {
            kind: {
              type: 'string',
              enum: ['code', 'design', 'plan', 'architecture'],
              description: 'Target kind; auto-detected from the change text when omitted',
            },
            diff: { type: 'string', description: 'Code diff (kind=code)' },
            paths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Changed file paths (kind=code)',
            },
            text: { type: 'string', description: 'Prose target (kind=design/plan/architecture)' },
          },
        },
        engineeringFindings: {
          type: 'array',
          description:
            'Explicit pre-computed engineering findings [{ tier, severity, conceptId, message, evidence, suggestion, gate }]; gate=veto hard-rejects.',
          items: { type: 'object' },
        },
      },
      required: ['change'],
    },
    async (args) => {
      const engine = new OrganicScoreEngine();
      const findings: EngineeringFinding[] = [];

      let engineeringReview: EngineeringReview | undefined;
      const target = args.engineeringTarget as Record<string, unknown> | undefined;
      if (target && typeof target.kind === 'string') {
        const review = createEngineeringJudgment().evaluator.evaluate(
          target.kind === 'code'
            ? {
                kind: 'code',
                diff: (target.diff as string) ?? (args.change as string),
                paths: Array.isArray(target.paths) ? (target.paths as string[]) : [],
              }
            : {
                kind: target.kind as 'design' | 'plan' | 'architecture',
                text: (target.text as string) ?? (args.change as string),
              },
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
        ? {
            ...result,
            engineeringReview: {
              score: engineeringReview.score,
              summary: engineeringReview.summary,
            },
          }
        : result;
    },
  );

  register(
    'engineering-review',
    'Run the deterministic engineering gates over a code diff or design/plan/architecture prose (Tier I-X concepts: complexity, data-structure smells, coupling, SPOF, failure surfaces, economics, laws). Returns findings with gate classification; gate=veto findings (SPOF, unrecovered failure, pathological complexity) hard-reject through organic-score. Zero-LLM.',
    {
      type: 'object',
      properties: {
        change: { type: 'string', description: 'The target — code diff or prose' },
        kind: {
          type: 'string',
          enum: ['code', 'design', 'plan', 'architecture'],
          description: 'Target kind; auto-detected from the change text when omitted',
        },
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Changed file paths (code targets)',
        },
      },
      required: ['change'],
    },
    async (args) => {
      const kind = args.kind as 'code' | 'design' | 'plan' | 'architecture' | undefined;
      const target = autoTarget(args.change as string, kind);
      if (target.kind === 'code' && Array.isArray(args.paths)) {
        target.paths = args.paths.filter((p): p is string => typeof p === 'string');
      }
      return createEngineeringJudgment().evaluator.evaluate(target);
    },
  );

  register(
    'gap-analysis',
    'Synthesize what memory knows about a query: citations, coverage gaps, contradictions, stale sources, and confidence',
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The question or topic to analyze' },
        maxResults: { type: 'number', description: 'Max sources to consider' },
      },
      required: ['query'],
    },
    async (args) => {
      const episodes = ctx.kernel.getRecentEpisodes(200);
      const results: GapAnalysisResultItem[] = episodes.map((e) => ({
        id: e.id,
        text:
          typeof e.content === 'object' && e.content !== null
            ? JSON.stringify(e.content)
            : String(e.content),
        timestamp: e.timestamp,
        source: e.session_id,
      }));
      const engine = new GapAnalysisEngine();
      return engine.analyze(args.query as string, results, {
        maxResults: (args.maxResults as number | undefined) ?? 10,
      });
    },
  );

  register(
    'mem-search',
    'Progressive memory search (layer 1): compact ranked index of matching episodes, token-efficient',
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results' },
        projectId: { type: 'string', description: 'Filter by project' },
      },
      required: ['query'],
    },
    async (args) => {
      const searcher = new ProgressiveMemorySearch(ctx.kernel.getEpisodicStore());
      return searcher.search(args.query as string, {
        limit: (args.limit as number | undefined) ?? 10,
        projectId: args.projectId as string | undefined,
      });
    },
  );

  register(
    'mem-get',
    'Fetch full observation details for specific memory IDs (layer 3 of progressive search)',
    {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Memory IDs from mem-search',
        },
      },
      required: ['ids'],
    },
    async (args) => {
      const searcher = new ProgressiveMemorySearch(ctx.kernel.getEpisodicStore());
      return searcher.getObservations((args.ids as string[]) ?? []);
    },
  );

  for (const tool of createCPTools(ctx.protocol)) {
    register(tool.name, tool.description, tool.inputSchema, tool.handler);
  }
}
