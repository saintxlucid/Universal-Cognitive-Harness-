import { describe, expect, it } from 'vitest';
import {
  EngineeringLearningLoop,
  MIN_SLEEP_ACTIVATIONS,
  TASTE_PENALTY,
} from '../learning/learning-loop.js';
import { DreamScan, DREAM_KEYWORDS } from '../learning/dream-scan.js';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import { TasteEngine } from '../../cognitive-plane/taste/taste-engine.js';
import type { EngineeringReview } from '../types.js';

const review = (overrides: Partial<EngineeringReview> = {}): EngineeringReview => ({
  targetId: 't1',
  findings: [],
  score: 0.95,
  summary: 'clean',
  ...overrides,
});

describe('EngineeringLearningLoop', () => {
  it('counts concept activations across reviews', () => {
    const loop = new EngineeringLearningLoop();
    loop.record(
      review({
        findings: [
          {
            tier: 'tier-02-se',
            severity: 'warning',
            conceptId: 'se.coupling',
            message: 'x',
            evidence: [],
            suggestion: [],
            gate: 'advisory',
          },
          {
            tier: 'tier-02-se',
            severity: 'info',
            conceptId: 'se.naming',
            message: 'y',
            evidence: [],
            suggestion: [],
            gate: 'advisory',
          },
        ],
      }),
      1,
    );
    loop.record(
      review({
        findings: [
          {
            tier: 'tier-02-se',
            severity: 'warning',
            conceptId: 'se.coupling',
            message: 'x',
            evidence: [],
            suggestion: [],
            gate: 'advisory',
          },
        ],
      }),
      2,
    );
    const acts = loop.getActivations();
    expect(acts.find((a) => a.conceptId === 'se.coupling')?.count).toBe(2);
    expect(acts.find((a) => a.conceptId === 'se.naming')?.count).toBe(1);
  });

  it('offers only sufficiently activated concepts to the sleep cycle', () => {
    const loop = new EngineeringLearningLoop();
    loop.record(
      review({
        findings: [
          {
            tier: 'tier-02-se',
            severity: 'warning',
            conceptId: 'se.spof',
            message: 'x',
            evidence: [],
            suggestion: [],
            gate: 'veto',
          },
          {
            tier: 'tier-02-se',
            severity: 'info',
            conceptId: 'se.one',
            message: 'y',
            evidence: [],
            suggestion: [],
            gate: 'advisory',
          },
        ],
      }),
      1,
    );
    loop.record(
      review({
        findings: [
          {
            tier: 'tier-02-se',
            severity: 'warning',
            conceptId: 'se.spof',
            message: 'x',
            evidence: [],
            suggestion: [],
            gate: 'veto',
          },
        ],
      }),
      2,
    );
    const patterns = loop.getDominantPerProblemType();
    expect(patterns.some((p) => p.engine === 'se.spof')).toBe(true);
    expect(patterns.some((p) => p.engine === 'se.one')).toBe(false);
    expect(patterns[0]?.count).toBeGreaterThanOrEqual(MIN_SLEEP_ACTIVATIONS);
  });

  it('reinforces taste on clean reviews, penalizes on vetoes', () => {
    const taste = new TasteEngine();
    const loop = new EngineeringLearningLoop(null, taste);
    loop.record(review(), 1);
    loop.record(
      review({
        findings: [
          {
            tier: 'tier-08-failure',
            severity: 'blocking',
            conceptId: 'failure.spof',
            message: 'x',
            evidence: [],
            suggestion: [],
            gate: 'veto',
          },
        ],
      }),
      2,
    );
    const prefs = taste.getAllPreferences();
    const reinforce = prefs.find((p) => p.dimension === 'code-elegance');
    const penalty = prefs.find((p) => p.dimension === 'architecture-beauty');
    expect(reinforce?.score).toBeGreaterThan(0.9);
    expect(penalty?.score).toBe(TASTE_PENALTY);
  });

  it('emits connectome:link events on repeated activations', async () => {
    const bus = new NeuralEventBus();
    const loop = new EngineeringLearningLoop(bus);
    const links: string[] = [];
    bus.subscribe('connectome:link', (e) => links.push(String(e.payload?.from)), undefined, 'test');
    loop.record(
      review({
        findings: [
          {
            tier: 'tier-01-cs',
            severity: 'warning',
            conceptId: 'cs.complexity',
            message: 'x',
            evidence: [],
            suggestion: [],
            gate: 'advisory',
          },
        ],
      }),
      1,
    );
    loop.record(
      review({
        findings: [
          {
            tier: 'tier-01-cs',
            severity: 'warning',
            conceptId: 'cs.complexity',
            message: 'x',
            evidence: [],
            suggestion: [],
            gate: 'advisory',
          },
        ],
      }),
      2,
    );
    expect(links).toContain('cs.complexity');
    expect(loop.getStats().connectomeLinks).toBe(1);
  });

  it('ingests engineering:reviewed bus events when attached', async () => {
    const bus = new NeuralEventBus();
    const loop = new EngineeringLearningLoop(bus);
    loop.attach();
    await bus.publish({
      type: 'engineering:reviewed',
      source: 'engineering-enrichment',
      payload: {
        trigger_id: 'evt-1',
        review: { score: 60, summary: 's', finding_count: 1, veto_count: 0 },
        findings: [
          { conceptId: 'se.coupling', gate: 'advisory', severity: 'warning', message: 'm' },
        ],
      },
    });
    const stats = loop.getStats();
    expect(stats.reviews).toBe(1);
    expect(stats.activations).toBe(1);
    loop.dispose();
  });

  it('exposes sleep-cycle consumption contract (framework pattern shape)', () => {
    const loop = new EngineeringLearningLoop();
    loop.record(
      review({
        findings: [
          {
            tier: 'tier-01-cs',
            severity: 'info',
            conceptId: 'cs.x',
            message: 'x',
            evidence: [],
            suggestion: [],
            gate: 'advisory',
          },
        ],
      }),
      1,
    );
    loop.record(
      review({
        findings: [
          {
            tier: 'tier-01-cs',
            severity: 'info',
            conceptId: 'cs.x',
            message: 'x',
            evidence: [],
            suggestion: [],
            gate: 'advisory',
          },
        ],
      }),
      2,
    );
    const patterns = loop.getDominantPerProblemType();
    expect(patterns[0]).toMatchObject({ problemType: 'engineering', engine: 'cs.x' });
  });
});

describe('DreamScan (Tier X dream engine)', () => {
  it('finds silent debt in a seeded corpus', async () => {
    const scan = new DreamScan();
    const report = await scan.scan({
      traces: [
        {
          trace_id: 't1',
          name: 'fix-auth',
          span_id: 's1',
          parent_span_id: null,
          status: 'ok',
          started_at: new Date('2026-01-01'),
          ended_at: new Date('2026-01-01'),
          attributes: {},
          events: [
            {
              id: 'e1',
              timestamp: new Date(),
              type: 'diagnostic',
              span_id: 's1',
              attributes: [{ key: 'message', value: 'temporary hack for auth timeout' }],
            },
          ],
          metadata: {},
        },
      ],
    });
    expect(report.suggestions.some((s) => s.cls === 'silent-debt')).toBe(true);
    expect(report.suggestions[0]?.conceptId).toBe('unknown.silent-debt');
    expect(scan.getLastReport()?.suggestions.length).toBe(report.suggestions.length);
  });

  it('detects duplicate trace names as duplicate concepts', async () => {
    const scan = new DreamScan();
    const trace = (id: string) => ({
      trace_id: id,
      name: 'same-op',
      span_id: `s-${id}`,
      parent_span_id: null,
      status: 'ok',
      started_at: new Date('2026-01-01'),
      ended_at: new Date('2026-01-01'),
      attributes: {},
      events: [],
      metadata: {},
    });
    const report = await scan.scan({ traces: [trace('a'), trace('b')] });
    const dup = report.suggestions.find((s) => s.cls === 'duplicate-concepts');
    expect(dup).toBeDefined();
    expect(dup?.severity).toBe('major');
  });

  it('emits suggestion events on the bus', async () => {
    const bus = new NeuralEventBus();
    const scan = new DreamScan(bus);
    const seen: string[] = [];
    bus.subscribe('suggestion', (e) => seen.push(String(e.payload?.class)), undefined, 'test');
    await scan.scan({
      traces: [
        {
          trace_id: 't1',
          name: 'migrate-to-v2',
          span_id: 's1',
          parent_span_id: null,
          status: 'error',
          started_at: new Date(),
          ended_at: new Date(),
          attributes: {},
          events: [
            {
              id: 'e1',
              timestamp: new Date(),
              type: 'diagnostic',
              span_id: 's1',
              attributes: [{ key: 'message', value: 'vendor lock-in risk during migrate' }],
            },
          ],
          metadata: {},
        },
      ],
    });
    expect(seen).toContain('migration-risks');
  });

  it('is deterministic: same input, same suggestions', async () => {
    const input = {
      traces: [
        {
          trace_id: 't1',
          name: 'hacky-fix',
          span_id: 's1',
          parent_span_id: null,
          status: 'ok',
          started_at: new Date('2026-01-01'),
          ended_at: new Date('2026-01-01'),
          attributes: {},
          events: [
            {
              id: 'e1',
              timestamp: new Date(),
              type: 'diagnostic',
              span_id: 's1',
              attributes: [{ key: 'message', value: 'workaround for now' }],
            },
          ],
          metadata: {},
        },
      ],
    };
    const a = await new DreamScan().scan(input);
    const b = await new DreamScan().scan(input);
    expect(a.suggestions).toEqual(b.suggestions);
  });

  it('classifies every keyword family deterministically', () => {
    const classes = Object.keys(DREAM_KEYWORDS);
    expect(classes).toHaveLength(6);
    for (const cls of classes) {
      expect(DREAM_KEYWORDS[cls as keyof typeof DREAM_KEYWORDS].length).toBeGreaterThan(0);
    }
  });
});
