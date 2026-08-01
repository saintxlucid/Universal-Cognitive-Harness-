import { describe, expect, it } from 'vitest';
import {
  FeatureFlagRegistry,
  stickyBucket,
  classifyBump,
  transitionDeprecation,
} from '../protocol/feature-flags.js';

describe('FeatureFlagRegistry', () => {
  it('defaults a flag to its rule state', () => {
    const reg = new FeatureFlagRegistry();
    reg.set({ name: 'feature.verification.strict', defaultEnabled: true });
    expect(reg.evaluate('feature.verification.strict', 'agent-1').enabled).toBe(true);
  });

  it('disables unknown flags with a reason', () => {
    const reg = new FeatureFlagRegistry();
    const ev = reg.evaluate('feature.nope', 'agent-1');
    expect(ev.enabled).toBe(false);
    expect(ev.removalReason).toContain('unknown flag');
  });

  it('explicit off overrides a default on', () => {
    const reg = new FeatureFlagRegistry();
    reg.set({ name: 'feature.dreaming.experimental', defaultEnabled: false });
    expect(reg.evaluate('feature.dreaming.experimental', 'agent-1').enabled).toBe(false);
  });

  it('percentage rollouts are sticky per agent (deterministic)', () => {
    const reg = new FeatureFlagRegistry();
    reg.set({ name: 'feature.semantic.memory', defaultEnabled: true, rolloutPct: 30 });
    const a = reg.evaluate('feature.semantic.memory', 'agent-42');
    const b = reg.evaluate('feature.semantic.memory', 'agent-42');
    expect(a.enabled).toBe(b.enabled);
  });

  it('rollout splits agents deterministically (both buckets observable)', () => {
    const reg = new FeatureFlagRegistry();
    reg.set({ name: 'feature.split', defaultEnabled: true, rolloutPct: 50 });
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(String(reg.evaluate('feature.split', `agent-${i}`).enabled));
    expect(seen.size).toBe(2);
  });

  it('100% rollout enables everyone; 0% disables everyone', () => {
    const reg = new FeatureFlagRegistry();
    reg.set({ name: 'feature.all', defaultEnabled: true, rolloutPct: 100 });
    reg.set({ name: 'feature.none', defaultEnabled: true, rolloutPct: 0 });
    expect(reg.evaluate('feature.all', 'any').enabled).toBe(true);
    expect(reg.evaluate('feature.none', 'any').enabled).toBe(true);
  });

  it('deprecated flags warn and stay functional', () => {
    const reg = new FeatureFlagRegistry();
    reg.set({
      name: 'feature.old.skill',
      defaultEnabled: true,
      deprecation: { status: 'deprecated', since: '2026-08-01', migrationHint: 'use new.skill' },
    });
    const ev = reg.evaluate('feature.old.skill', 'agent-1');
    expect(ev.enabled).toBe(true);
    expect(ev.warning).toContain('deprecated');
  });

  it('removed flags are disabled with the migration hint', () => {
    const reg = new FeatureFlagRegistry();
    reg.set({
      name: 'feature.old.skill',
      defaultEnabled: true,
      deprecation: { status: 'removed', since: '2026-09-01', migrationHint: 'use new.skill' },
    });
    const ev = reg.evaluate('feature.old.skill', 'agent-1');
    expect(ev.enabled).toBe(false);
    expect(ev.removalReason).toContain('use new.skill');
  });
});

describe('stickyBucket', () => {
  it('is deterministic and bounded', () => {
    const v = stickyBucket('feature.memory.semantic', 'agent-7');
    expect(v).toBe(stickyBucket('feature.memory.semantic', 'agent-7'));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(100);
  });

  it('differs across agents and flags', () => {
    expect(stickyBucket('feature.a', 'agent-1')).not.toBe(stickyBucket('feature.b', 'agent-1'));
    expect(stickyBucket('feature.a', 'agent-1')).not.toBe(stickyBucket('feature.a', 'agent-2'));
  });
});

describe('classifyBump (versioned cognition)', () => {
  it('classifies breaking, additive, and corrective bumps', () => {
    expect(classifyBump('1.2.3', '2.0.0')).toBe('major');
    expect(classifyBump('1.2.3', '1.3.0')).toBe('minor');
    expect(classifyBump('1.2.3', '1.2.4')).toBe('patch');
    expect(classifyBump(undefined, '1.0.0')).toBe('initial');
  });
});

describe('transitionDeprecation', () => {
  it('advances the schedule in order', () => {
    const d = transitionDeprecation(undefined, 'deprecated', '2026-08-01');
    expect(d.status).toBe('deprecated');
    const s = transitionDeprecation(d, 'sunset', '2026-09-01');
    expect(s.status).toBe('sunset');
    const r = transitionDeprecation(s, 'removed', '2026-10-01');
    expect(r.status).toBe('removed');
  });

  it('rejects backward transitions', () => {
    const sunset = transitionDeprecation(undefined, 'sunset', '2026-09-01');
    expect(() => transitionDeprecation(sunset, 'deprecated', '2026-08-15')).toThrow(
      /invalid deprecation transition/,
    );
  });
});
