import { describe, it, expect } from 'vitest';
import { auditCodePrinciples } from '../code/code-principles.js';

describe('Clean Code Principles audit', () => {
  it('passes a clean, documented, surgical change', () => {
    const r = auditCodePrinciples({
      intent: 'Extend the canonical validate() helper',
      change: 'Reuses the shared helper, simple single-function change, intent documented, only what is required now.',
    });
    expect(r.verdict).toBe('clean');
    expect(r.score).toBeGreaterThanOrEqual(7);
  });

  it('flags SOC violation for a god object', () => {
    const r = auditCodePrinciples({
      change: 'UserService handles auth, database, email, and payments — everything in one god class',
    });
    const soc = r.principles.find((p) => p.principle === 'soc');
    expect(soc?.score).toBeLessThan(7);
    expect(r.verdict).toBe('revise');
  });

  it('flags DRY violation for duplication', () => {
    const r = auditCodePrinciples({ change: 'Copy the same tax logic into twenty files, duplicated' });
    const dry = r.principles.find((p) => p.principle === 'dry');
    expect(dry?.score).toBeLessThan(7);
  });

  it('flags KISS violation for speculative machinery', () => {
    const r = auditCodePrinciples({
      change: 'Build microservices with distributed caching and a plugin framework just in case',
    });
    const kiss = r.principles.find((p) => p.principle === 'kiss');
    expect(kiss?.score).toBeLessThan(7);
  });

  it('flags YAGNI violation for hypothetical features', () => {
    const r = auditCodePrinciples({
      change: 'Build 12 extension systems and a config engine for future features we might need',
    });
    const yagni = r.principles.find((p) => p.principle === 'yagni');
    expect(yagni?.score).toBeLessThan(7);
  });

  it('flags DYC violation for undocumented intent', () => {
    const r = auditCodePrinciples({ change: 'No documentation, magic numbers, obscure logic' });
    const dyc = r.principles.find((p) => p.principle === 'dyc');
    expect(dyc?.score).toBeLessThan(7);
  });

  it('surfaces the trade-off layer', () => {
    const r = auditCodePrinciples({ change: 'duplicated logic' });
    expect(r.tradeOffs.some((t) => t.tradeOff === 'DRY vs KISS')).toBe(true);
    expect(r.recommendations.some((rec) => rec.includes('Trade-off'))).toBe(true);
  });
});
