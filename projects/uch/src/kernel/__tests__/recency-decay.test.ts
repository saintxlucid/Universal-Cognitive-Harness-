import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RECENCY_DECAY,
  DEFAULT_FALLBACK,
  parseRecencyDecayEnv,
  resolveRecencyDecayMap,
  lookupDecayConfig,
  recencyBoost,
  recencyBoostForId,
  RecencyDecayParseError,
} from '../retrieval/recency-decay.js';

describe('recency-decay', () => {
  it('treats evergreen tiers as no boost', () => {
    expect(recencyBoost(0, DEFAULT_RECENCY_DECAY['concept']!)).toBe(0);
    expect(recencyBoost(100, DEFAULT_RECENCY_DECAY['concept']!)).toBe(0);
  });

  it('halves the component at halflife', () => {
    const cfg = { halflifeDays: 14, coefficient: 1.0 };
    expect(recencyBoost(0, cfg)).toBeCloseTo(1.0);
    expect(recencyBoost(14, cfg)).toBeCloseTo(0.5);
    expect(recencyBoost(28, cfg)).toBeCloseTo(1 / 3);
  });

  it('observations decay faster than structured episodes', () => {
    const at10Days = recencyBoostForId('episode:observation', 10, DEFAULT_RECENCY_DECAY);
    const structured = recencyBoostForId('episode:structured', 10, DEFAULT_RECENCY_DECAY);
    expect(at10Days).toBeGreaterThan(structured);
  });

  it('falls back for unknown ids', () => {
    expect(recencyBoostForId('unknown-thing', 90, DEFAULT_RECENCY_DECAY)).toBeCloseTo(DEFAULT_FALLBACK.coefficient / 2);
  });

  it('parses env overrides and merges over defaults', () => {
    const map = resolveRecencyDecayMap({ envValue: 'episode:7:2.0,concept:0:0' });
    expect(map['episode']).toEqual({ halflifeDays: 7, coefficient: 2.0 });
    expect(map['concept']).toEqual({ halflifeDays: 0, coefficient: 0 });
    expect(map['episode:observation']).toEqual(DEFAULT_RECENCY_DECAY['episode:observation']);
  });

  it('fails loud on malformed env entries', () => {
    expect(() => parseRecencyDecayEnv('garbage')).toThrow(RecencyDecayParseError);
    expect(() => parseRecencyDecayEnv('prefix:abc:1')).toThrow(RecencyDecayParseError);
    expect(() => parseRecencyDecayEnv('prefix:10:-1')).toThrow(RecencyDecayParseError);
  });

  it('looks up by longest-prefix match', () => {
    const map = {
      'episode': { halflifeDays: 60, coefficient: 1.0 },
      'episode:tool_call': { halflifeDays: 7, coefficient: 1.0 },
    };
    expect(lookupDecayConfig('episode:tool_call', map).halflifeDays).toBe(7);
    expect(lookupDecayConfig('episode:text', map).halflifeDays).toBe(60);
  });
});
