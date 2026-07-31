import type { Provenance } from '../kernel/types/provenance.js';

export type ActivityType =
  | 'observe' | 'understand' | 'remember' | 'retrieve'
  | 'predict' | 'plan' | 'reflect' | 'learn'
  | 'critique' | 'simulate' | 'execute' | 'verify'
  | 'compress' | 'consolidate' | 'sleep' | 'evolve'
  | 'converse' | 'search' | 'build' | 'test' | 'commit';

export interface ActivityContext {
  session_id: string;
  agent_id: string;
  workspace_id: string;
  project_id?: string;
  user_id?: string;
  neuromodulation?: {
    novelty: number;
    task_horizon: number;
    uncertainty: number;
    learning_rate: number;
    reward_sensitivity: number;
  };
  recent_activity_count?: number;
}

export interface ActivityEvidence {
  id: string;
  type: 'episode' | 'concept' | 'edge' | 'file' | 'tool_result' | 'external' | 'memory';
  source_id: string;
  description: string;
  relevance_score?: number;
  confidence?: number;
}

export interface ActivityToolUse {
  tool_name: string;
  input: unknown;
  output: unknown;
  duration_ms?: number;
  status: 'success' | 'failure' | 'running';
  error?: string;
}

export interface ActivityDecision {
  description: string;
  options: string[];
  chosen_index: number;
  rationale: string;
  confidence: number;
}

export interface ActivityOutcome {
  status: 'success' | 'failure' | 'partial' | 'cancelled' | 'running';
  summary: string;
  result?: unknown;
  error?: string;
  duration_ms?: number;
  metrics?: Record<string, number>;
}

export interface CognitiveActivity {
  id: string;
  timestamp: Date;
  type: ActivityType;
  goal?: string;
  inputs: Record<string, unknown>;
  context: ActivityContext;
  evidence: ActivityEvidence[];
  tools: ActivityToolUse[];
  decisions: ActivityDecision[];
  outcome: ActivityOutcome;
  provenance: Provenance;
  parent_id?: string;
  span_id?: string;
  trace_id?: string;
  tags?: string[];
  importance: number;
}

export function createActivity(params: {
  type: ActivityType;
  inputs?: Record<string, unknown>;
  context: ActivityContext;
  provenance: Provenance;
  goal?: string;
  parent_id?: string;
  trace_id?: string;
  importance?: number;
  tags?: string[];
}): CognitiveActivity {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type: params.type,
    goal: params.goal,
    inputs: params.inputs ?? {},
    context: params.context,
    evidence: [],
    tools: [],
    decisions: [],
    outcome: {
      status: 'running',
      summary: 'Activity started',
    },
    provenance: params.provenance,
    parent_id: params.parent_id,
    span_id: crypto.randomUUID(),
    trace_id: params.trace_id ?? crypto.randomUUID(),
    tags: params.tags,
    importance: params.importance ?? 0.5,
  };
}

export function completeActivity(
  activity: CognitiveActivity,
  outcome: Partial<ActivityOutcome>,
): CognitiveActivity {
  return {
    ...activity,
    outcome: {
      ...activity.outcome,
      ...outcome,
      duration_ms: outcome.duration_ms ?? Date.now() - activity.timestamp.getTime(),
      status: outcome.status ?? 'success',
    },
    timestamp: new Date(),
  };
}
