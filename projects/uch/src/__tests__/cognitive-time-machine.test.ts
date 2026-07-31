import { describe, it, expect } from 'vitest';
import { TraceLedger } from '../cognitive-plane/trace-engine/trace-ledger.js';
import { createTrace, addTraceEvent, endTrace } from '../cognitive-plane/trace-engine/cognitive-trace.js';
import { CognitiveTimeMachine, type BeliefEntry } from '../cognitive-plane/replay/cognitive-time-machine.js';

const T0 = new Date('2026-03-18T09:00:00Z');
const T1 = new Date('2026-03-18T10:00:00Z');
const T2 = new Date('2026-03-18T11:00:00Z');
const T3 = new Date('2026-03-18T12:00:00Z');

function buildLedger(): TraceLedger {
  const ledger = new TraceLedger();

  const session = createTrace({ name: 'session.start' });
  session.timestamp = T0;
  session.attributes = [{ key: 'payload.path', value: 'src/db.ts' }];
  const withDecision = addTraceEvent(session, { type: 'decision', attributes: [{ key: 'payload.title', value: 'use prisma' }] });
  withDecision.events[0]!.timestamp = T1;
  ledger.append(withDecision);

  const cacheBug = createTrace({ name: 'debug.cache' });
  cacheBug.timestamp = T2;
  const withHypothesis = addTraceEvent(cacheBug, {
    type: 'hypothesis',
    attributes: [{ key: 'payload.hypothesis', value: 'cache key collision causes stale reads' }],
  });
  withHypothesis.events[0]!.timestamp = T2;
  const withTestFail = addTraceEvent(withHypothesis, { type: 'test_fail', attributes: [{ key: 'payload.test', value: 'cache.test' }] });
  withTestFail.events[1]!.timestamp = T2;
  ledger.append(endTrace(withTestFail, 'error', 'stale read'));

  const lesson = createTrace({ name: 'reflection.run' });
  lesson.timestamp = T3;
  const withLesson = addTraceEvent(lesson, { type: 'reflection', attributes: [{ key: 'payload.lesson', value: 'hash cache keys by full query' }] });
  withLesson.events[0]!.timestamp = T3;
  ledger.append(endTrace(withLesson, 'ok'));

  return ledger;
}

describe('CognitiveTimeMachine.beliefsAt', () => {
  it('reconstructs the belief snapshot exactly as of a moment', () => {
    const machine = new CognitiveTimeMachine(buildLedger());

    const before = machine.beliefsAt(T1);
    expect(before.decisions.map((d) => d.statement)).toEqual(['use prisma']);
    expect(before.hypotheses).toHaveLength(0);
    expect(before.errors).toHaveLength(0);
    expect(before.lessons).toHaveLength(0);
    expect(before.files_touched).toEqual(['src/db.ts']);

    const after = machine.beliefsAt(T3);
    expect(after.decisions.map((d) => d.statement)).toEqual(['use prisma']);
    expect(after.hypotheses.map((h) => h.statement)).toEqual(['cache key collision causes stale reads']);
    expect(after.errors.map((e) => e.statement)).toEqual(['cache.test', 'stale read']);
    expect(after.lessons.map((l) => l.statement)).toEqual(['hash cache keys by full query']);
  });

  it('does not leak beliefs recorded after the query time', () => {
    const machine = new CognitiveTimeMachine(buildLedger());
    const mid = machine.beliefsAt(T2);
    expect(mid.lessons).toHaveLength(0);
    expect(mid.hypotheses).toHaveLength(1);
  });

  it('includes claims from an external claim source observed before the query time', () => {
    const machine = new CognitiveTimeMachine(buildLedger(), {
      claimsAt: () => [
        { statement: 'auth module stable', confidence: 0.9, first_observed: T0 },
        { statement: 'future claim', confidence: 0.5, first_observed: T3 },
      ],
    });
    const snapshot = machine.beliefsAt(T2);
    expect(snapshot.summary).toContain('auth module stable [90%]');
    expect(snapshot.summary.some((s) => s.includes('future claim'))).toBe(false);
  });
});

describe('CognitiveTimeMachine.beliefTimeline', () => {
  it('returns all beliefs chronologically', () => {
    const machine = new CognitiveTimeMachine(buildLedger());
    const timeline: BeliefEntry[] = machine.beliefTimeline();
    expect(timeline.map((e) => e.statement)).toEqual([
      'use prisma',
      'cache key collision causes stale reads',
      'cache.test',
      'stale read',
      'hash cache keys by full query',
    ]);
    const times = timeline.map((e) => e.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe('CognitiveTimeMachine.diffBeliefs', () => {
  it('reports statements gained between two moments', () => {
    const machine = new CognitiveTimeMachine(buildLedger());
    const { gained, removed } = machine.diffBeliefs(T1, T3);
    expect(gained.map((e) => e.statement)).toEqual([
      'cache key collision causes stale reads',
      'cache.test',
      'stale read',
      'hash cache keys by full query',
    ]);
    expect(removed).toHaveLength(0);
  });

  it('reports statements lost between two moments', () => {
    const machine = new CognitiveTimeMachine(buildLedger());
    const { removed } = machine.diffBeliefs(T3, T1);
    expect(removed.map((e) => e.statement)).toEqual([
      'cache key collision causes stale reads',
      'cache.test',
      'stale read',
      'hash cache keys by full query',
    ]);
  });
});

describe('CognitiveTimeMachine empty state', () => {
  it('returns an empty snapshot for an empty ledger', () => {
    const machine = new CognitiveTimeMachine(new TraceLedger());
    const snapshot = machine.beliefsAt(new Date());
    expect(snapshot.decisions).toHaveLength(0);
    expect(snapshot.summary).toHaveLength(0);
    expect(machine.beliefTimeline()).toHaveLength(0);
  });
});
