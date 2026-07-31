/**
 * Takes / Calibration system (hindsight-wave inspired).
 *
 * The brain records gradeable claims (takes) with conviction, grades them
 * against reality, and aggregates the record into a calibration profile
 * that surfaces wherever advice gets given.
 *
 * Modules:
 *   - takes.ts          — TakeFence: add / resolve / query gradeable claims
 *   - calibration.ts    — computeCalibrationProfile: Brier score, scorecards,
 *                         narratives, bias tags, cold-start branch
 *   - voice-gate.ts     — gateVoice / gateWithFallback: conversational voice
 *                         guardrails (friend-not-doctor)
 *   - store.ts          — CalibrationStore: JSON-file persistence
 */

export { TakeFence, QUALITY_VALUES } from './takes.js';
export type { Take, TakeQuality, AddTakeInput, ResolveTakeInput } from './takes.js';
export { computeCalibrationProfile, brierForTake } from './calibration.js';
export type { CalibrationProfile, ScorecardRow, ConvictionBucket, CalibrationOptions } from './calibration.js';
export { gateVoice, gateWithFallback, fallbackTemplate } from './voice-gate.js';
export type { VoiceGateResult, VoiceGateOptions, VoiceMode } from './voice-gate.js';
export { CalibrationStore } from './store.js';
