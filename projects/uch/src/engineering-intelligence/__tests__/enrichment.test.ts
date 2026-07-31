import { describe, it, expect } from 'vitest';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import type { NeuralEvent } from '../../event-bus/neural-event-bus.js';
import {
  EngineeringEnrichment,
  ENGINEERING_WATCH_EVENTS,
  targetFromEvent,
} from '../enrichment/engineering-enrichment.js';

const event = (
  type: NeuralEvent['type'],
  payload: Record<string, unknown>,
): NeuralEvent => ({
  id: 'e1',
  type,
  timestamp: new Date(),
  source: 'test',
  payload,
});

describe('targetFromEvent', () => {
  it('extracts a code target from a diff payload', () => {
    const target = targetFromEvent(event('git:commit', {
      diff: '+const r = await fetch("https://api.example.com");',
      paths: ['src/client.ts'],
    }));
    expect(target?.kind).toBe('code');
    if (target?.kind === 'code') expect(target.paths).toEqual(['src/client.ts']);
  });

  it('extracts a prose target from a message payload', () => {
    const target = targetFromEvent(event('error:occurred', {
      message: 'The message broker has no failover and no standby.',
    }));
    expect(target?.kind).toBe('design');
  });

  it('returns null when the payload carries no evaluable content', () => {
    expect(targetFromEvent(event('file:saved', { path: 'x.ts' }))).toBeNull();
    expect(targetFromEvent(event('git:commit', {}))).toBeNull();
  });
});

describe('EngineeringEnrichment — event-bus middleware', () => {
  it('watches the documented code-change event set by default', () => {
    expect(ENGINEERING_WATCH_EVENTS).toContain('git:commit');
    expect(ENGINEERING_WATCH_EVENTS).toContain('file:saved');
    expect(ENGINEERING_WATCH_EVENTS).toContain('test:failed');
    expect(ENGINEERING_WATCH_EVENTS).toContain('build:failed');
    expect(ENGINEERING_WATCH_EVENTS).toContain('error:occurred');
  });

  it('publishes engineering:reviewed with veto info for a risky commit', async () => {
    const bus = new NeuralEventBus();
    const enrichment = new EngineeringEnrichment(bus);
    const reviewed: NeuralEvent[] = [];
    bus.subscribe('engineering:reviewed', (e) => { reviewed.push(e); });

    await bus.publish(event('git:commit', {
      diff: '+const r = await fetch("https://api.example.com/v1/users");\n+return await r.json();',
      paths: ['src/client.ts'],
    }));

    expect(reviewed).toHaveLength(1);
    const payload = reviewed[0]!.payload as Record<string, unknown>;
    expect(payload.trigger_type).toBe('git:commit');
    const review = payload.review as Record<string, unknown>;
    expect(review.veto_count).toBeGreaterThanOrEqual(1);
    const findings = payload.findings as Array<Record<string, unknown>>;
    expect(findings.some((f) => f.conceptId === 'failure.network-loss' && f.gate === 'veto')).toBe(true);
    expect(enrichment.getPublishedCount()).toBe(1);
    enrichment.dispose();
  });

  it('does not publish for clean payloads or empty events', async () => {
    const bus = new NeuralEventBus();
    const enrichment = new EngineeringEnrichment(bus);
    const reviewed: NeuralEvent[] = [];
    bus.subscribe('engineering:reviewed', (e) => { reviewed.push(e); });

    await bus.publish(event('git:commit', { diff: '+const x = 1;' }));
    await bus.publish(event('file:saved', { path: 'a.ts' }));

    expect(reviewed).toHaveLength(0);
    expect(enrichment.getPublishedCount()).toBe(0);
    enrichment.dispose();
  });

  it('marks veto-carrying reviews with high importance metadata', async () => {
    const bus = new NeuralEventBus();
    const enrichment = new EngineeringEnrichment(bus);
    const reviewed: NeuralEvent[] = [];
    bus.subscribe('engineering:reviewed', (e) => { reviewed.push(e); });

    await bus.publish(event('build:failed', {
      message: 'The system depends on a single database server for all writes.',
    }));

    expect(reviewed[0]?.metadata?.importance).toBe(8);
    enrichment.dispose();
  });

  it('unsubscribes on dispose', async () => {
    const bus = new NeuralEventBus();
    const enrichment = new EngineeringEnrichment(bus);
    const before = bus.getSubscriptionCount();
    enrichment.dispose();
    const after = bus.getSubscriptionCount();
    expect(after).toBe(before - ENGINEERING_WATCH_EVENTS.length);
  });
});
