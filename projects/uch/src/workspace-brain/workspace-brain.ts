import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { createGenome, genomeSummary, type WorkspaceGenome } from './genome.js';
import { createWorkspaceIdentity, type WorkspaceIdentity } from './identity.js';
import {
  createWorldModel,
  addDecision,
  worldModelSummary,
  type WorkspaceWorldModel,
  type DecisionRecord,
} from './world-model.js';
import {
  ArchitectureGraph,
  type ArchitectureNode,
  type ArchitectureEdge,
} from './architecture-graph.js';
import { WorkspaceTimeline, type TimelineEvent } from './timeline.js';
import { WorkspaceHealth } from './health.js';
import { MistakeLogger } from '../shared/mistake-logger.js';
import { WorkspaceKnowledgeGraph } from '../workspace-graphs/knowledge-graph.js';
import { WorkspaceDecisionGraph } from '../workspace-graphs/decision-graph.js';
import { WorkspaceTaskGraph } from '../workspace-graphs/task-graph.js';
import { WorkspaceEvolutionHistory } from '../workspace-graphs/evolution-history.js';
import { WorkspaceDNA } from '../workspace-graphs/workspace-dna.js';
import { join } from 'node:path';

export interface WorkspaceBrainConfig {
  workspace_id: string;
  name: string;
  root_path: string;
  eventBus: NeuralEventBus;
  organsBasePath?: string;
}

export class WorkspaceBrain {
  readonly genome: WorkspaceGenome;
  readonly identity: WorkspaceIdentity;
  readonly worldModel: WorkspaceWorldModel;
  readonly architecture: ArchitectureGraph;
  readonly timeline: WorkspaceTimeline;
  readonly health: WorkspaceHealth;
  readonly mistakeLogger: MistakeLogger;
  private eventBus: NeuralEventBus;

  private _knowledgeGraph: WorkspaceKnowledgeGraph | null = null;
  private _decisionGraph: WorkspaceDecisionGraph | null = null;
  private _taskGraph: WorkspaceTaskGraph | null = null;
  private _evolutionHistory: WorkspaceEvolutionHistory | null = null;
  private _dna: WorkspaceDNA | null = null;
  private readonly organsBase: string;

  // Lazy organ getters: eager GraphStore construction would write SQLite at
  // construction time — the existing suite constructs WorkspaceBrain with fake
  // root_paths, so eager construction would create drive-root directories.
  // Lazy getters preserve the attach-point semantics with zero I/O until first
  // access or first matching event.
  get knowledgeGraph(): WorkspaceKnowledgeGraph {
    if (!this._knowledgeGraph) this._knowledgeGraph = new WorkspaceKnowledgeGraph(join(this.organsBase, 'graphs'));
    return this._knowledgeGraph;
  }

  get decisionGraph(): WorkspaceDecisionGraph {
    if (!this._decisionGraph) this._decisionGraph = new WorkspaceDecisionGraph(join(this.organsBase, 'graphs'));
    return this._decisionGraph;
  }

  get taskGraph(): WorkspaceTaskGraph {
    if (!this._taskGraph) this._taskGraph = new WorkspaceTaskGraph(join(this.organsBase, 'graphs'));
    return this._taskGraph;
  }

  get evolutionHistory(): WorkspaceEvolutionHistory {
    if (!this._evolutionHistory) this._evolutionHistory = new WorkspaceEvolutionHistory(join(this.organsBase, 'graphs'));
    return this._evolutionHistory;
  }

  get dna(): WorkspaceDNA {
    if (!this._dna) this._dna = new WorkspaceDNA(this.identity.workspace_id, this.identity.name);
    return this._dna;
  }

  constructor(config: WorkspaceBrainConfig) {
    this.genome = createGenome({
      workspace_id: config.workspace_id,
      name: config.name,
      root_path: config.root_path,
    });
    this.identity = createWorkspaceIdentity({
      workspace_id: config.workspace_id,
      name: config.name,
    });
    this.worldModel = createWorldModel();
    this.architecture = new ArchitectureGraph();
    this.timeline = new WorkspaceTimeline();
    this.health = new WorkspaceHealth();
    this.mistakeLogger = new MistakeLogger();
    this.eventBus = config.eventBus;
    this.organsBase = config.organsBasePath ?? join(config.root_path, '.uccp', 'persist');

    // Initialize health metrics
    this.health.setMetric('test_pass_rate', 1.0, 0.8, '%');
    this.health.setMetric('lint_errors', 0, 0, 'count', false);
    this.health.setMetric('security_vulnerabilities', 0, 0, 'count', false);
    this.health.setMetric('dependency_health', 1.0, 0.7, '%');

    this.eventBus.subscribeToProtocol('memory:ingest', async (event) => {
      const observation = String(event.payload.observation ?? '');
      if (!observation) return;
      this.timeline.addEvent({
        type: 'milestone',
        timestamp: new Date(),
        title: 'Memory ingest',
        description: observation,
        tags: ['memory', 'protocol'],
        metadata: { observation },
      });
    });

    this.eventBus.subscribeToProtocol('module:handoff', async (event) => {
      const intent = String(event.payload.intent ?? 'handoff');
      const message = String(event.payload.message ?? '');
      const normalizedIntent = intent.toLowerCase();
      const normalizedMessage = message.toLowerCase();
      const isFailureSignal =
        normalizedIntent.includes('error') ||
        normalizedIntent.includes('failure') ||
        normalizedIntent.includes('fail') ||
        normalizedMessage.includes('failed') ||
        normalizedMessage.includes('error') ||
        normalizedMessage.includes('failure');

      if (!isFailureSignal || !message) return;

      const existing = this.mistakeLogger.hasSeen(intent, message);
      if (existing) return;

      this.mistakeLogger.recordMistake({
        source: 'workspace-brain',
        intent,
        message,
        severity: 'critical',
      });

      if (!this.worldModel.known_failures.includes(message)) {
        this.worldModel.known_failures.push(message);
      }
      this.worldModel.open_issues_count = Math.max(
        this.worldModel.open_issues_count,
        this.worldModel.known_failures.length,
      );
      this.worldModel.last_updated = new Date();

      this.timeline.addEvent({
        type: 'incident',
        timestamp: new Date(),
        title: `Incident: ${intent}`,
        description: message,
        tags: ['incident', 'handoff'],
        metadata: { intent, message },
      });
    });

    this.dna.recompute(this.dnaInputs());

    this.eventBus.subscribe('file:saved', async (event) => {
      const path = String(event.payload?.path ?? '');
      if (!path) return;
      this.knowledgeGraph.recordArtifact(path, {
        language: String(event.payload?.language ?? ''),
        lines: typeof event.payload?.lines === 'number' ? event.payload.lines : undefined,
      });
    });

    this.eventBus.subscribe('git:commit', async (event) => {
      const hash = String(event.payload?.hash ?? `commit-${event.timestamp.getTime()}`);
      const message = String(event.payload?.message ?? '');
      const files = Array.isArray(event.payload?.files)
        ? (event.payload.files as unknown[]).map((f) => String(f)).filter(Boolean)
        : [];
      this.knowledgeGraph.recordCommit(hash, message, files);
    });

    this.eventBus.subscribe('build:finished', async (event) => {
      this.knowledgeGraph.recordBuild(String(event.payload?.id ?? event.id));
    });

    this.eventBus.subscribe(['test:failed', 'error:occurred'], async (event) => {
      const message = String(event.payload?.message ?? event.payload?.test ?? '');
      if (!message) return;
      this.knowledgeGraph.recordFailure(event.id, message, event.type === 'test:failed' ? 'test' : 'error');
    });

    this.eventBus.subscribe('pr:created', async (event) => {
      this.knowledgeGraph.recordPr(
        String(event.payload?.number ?? event.payload?.id ?? event.id),
        String(event.payload?.title ?? ''),
        String(event.payload?.url ?? ''),
      );
    });

    this.eventBus.subscribe('review:requested', async (event) => {
      this.knowledgeGraph.recordReview(
        String(event.payload?.id ?? event.id),
        String(event.payload?.pr_number ?? event.payload?.pr_id ?? ''),
      );
    });
  }

  private dnaInputs(): Record<string, unknown> {
    const byStatus: Record<string, number> = {};
    for (const d of this.worldModel.decisions) {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
    }
    return {
      genome: this.genome,
      standards: this.worldModel.standards,
      decisions: { count: this.worldModel.decisions.length, byStatus },
    };
  }

  addDecision(decision: Omit<DecisionRecord, 'id' | 'date'>): DecisionRecord {
    const record = addDecision(this.worldModel, decision);
    this.timeline.addEvent({
      type: 'decision',
      timestamp: new Date(),
      title: `Decision: ${decision.title}`,
      description: decision.rationale,
      tags: ['decision'],
      metadata: { decision_id: record.id },
    });
    this.decisionGraph.recordDecision(record.id, record.title);
    this.dna.recompute(this.dnaInputs());
    return record;
  }

  recordArchitectureNode(node: ArchitectureNode): void {
    this.architecture.addNode(node);
    this.genome.architecture.module_count = this.architecture.getNodeCount();
  }

  recordArchitectureEdge(edge: ArchitectureEdge): void {
    this.architecture.addEdge(edge);
  }

  async persistWorkspace(): Promise<void> {
    const base = join(this.organsBase);
    this.dna.recompute(this.dnaInputs());
    await this.knowledgeGraph.persist(join(base, 'knowledge-graph.json'));
    await this.decisionGraph.persist(join(base, 'decision-graph.json'));
    await this.taskGraph.persist(join(base, 'task-graph.json'));
    await this.evolutionHistory.persist(join(base, 'evolution-history.json'));
    await this.dna.persist(join(base, 'workspace-dna.json'));
  }

  async loadWorkspace(): Promise<number> {
    const base = join(this.organsBase);
    let restored = 0;
    restored += await this.knowledgeGraph.load(join(base, 'knowledge-graph.json'));
    restored += await this.decisionGraph.load(join(base, 'decision-graph.json'));
    restored += await this.taskGraph.load(join(base, 'task-graph.json'));
    restored += await this.evolutionHistory.load(join(base, 'evolution-history.json'));
    restored += await this.dna.load(join(base, 'workspace-dna.json'));
    return restored;
  }

  close(): void {
    this._knowledgeGraph?.close();
    this._decisionGraph?.close();
    this._taskGraph?.close();
    this._evolutionHistory?.close();
    this._knowledgeGraph = null;
    this._decisionGraph = null;
    this._taskGraph = null;
    this._evolutionHistory = null;
  }

  logTimelineEvent(event: Omit<TimelineEvent, 'id'>): TimelineEvent {
    return this.timeline.addEvent(event);
  }

  updateHealthMetric(name: string, value: number, threshold: number, unit: string): void {
    this.health.setMetric(name, value, threshold, unit);
  }

  summary(): string {
    return [
      '=== Workspace Brain ===',
      genomeSummary(this.genome),
      '',
      `Identity: ${this.identity.name} — ${this.identity.mission}`,
      `Personality: ${this.identity.personality.naming_convention} naming, ${this.identity.personality.test_style} tests`,
      '',
      worldModelSummary(this.worldModel),
      '',
      this.health.summary(),
      '',
      `Timeline events: ${this.timeline.getEventCount()}`,
      `Architecture nodes: ${this.architecture.getNodeCount()}, edges: ${this.architecture.getEdgeCount()}`,
    ].join('\n');
  }
}
