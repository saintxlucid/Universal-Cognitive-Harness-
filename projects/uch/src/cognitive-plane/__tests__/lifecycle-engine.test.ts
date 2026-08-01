import { describe, expect, it } from 'vitest';
import {
  LIFECYCLE_STAGES,
  STAGE_GATES,
  ALLOWED_TRANSITIONS,
  LifecycleRegistry,
  type LifecycleStage,
} from '../lifecycle/lifecycle-engine.js';

describe('LifecycleEngine stages', () => {
  it('has exactly the 8 canonical stages in order', () => {
    expect(LIFECYCLE_STAGES).toEqual([
      'idea',
      'research',
      'prototype',
      'experiment',
      'production',
      'legacy',
      'archive',
      'extinct',
    ]);
  });

  it('gates late stages on evidence', () => {
    expect(STAGE_GATES.experiment).toEqual(['prototype', 'verification']);
    expect(STAGE_GATES.production).toEqual(['verification', 'benchmark', 'review']);
  });

  it('allows rollback transitions only with the rollback flag', () => {
    const rollbacks = ALLOWED_TRANSITIONS.filter((t) => t.rollback).map((t) => `${t.from}->${t.to}`);
    expect(rollbacks).toContain('research->idea');
    expect(rollbacks).toContain('prototype->research');
    expect(rollbacks).toContain('archive->legacy');
    expect(ALLOWED_TRANSITIONS.some((t) => t.rollback && t.to === 'extinct')).toBe(false);
  });
});

describe('LifecycleRegistry', () => {
  it('registers objects at idea and reports stage', () => {
    const reg = new LifecycleRegistry();
    reg.register('mem-1', 'memory');
    expect(reg.get('mem-1')).toMatchObject({ objectId: 'mem-1', kind: 'memory', stage: 'idea' });
  });

  it('transitions with required evidence', () => {
    const reg = new LifecycleRegistry();
    reg.register('rfc-1', 'rfc');
    expect(reg.transition('rfc-1', 'research', ['register'], 1)).toBe(true);
    expect(reg.transition('rfc-1', 'prototype', ['register', 'prototype'], 2)).toBe(true);
    expect(reg.get('rfc-1')?.stage).toBe('prototype');
  });

  it('refuses transitions missing evidence', () => {
    const reg = new LifecycleRegistry();
    reg.register('rfc-2', 'rfc');
    reg.transition('rfc-2', 'research', ['register'], 1);
    expect(reg.transition('rfc-2', 'experiment', ['prototype'], 2)).toBe(false);
    expect(reg.get('rfc-2')?.stage).toBe('research');
  });

  it('refuses illegal transitions', () => {
    const reg = new LifecycleRegistry();
    reg.register('obj', 'skill');
    expect(reg.transition('obj', 'extinct', [], 1)).toBe(false);
    expect(reg.transition('obj', 'production', ['verification', 'benchmark', 'review'], 1)).toBe(false);
    expect(reg.transition('missing', 'research', ['register'], 1)).toBe(false);
  });

  it('keeps extinct objects as lineage stubs', () => {
    const reg = new LifecycleRegistry();
    reg.register('obj', 'belief');
    reg.transition('obj', 'research', ['register'], 1);
    reg.transition('obj', 'prototype', ['register', 'prototype'], 2);
    reg.transition('obj', 'experiment', ['prototype', 'verification'], 3);
    reg.transition('obj', 'archive', [], 4);
    reg.transition('obj', 'extinct', [], 5);
    expect(reg.get('obj')?.stage).toBe('extinct');
    expect(reg.transition('obj', 'legacy', ['usage'], 6)).toBe(false);
    expect(reg.journalFor('obj')).toHaveLength(5);
  });

  it('supports rollback transitions with evidence', () => {
    const reg = new LifecycleRegistry();
    reg.register('doc', 'rfc');
    reg.transition('doc', 'research', ['register'], 1);
    expect(reg.transition('doc', 'idea', [], 2)).toBe(true);
    expect(reg.get('doc')?.stage).toBe('idea');
  });

  it('journals every transition with evidence and tick', () => {
    const reg = new LifecycleRegistry();
    reg.register('x', 'organ');
    reg.transition('x', 'research', ['register'], 10);
    const journal = reg.journalFor('x');
    expect(journal).toEqual([
      { objectId: 'x', from: 'idea', to: 'research', evidence: ['register'], atTick: 10 },
    ]);
  });

  it('lists objects by stage', () => {
    const reg = new LifecycleRegistry();
    reg.register('a', 'skill');
    reg.register('b', 'skill');
    reg.transition('a', 'research', ['register'], 1);
    expect(reg.listAtStage('idea').map((e) => e.objectId)).toEqual(['b']);
    expect(reg.listAtStage('research').map((e) => e.objectId)).toEqual(['a']);
  });

  it('does not double-transition to the same stage', () => {
    const reg = new LifecycleRegistry();
    reg.register('c', 'belief');
    expect(reg.transition('c', 'research', ['register'], 1)).toBe(true);
    expect(reg.transition('c', 'research', ['register'], 2)).toBe(false);
  });

  it('exercises a full SOP-08 ladder walk', () => {
    const reg = new LifecycleRegistry();
    reg.register('rfc-9', 'rfc');
    const walk: Array<[LifecycleStage, readonly (keyof typeof STAGE_GATES extends infer _ ? string : never)[], number]> = [
      ['research', ['register'], 1],
      ['prototype', ['register', 'prototype'], 2],
      ['experiment', ['prototype', 'verification'], 3],
      ['production', ['verification', 'benchmark', 'review'], 4],
      ['legacy', ['usage'], 5],
      ['archive', [], 6],
      ['extinct', [], 7],
    ];
    for (const [to, evidence, tick] of walk) {
      expect(reg.transition('rfc-9', to, evidence, tick)).toBe(true);
    }
    expect(reg.get('rfc-9')?.stage).toBe('extinct');
  });
});
