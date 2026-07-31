import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { createGenome, genomeSummary, type WorkspaceGenome } from './genome.js';
import { createWorkspaceIdentity, type WorkspaceIdentity } from './identity.js';
import {
  createWorldModel,
  addDecision,
  addSubsystem,
  worldModelSummary,
  type WorkspaceWorldModel,
  type DecisionRecord,
  type Subsystem,
} from './world-model.js';
import {
  ArchitectureGraph,
  type ArchitectureNode,
  type ArchitectureEdge,
} from './architecture-graph.js';
import { WorkspaceTimeline, type TimelineEvent, type TimelineEventType } from './timeline.js';
import { WorkspaceHealth, type HealthMetric } from './health.js';
import { MistakeLogger } from '../shared/mistake-logger.js';

export interface WorkspaceBrainConfig {
  workspace_id: string;
  name: string;
  root_path: string;
  eventBus: NeuralEventBus;
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
    return record;
  }

  recordArchitectureNode(node: ArchitectureNode): void {
    this.architecture.addNode(node);
    this.genome.architecture.module_count = this.architecture.getNodeCount();
  }

  recordArchitectureEdge(edge: ArchitectureEdge): void {
    this.architecture.addEdge(edge);
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
