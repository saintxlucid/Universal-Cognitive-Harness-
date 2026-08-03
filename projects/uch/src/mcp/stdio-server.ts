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
import { InferenceFabric, CognitiveScheduler } from '../accelerators/index.js';
import { CPServer, createDefaultCPServer } from '../protocol/index.js';
import { FrameworkTraceRecorder } from '../cognitive-plane/frameworks/tracing/trace-recorder.js';
import { FrameworkDecisionJournal } from '../cognitive-plane/frameworks/journal/decision-journal.js';
import { PackageStore } from '../control-plane/packages/index.js';
import type { MCPToolContext, Tool, ToolRegistrar } from './tools/types.js';
import { registerCoreTools } from './tools/core-tools.js';
import { registerPackageTools } from './tools/package-tools.js';
import { registerFrameworkTools } from './tools/framework-tools.js';

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
    this.gitIngester =
      config.gitIngester ?? new GitIngester({ kernel: this.kernel, llm: this.llm });
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

  private toolContext(): MCPToolContext {
    return {
      kernel: this.kernel,
      bio: this.bio,
      embedder: this.embedder,
      sessionManager: this.sessionManager,
      gitIngester: this.gitIngester,
      scientificMemory: this.scientificMemory,
      constitution: this.constitution,
      fabric: this.fabric,
      scheduler: this.scheduler,
      llm: this.llm,
      protocol: this.protocol,
      frameworkTracer: this.frameworkTracer,
      frameworkJournal: this.frameworkJournal,
      getPackageStore: () => this.getPackageStore(),
      persistPackageStore: (store) => this.persistPackageStore(store),
    };
  }

  private registerTools(): void {
    const register: ToolRegistrar = (name, description, inputSchema, handler) =>
      this.registerTool(name, description, inputSchema, handler);
    const ctx = this.toolContext();
    registerCoreTools(ctx, register);
    registerPackageTools(ctx, register);
    registerFrameworkTools(ctx, register);
  }

  private registerTool(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ): void {
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
      this.sendMessage({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      });
      return;
    }

    if (msg.method === 'initialize') {
      this.initialized = true;
      this.sendMessage({
        jsonrpc: '2.0',
        id: msg.id,
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
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
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
          jsonrpc: '2.0',
          id: msg.id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
        });
      } catch (err) {
        this.sendMessage({
          jsonrpc: '2.0',
          id: msg.id,
          error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
        });
      }
      return;
    }

    if (msg.method === 'resources/list') {
      this.sendMessage({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          resources: [
            {
              uri: 'uch://cognitive/state',
              name: 'Cognitive State',
              description: 'Current system state',
              mimeType: 'application/json',
            },
            {
              uri: 'uch://sessions',
              name: 'Sessions',
              description: 'Saved sessions',
              mimeType: 'application/json',
            },
          ],
        },
      });
      return;
    }

    if (msg.method === 'resources/read') {
      const uri = msg.params?.uri as string;
      if (uri === 'uch://cognitive/state') {
        this.sendMessage({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(this.kernel.getStats(), null, 2),
              },
            ],
          },
        });
        return;
      }
      if (uri === 'uch://sessions') {
        this.sendMessage({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(this.sessionManager.listSessions(), null, 2),
              },
            ],
          },
        });
        return;
      }
      this.sendMessage(this.errorResponse(msg.id, -32602, `Unknown resource: ${uri}`));
      return;
    }

    if (msg.method === 'prompts/list') {
      this.sendMessage({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          prompts: [
            { name: 'cognitive-status', description: 'Current cognitive state', arguments: [] },
            { name: 'session-summary', description: 'Summarize current session', arguments: [] },
          ],
        },
      });
      return;
    }

    if (msg.method === 'prompts/get') {
      const promptName = msg.params?.name as string;
      if (promptName === 'cognitive-status') {
        const stats = this.kernel.getStats();
        this.sendMessage({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            messages: [
              {
                role: 'assistant',
                content: {
                  type: 'text',
                  text: `Episodes: ${stats.episodes}\nConcepts: ${stats.concepts}\nRelationships: ${stats.relationships}\nBeliefs: ${stats.beliefs}\nSleep: ${stats.sleep_cycles}`,
                },
              },
            ],
          },
        });
        return;
      }
      if (promptName === 'session-summary') {
        const session = this.sessionManager.getSession();
        this.sendMessage({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            messages: [
              {
                role: 'assistant',
                content: {
                  type: 'text',
                  text: session
                    ? `Active session: ${session.id}\nTool: ${session.toolName}\nMemories: ${session.memories.length}\nConversation turns: ${session.conversation.length}`
                    : 'No active session',
                },
              },
            ],
          },
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
        this.sendMessage({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32603, message: String(err) },
        });
      }
    });
    this.rl.on('close', () => process.exit(0));
  }

  stop(): void {
    this.rl?.close();
  }
}
