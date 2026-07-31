import { VectorStore } from '../kernel/storage/vector-store.js';
import { GraphStore } from '../kernel/storage/graph-store.js';

export type TraceStepType = 'observation' | 'deduction' | 'induction' | 'abduction' | 'analogy' | 'hypothesis' | 'conclusion' | 'counterargument';

export interface ReasoningStep {
  id: string;
  type: TraceStepType;
  input: string;
  output: string;
  confidence: number;
  premises: string[];
  timestamp: number;
  tags: string[];
}

export interface ReasoningTrace {
  id: string;
  goal: string;
  steps: ReasoningStep[];
  conclusion: string | null;
  confidence: number;
  startedAt: number;
  completedAt: number | null;
  sessionId: string;
  tags: string[];
}

export class ReasoningTraceStore {
  private traces: Map<string, ReasoningTrace> = new Map();
  private vectors: VectorStore;
  private graph: GraphStore;

  constructor(vectors: VectorStore, graph: GraphStore) {
    this.vectors = vectors;
    this.graph = graph;
  }

  startTrace(goal: string, sessionId: string, tags: string[] = []): ReasoningTrace {
    const id = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const trace: ReasoningTrace = {
      id, goal, steps: [], conclusion: null, confidence: 0,
      startedAt: Date.now(), completedAt: null, sessionId, tags,
    };
    this.traces.set(id, trace);
    this.graph.addNode(id, 'reasoning-trace', goal.slice(0, 80), { sessionId, stepCount: 0 });
    return trace;
  }

  addStep(traceId: string, type: TraceStepType, input: string, output: string, confidence: number, premises: string[] = []): ReasoningStep | null {
    const trace = this.traces.get(traceId);
    if (!trace) return null;
    const step: ReasoningStep = {
      id: `step-${traceId}-${trace.steps.length}`,
      type, input, output, confidence, premises, timestamp: Date.now(), tags: trace.tags,
    };
    trace.steps.push(step);

    const stepNodeId = `step-${traceId}-${trace.steps.length - 1}`;
    this.graph.addNode(stepNodeId, 'reasoning-step', `${type}: ${output.slice(0, 60)}`, { type, confidence });

    if (trace.steps.length > 1) {
      const prevStepId = `step-${traceId}-${trace.steps.length - 2}`;
      this.graph.addEdge(`trace-seq-${prevStepId}-${stepNodeId}`, prevStepId, stepNodeId, 'leads-to', { type: 'sequence' });
    }

    for (const premise of premises) {
      const premiseNode = this.graph.searchNodes(premise.slice(0, 60));
      if (premiseNode.length > 0) {
        this.graph.addEdge(`premise-${stepNodeId}`, stepNodeId, premiseNode[0]!.id, 'uses-premise', { premise });
      }
    }

    return step;
  }

  concludeTrace(traceId: string, conclusion: string, confidence: number): boolean {
    const trace = this.traces.get(traceId);
    if (!trace) return false;
    trace.conclusion = conclusion;
    trace.confidence = confidence;
    trace.completedAt = Date.now();

    this.graph.addEdge(`trace-conclusion-${traceId}`, traceId, `conclusion-${traceId}`, 'concludes', { conclusion, confidence });
    return true;
  }

  getTrace(traceId: string): ReasoningTrace | undefined {
    return this.traces.get(traceId);
  }

  getTracesBySession(sessionId: string): ReasoningTrace[] {
    return [...this.traces.values()].filter(t => t.sessionId === sessionId);
  }

  getRecentTraces(limit = 10): ReasoningTrace[] {
    return [...this.traces.values()]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  getTraceStats(): { total: number; completed: number; steps: number } {
    const all = [...this.traces.values()];
    return {
      total: all.length,
      completed: all.filter(t => t.completedAt !== null).length,
      steps: all.reduce((sum, t) => sum + t.steps.length, 0),
    };
  }
}
