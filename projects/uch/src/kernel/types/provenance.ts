export type SourceType = 'user' | 'tool_output' | 'model_inference' | 'retrieved_document' | 'system_log' | 'consolidation';

export interface Provenance {
  source: SourceType;
  source_id: string;
  timestamp: Date;
  reliability: number;
}

export interface Confidence {
  value: number;
  method: 'bayesian' | 'model_calibration' | 'consensus' | 'process_reliability';
  calibration_history: number[];
}

export type EntrenchmentLevel = 1 | 2 | 3 | 4 | 5;

export type EpistemicStatus = 'observation' | 'fact' | 'knowledge' | 'belief' | 'speculation' | 'rejected';

export interface TemporalWindow {
  valid_at: Date;
  invalid_at: Date | null;
  created_at: Date;
  expired_at: Date | null;
}

export function createProvenance(source: SourceType, sourceId: string, reliability = 1.0): Provenance {
  return { source, source_id: sourceId, timestamp: new Date(), reliability };
}

export function createConfidence(value: number, method: Confidence['method'] = 'model_calibration'): Confidence {
  return { value, method, calibration_history: [] };
}
