import type { Provenance, Confidence, EntrenchmentLevel, EpistemicStatus, TemporalWindow } from './provenance.js';

export type ConceptType = 'entity' | 'relation' | 'process' | 'quality' | 'value';

export interface Concept {
  id: string;
  name: string;
  concept_type: ConceptType;

  purpose: string;
  definition: string;

  is_a: string[];
  part_of: string[];
  causes: string[];
  precedes: string[];
  requires: string[];
  contradicts: string[];

  provenance: Provenance;
  temporal: TemporalWindow;

  confidence: Confidence;
  entrenchment: EntrenchmentLevel;
  epistemic_status: EpistemicStatus;

  importance: number;
  access_count: number;
  last_access: Date;
  prediction_value: number;
  emotional_weight: number;

  embedding: number[];
  sparse_hash: bigint[];

  created_at: Date;
  updated_at: Date;
}

export function createConcept(params: {
  name: string;
  concept_type: ConceptType;
  definition: string;
  provenance: Provenance;
  purpose?: string;
  importance?: number;
  prediction_value?: number;
}): Concept {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    name: params.name,
    concept_type: params.concept_type,
    purpose: params.purpose ?? '',
    definition: params.definition,
    is_a: [],
    part_of: [],
    causes: [],
    precedes: [],
    requires: [],
    contradicts: [],
    provenance: params.provenance,
    temporal: {
      valid_at: now,
      invalid_at: null,
      created_at: now,
      expired_at: null,
    },
    confidence: { value: 1.0, method: 'model_calibration', calibration_history: [] },
    entrenchment: 3,
    epistemic_status: 'observation',
    importance: params.importance ?? 0.5,
    access_count: 0,
    last_access: now,
    prediction_value: params.prediction_value ?? 0.5,
    emotional_weight: 0,
    embedding: [],
    sparse_hash: [],
    created_at: now,
    updated_at: now,
  };
}
