import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { LLMClient } from '../llm/provider.js';
import { Embedder } from '../embeddings/embedder.js';
import { SessionManager } from '../session/manager.js';
import { GitIngester } from '../git/ingester.js';
import { ScientificMemory } from '../cognitive-plane/memory/scientific-memory.js';
import { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';
import { DecisionLog } from '../cognitive-plane/decisions/decision-log.js';
import { WorkspaceContextGatherer } from '../context/gatherer.js';
import { MCPStdioServer } from '../mcp/stdio-server.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type AgentTool =
  | 'claude-code' | 'codex' | 'opencode' | 'cursor' | 'copilot'
  | 'windsurf' | 'antigravity' | 'vscode' | 'unknown';

export interface AgentPluginConfig {
  workspaceRoot?: string;
  workspaceId?: string;
  workspaceName?: string;
  toolName?: AgentTool | string;
  persistencePath?: string;
  autoIngestGit?: boolean;
  maxEpisodes?: number;
}

export interface AgentContext {
  message?: string;
  currentFile?: string;
  currentProblem?: string;
  recentFiles?: string[];
  gitChanges?: string;
  sessionAge: number;
  relevantMemory: string;
}

export class UCHAgentPlugin {
  readonly kernel: CognitiveKernel;
  readonly eventBus: NeuralEventBus;
  readonly workspace: WorkspaceBrain;
  readonly executive: ExecutiveBrain;
  readonly bio: BiologicalFunctions;
  readonly llm: LLMClient;
  readonly embedder: Embedder;
  readonly sessionManager: SessionManager;
  readonly gitIngester: GitIngester;
  readonly scientificMemory: ScientificMemory;
  readonly constitution: CognitiveConstitution;
  readonly decisionLog: DecisionLog;
  readonly mcpStdio: MCPStdioServer;
  readonly contextGatherer: WorkspaceContextGatherer;

  readonly config: Required<AgentPluginConfig>;
  readonly startedAt: Date;

  private _agentName: string;
  private autoIngestDone = false;

  constructor(config?: AgentPluginConfig) {
    this.startedAt = new Date();
    const workspaceRoot = config?.workspaceRoot ?? process.cwd();
    const wsId = config?.workspaceId ?? path.basename(workspaceRoot) + '-' + Date.now().toString(36);

    this.config = {
      workspaceRoot,
      workspaceId: wsId,
      workspaceName: config?.workspaceName ?? path.basename(workspaceRoot),
      toolName: config?.toolName ?? this.detectTool(),
      persistencePath: config?.persistencePath ?? '.uccp/persist',
      autoIngestGit: config?.autoIngestGit ?? true,
      maxEpisodes: config?.maxEpisodes ?? 10000,
    };

    this._agentName = String(this.config.toolName);

    this.eventBus = new NeuralEventBus();
    this.kernel = new CognitiveKernel({
      agent_id: 'uch',
      user_id: 'agent',
      project_id: this.config.workspaceId,
      persistence_path: this.config.persistencePath,
    });
    this.workspace = new WorkspaceBrain({
      workspace_id: this.config.workspaceId,
      name: this.config.workspaceName,
      root_path: this.config.workspaceRoot,
      eventBus: this.eventBus,
    });
    this.executive = new ExecutiveBrain({ eventBus: this.eventBus });
    this.bio = new BiologicalFunctions(this.kernel, this.workspace, this.executive);
    this.llm = new LLMClient();
    this.embedder = new Embedder({ provider: this.llm });
    this.sessionManager = new SessionManager({ kernel: this.kernel });
    this.gitIngester = new GitIngester({ kernel: this.kernel, llm: this.llm, repoPath: this.config.workspaceRoot });
    this.scientificMemory = new ScientificMemory();
    this.constitution = new CognitiveConstitution();
    this.decisionLog = new DecisionLog();

    this.contextGatherer = new WorkspaceContextGatherer(this.config.workspaceRoot);

    this.mcpStdio = new MCPStdioServer({
      kernel: this.kernel,
      bio: this.bio,
      executive: this.executive,
      workspace: this.workspace,
      llm: this.llm,
      embedder: this.embedder,
      sessionManager: this.sessionManager,
      gitIngester: this.gitIngester,
      scientificMemory: this.scientificMemory,
      constitution: this.constitution,
    });

    this.sessionManager.startSession(this._agentName, this.config.workspaceId);
  }

  private detectTool(): AgentTool {
    const env = process.env;
    if (env.CLAUDE_CODE) return 'claude-code';
    if (env.CODEX_API_KEY) return 'codex';
    if (env.OPENCODE) return 'opencode';
    if (env.CURSOR) return 'cursor';
    if (env.GITHUB_COPILOT) return 'copilot';
    if (env.WINDSURF) return 'windsurf';
    if (env.ANTIGRAVITY) return 'antigravity';
    return 'unknown';
  }

  get agentName(): string { return this._agentName; }
  get toolName(): string { return String(this.config.toolName); }
  get isReady(): boolean { return this.kernel.getStats().episodes >= 0; }

  get uptime(): number {
    return Date.now() - this.startedAt.getTime();
  }

  /** Boot the full cognitive stack — call once at agent startup */
  async boot(): Promise<this> {
    const startTime = Date.now();

    await this.kernel.init();
    this.kernel.startSleep();

    if (this.llm.isAvailable) {
      console.error(`[uch] LLM ${this.llm.provider}:${this.llm.modelName} — embeddings: enabled`);
    } else {
      console.error('[uch] No API key — using local embeddings');
    }

    if (this.config.autoIngestGit && !this.autoIngestDone) {
      try {
        const gitResult = await this.gitIngester.ingestRecent(50);
        this.autoIngestDone = true;
        if (gitResult.commits > 0) {
          console.error(`[uch] Git: ${gitResult.commits} commits ingested`);
        }
      } catch {
        // Not a git repo or git not available — skip silently
      }
    }

    const bootMs = Date.now() - startTime;
    console.error(`[uch] Booted in ${bootMs}ms — ${this.kernel.getStats().episodes} episodes`);

    return this;
  }

  /** Called before every agent message — gathers relevant context */
  async getContext(message?: string, options?: {
    currentFile?: string;
    currentProblem?: string;
  }): Promise<AgentContext> {
    const recentFiles: string[] = [];

    const context: AgentContext = {
      message,
      currentFile: options?.currentFile,
      currentProblem: options?.currentProblem,
      recentFiles,
      sessionAge: this.uptime,
      relevantMemory: '',
    };

    if (message) {
      const episodes = this.kernel.getRecentEpisodes(30);
      const items = episodes.map((e) => ({
        id: e.id,
        text: typeof e.content === 'object' && e.content !== null
          ? JSON.stringify(e.content) : String(e.content),
      }));

      if (items.length > 0) {
        if (this.embedder.available) {
          const results = await this.embedder.search(message, items, 3);
          context.relevantMemory = results.map((r) =>
            `[related:${r.score.toFixed(2)}] ${(r.item as { text: string }).text}`
          ).join('\n');
        } else {
          context.relevantMemory = this.kernel.recallFormatted({ text: message });
        }
      }
    }

    this.sessionManager.addEntry({
      role: 'user',
      content: message ?? '(no message)',
      metadata: { tool: this._agentName, currentFile: options?.currentFile },
    });

    return context;
  }

  /** Called after every agent response — learns from the interaction */
  async learnFromInteraction(userMessage: string, assistantResponse: string): Promise<void> {
    const episode = await this.kernel.remember({
      content: { type: 'observation', observation: `Q: ${userMessage}\nA: ${assistantResponse.slice(0, 500)}` },
      provenance: { source: 'tool_output', reliability: 0.8 },
    });

    if (this.llm.isAvailable && userMessage.length > 50) {
      try {
        const concepts = await this.llm.extractConcepts(userMessage);
        for (const concept of concepts.slice(0, 5)) {
          this.kernel.addConcept({
            name: concept,
            concept_type: 'entity',
            definition: userMessage.slice(0, 200),
            importance: 0.5,
          });
        }
      } catch {
        // Concept extraction is best-effort
      }
    }
  }

  /** Record a decision made during the session */
  recordDecision(title: string, description: string, alternatives?: string[]): string {
    const id = crypto.randomUUID();
    this.sessionManager.addMemory({
      key: `decision-${id.slice(0, 8)}`,
      value: `${title}: ${description}`,
      type: 'decision',
      importance: 0.8,
    });

    this.kernel.addConcept({
      name: `decision:${title.slice(0, 40)}`,
      concept_type: 'entity',
      definition: description,
      purpose: `Decision made during ${this._agentName} session`,
      importance: 0.8,
    });

    return id;
  }

  /** Record a project convention learned during the session */
  recordConvention(convention: string, tags?: string[]): void {
    this.sessionManager.addMemory({
      value: convention,
      type: 'convention',
      importance: 0.7,
    });

    this.scientificMemory.store({
      key: `convention:${Date.now()}`,
      value: convention,
      source: this._agentName,
      memoryType: 'convention',
      certainty: 'likely',
      confidence: 0.7,
      tags: [...(tags ?? []), 'convention'],
    });
  }

  /** Save current session and return a portable handoff document */
  async saveAndHandoff(name?: string): Promise<{ sessionPath: string; handoff: string }> {
    const sessionPath = await this.sessionManager.saveSession(name ?? this._agentName);
    const handoff = this.sessionManager.exportSessionHandoff();
    return { sessionPath, handoff };
  }

  /** Load a previous session — bridges across agent tools */
  async loadSession(sessionName: string): Promise<boolean> {
    const session = await this.sessionManager.loadSession(sessionName);
    if (!session) return false;

    for (const mem of session.memories) {
      if (mem.type === 'decision' || mem.type === 'convention') {
        try {
          this.kernel.remember({
            content: { type: 'observation', observation: `[${mem.type}] ${mem.value}` },
            provenance: { source: 'tool_output', reliability: 0.9 },
          });
        } catch { /* skip individual failures */ }
      }
    }

    return true;
  }

  /** Gather rich workspace context — projects, git, configs, env */
  async gatherContext(): Promise<string> {
    try {
      return await this.contextGatherer.summary();
    } catch {
      return 'Workspace context unavailable';
    }
  }

  /** Get a summary of what this agent session knows */
  getSummary(): Record<string, unknown> {
    const stats = this.kernel.getStats();
    const session = this.sessionManager.getSession();
    return {
      tool: this._agentName,
      uptime: this.uptime,
      llm: this.llm.isAvailable ? `${this.llm.provider}:${this.llm.modelName}` : 'none',
      episodes: stats.episodes,
      concepts: stats.concepts,
      decisions: session?.memories.filter((m) => m.type === 'decision').length ?? 0,
      conventions: session?.memories.filter((m) => m.type === 'convention').length ?? 0,
      conversations: session?.conversation.length ?? 0,
    };
  }

  /** Graceful shutdown */
  async shutdown(): Promise<void> {
    this.kernel.stopSleep();
    await this.kernel.shutdown();
  }
}
