import type { Provenance, Confidence } from './provenance.js';

export interface Edge {
  id: string;
  source: string;
  target: string;
  relationship: string;

  valid_at: Date;
  invalid_at: Date | null;
  created_at: Date;
  expired_at: Date | null;

  provenance: Provenance;
  confidence: Confidence;

  source_episode: string;
}

export function createEdge(params: {
  source: string;
  target: string;
  relationship: string;
  provenance: Provenance;
  source_episode: string;
  valid_at?: Date;
  confidence?: number;
}): Edge {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    source: params.source,
    target: params.target,
    relationship: params.relationship,
    valid_at: params.valid_at ?? now,
    invalid_at: null,
    created_at: now,
    expired_at: null,
    provenance: params.provenance,
    confidence: { value: params.confidence ?? 1.0, method: 'consensus', calibration_history: [] },
    source_episode: params.source_episode,
  };
}
