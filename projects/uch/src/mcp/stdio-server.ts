import * as readline from 'node:readline';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { LLMClient } from '../llm/provider.js';
import { Embedder } from '../embeddings/embedder.js';
import { SessionManager } from '../session/manager.js';
import { GitIngester } from '../git/ingester.js';
import { ScientificMemory } from '../cognitive-plane/memory/scientific-memory.js';
import { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';

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
  private tools: Map<string, Tool> = new Map();
  private initialized = false;
  private rl: readline.Interface | null = null;

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
    this.registerTools();
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

    this.registerTool('summarize', 'Summarize text using LLM', {
      type: 'object', properties: { text: { type: 'string', description: 'Text to summarize' }, maxWords: { type: 'number', description: 'Max words' } }, required: ['text'],
    }, async (args) => {
      if (!this.llm.isAvailable) return { error: 'No LLM configured. Set OPENAI_API_KEY.' };
      return { summary: await this.llm.summarize(args.text as string, (args.maxWords as number) ?? 100) };
    });

    this.registerTool('extract-concepts', 'Extract key concepts from text', {
      type: 'object', properties: { text: { type: 'string', description: 'Text to analyze' } }, required: ['text'],
    }, async (args) => {
      if (!this.llm.isAvailable) return { error: 'No LLM configured' };
      return { concepts: await this.llm.extractConcepts(args.text as string) };
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
