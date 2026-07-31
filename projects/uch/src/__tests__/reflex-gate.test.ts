import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NervousSystem } from '../nervous-system/nervous-system.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import type { NeuralEvent } from '../event-bus/neural-event-bus.js';
import type { GraphNode } from '../kernel/storage/graph-store.js';
import { ReflexGate, PAIN_ESCALATION_THRESHOLD } from '../reflex/gate.js';
import { createReflexChecks } from '../reflex/checks.js';
import type {
  ReflexCheck,
  ReflexEvidence,
  ReflexResult,
  WriteProposal,
  ZoneAffectProvider,
} from '../reflex/types.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'uch-rg-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function makeProposal(overrides?: Partial<WriteProposal>): WriteProposal {
  return {
    tool: 'file-editor',
    target: 'src/legacy/user-manager.ts',
    content: 'export class UserManager2 {}\n',
    ...overrides,
  };
}

function blockEvidence(): ReflexEvidence {
  return {
    check_id: 'duplicate-abstraction',
    rule: 'duplicate-abstraction-overlap',
    level: 'block',
    evidence: ['file:src/legacy/user-manager.ts'],
    threshold: 'overlap>=0.6',
    reason: 'x overlaps existing artifact user-manager',
  };
}

function deferEvidence(checkId = 'complexity-threshold'): ReflexEvidence {
  return {
    check_id: checkId,
    rule: 'function-count-defer',
    level: 'defer',
    evidence: ['functions:25'],
    threshold: 'functions>=25',
    reason: '25 functions',
  };
}

function makeBlockingCheck(): ReflexCheck {
  return { id: 'duplicate-abstraction', rule: 'duplicate-abstraction-overlap', evaluate: () => blockEvidence() };
}

function makeDeferringCheck(checkId = 'complexity-threshold'): ReflexCheck {
  return { id: checkId, rule: 'function-count-defer', evaluate: () => deferEvidence(checkId) };
}

function makePassingCheck(id = 'pass-check'): ReflexCheck {
  return { id, rule: 'pass', evaluate: () => null };
}

function artifactNode(id: string, name: string): GraphNode {
  return { id, type: 'artifact', name, properties: {}, created_at: 1 };
}

describe('ReflexGate', () => {
  it('returns allow with checks_run when no check flags', () => {
    const gate = new ReflexGate({ checks: [makePassingCheck()] });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('allow');
    expect(result.checks_run).toContain('pass-check');
    expect(result.evidence.length).toBe(0);
  });

  it('returns block when a check returns block evidence', () => {
    const gate = new ReflexGate({ checks: [makeBlockingCheck()] });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('block');
    expect(result.evidence[0]!.check_id).toBe('duplicate-abstraction');
    expect(result.evidence[0]!.evidence).toContain('file:src/legacy/user-manager.ts');
    expect(result.target).toBe('src/legacy/user-manager.ts');
  });

  it('returns defer when only defer evidence exists', () => {
    const gate = new ReflexGate({ checks: [makeDeferringCheck()] });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('defer');
  });

  it('block wins over defer', () => {
    const gate = new ReflexGate({ checks: [makeDeferringCheck('defer-a'), makeBlockingCheck()] });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('block');
    expect(result.evidence.length).toBe(2);
  });

  it('is synchronous', () => {
    const gate = new ReflexGate({ checks: [makePassingCheck()] });
    const result = gate.evaluate(makeProposal());
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.duration_ms).toBe('number');
    expect(typeof result.verdict).toBe('string');
  });

  it('is deterministic across repeated evaluations', () => {
    const gate = new ReflexGate({ checks: [makeDeferringCheck('defer-a'), makeBlockingCheck()] });
    const first = gate.evaluate(makeProposal());
    const second = gate.evaluate(makeProposal());
    const third = gate.evaluate(makeProposal());
    // duration_ms is a real timing measurement — determinism covers verdict,
    // checks, evidence, override, and target, not wall-clock ms.
    const stripTiming = (r: ReflexResult) => ({ ...r, duration_ms: 0 });
    expect(stripTiming(second)).toEqual(stripTiming(first));
    expect(stripTiming(third)).toEqual(stripTiming(first));
  });

  it('register appends checks and getChecks reflects the registry', () => {
    const gate = new ReflexGate();
    gate.register(makeDeferringCheck('check-a'));
    gate.register(makeBlockingCheck());
    expect(gate.getChecks().map((c) => c.id)).toEqual(['check-a', 'duplicate-abstraction']);
  });
});

describe('ReflexGate escape hatch', () => {
  it('override by name suppresses a block and records it', () => {
    const gate = new ReflexGate({
      checks: [makeBlockingCheck()],
      override: { enabled: true, names: ['duplicate-abstraction'] },
    });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('allow');
    expect(result.override?.name).toBe('duplicate-abstraction');
    expect(result.override?.recorded).toBe(true);
  });

  it('override records the violation to the event sink', () => {
    const events: Array<Omit<NeuralEvent, 'id' | 'timestamp'>> = [];
    const gate = new ReflexGate({
      checks: [makeBlockingCheck()],
      override: { enabled: true, names: ['duplicate-abstraction'] },
      eventSink: (ev) => { events.push(ev); },
    });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('allow');
    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('governance:event_denied');
    const payload = events[0]!.payload as { override?: { name: string; recorded: boolean } };
    expect(payload.override).toEqual({ name: 'duplicate-abstraction', recorded: true });
  });

  it('override * suppresses all checks', () => {
    const gate = new ReflexGate({
      checks: [makeBlockingCheck()],
      override: { enabled: true, names: ['*'] },
    });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('allow');
    expect(result.override?.name).toBe('duplicate-abstraction');
  });

  it('unrelated override names do not suppress', () => {
    const gate = new ReflexGate({
      checks: [makeBlockingCheck()],
      override: { enabled: true, names: ['other-check'] },
    });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('block');
    expect(result.override).toBeUndefined();
  });
});

describe('ReflexGate zone affect (pain seam)', () => {
  it('zoneAffect is read once per evaluate and passed to checks', () => {
    const zoneAffect = vi.fn<ZoneAffectProvider>((_z: string) => 0);
    let seen: number | null = null;
    const probe: ReflexCheck = {
      id: 'zone-probe',
      rule: 'zone-probe',
      evaluate: (_proposal, ctx) => {
        seen = ctx.zoneAffect('src/legacy');
        return null;
      },
    };
    const gate = new ReflexGate({ checks: [probe], zoneAffect });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('allow');
    expect(zoneAffect).toHaveBeenCalledWith('src/legacy');
    expect(zoneAffect).toHaveBeenCalledTimes(1);
    expect(seen).toBe(0);
  });

  it('escalates defer to block when zone affect >= threshold', () => {
    expect(PAIN_ESCALATION_THRESHOLD).toBe(0.7);
    const gate = new ReflexGate({ checks: [makeDeferringCheck()], zoneAffect: () => 0.9 });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('block');
  });

  it('does not escalate below threshold', () => {
    const gate = new ReflexGate({ checks: [makeDeferringCheck()], zoneAffect: () => 0.5 });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('defer');
  });

  it('explicit proposal.zone overrides path-derived zone', () => {
    const zoneAffect = vi.fn<ZoneAffectProvider>((_z: string) => 0);
    const gate = new ReflexGate({ checks: [makePassingCheck()], zoneAffect });
    gate.evaluate(makeProposal({ zone: 'src/legacy' }));
    expect(zoneAffect).toHaveBeenCalledWith('src/legacy');
  });
});

describe('ReflexGate recording', () => {
  it('emits interrupt signal on block', async () => {
    const ns = new NervousSystem({ trackEnergy: false });
    const gate = new ReflexGate({
      checks: [makeBlockingCheck()],
      signalSink: (sig) => { void ns.emit(sig).catch(() => {}); },
    });
    gate.evaluate(makeProposal());
    await new Promise((r) => setTimeout(r, 0));
    const pending = ns.getPendingInterrupts(1);
    expect(pending.some((s) => s.type === 'error:occurred' && s.interrupt === true)).toBe(true);
  });

  it('publishes governance:event_denied on block', async () => {
    const bus = new NeuralEventBus();
    const received: NeuralEvent[] = [];
    bus.subscribe('governance:event_denied', (ev) => { received.push(ev); });
    const gate = new ReflexGate({
      checks: [makeBlockingCheck()],
      eventSink: (ev) => { void bus.publish(ev); },
    });
    gate.evaluate(makeProposal());
    await new Promise((r) => setTimeout(r, 0));
    expect(received.length).toBe(1);
    const payload = received[0]!.payload as Record<string, unknown>;
    expect(payload.gate).toBe('reflex');
    expect(payload.tool).toBe('file-editor');
    expect(payload.target).toBe('src/legacy/user-manager.ts');
    expect(payload.check_id).toBe('duplicate-abstraction');
    expect(payload.rule).toBe('duplicate-abstraction-overlap');
    expect(payload.evidence).toContain('file:src/legacy/user-manager.ts');
    expect(payload.threshold).toBe('overlap>=0.6');
    expect(typeof payload.reason).toBe('string');
  });

  it('publishes review:requested on defer', async () => {
    const bus = new NeuralEventBus();
    const received: NeuralEvent[] = [];
    bus.subscribe('review:requested', (ev) => { received.push(ev); });
    const gate = new ReflexGate({
      checks: [makeDeferringCheck()],
      eventSink: (ev) => { void bus.publish(ev); },
    });
    gate.evaluate(makeProposal());
    await new Promise((r) => setTimeout(r, 0));
    expect(received.length).toBe(1);
    const payload = received[0]!.payload as { checks?: string[] };
    expect(payload.checks).toContain('complexity-threshold');
  });

  it('publishes tool:called on allow', async () => {
    const bus = new NeuralEventBus();
    const received: NeuralEvent[] = [];
    bus.subscribe('tool:called', (ev) => { received.push(ev); });
    const gate = new ReflexGate({
      checks: [makePassingCheck()],
      eventSink: (ev) => { void bus.publish(ev); },
    });
    gate.evaluate(makeProposal());
    await new Promise((r) => setTimeout(r, 0));
    expect(received.length).toBe(1);
    expect(received[0]!.type).toBe('tool:called');
    const payload = received[0]!.payload as { verdict?: string; checks_run?: string[] };
    expect(payload.verdict).toBe('allow');
    expect(Array.isArray(payload.checks_run)).toBe(true);
  });

  it('records nothing when no sinks are configured', () => {
    const gate = new ReflexGate({ checks: [makeBlockingCheck()] });
    const result = gate.evaluate(makeProposal());
    expect(result.verdict).toBe('block');
    expect(result.evidence.length).toBe(1);
  });
});

describe('ReflexGate duplicate-abstraction check', () => {
  it('blocks UserManager2-style duplicate basename', () => {
    const artifact = artifactNode('file:src/legacy/user-manager.ts', 'user-manager.ts');
    const knowledgeGraph = {
      search: (q: string) => (q === 'user' || q === 'manager' ? [artifact] : []),
      findArtifacts: () => [artifact],
    };
    const gate = new ReflexGate({ checks: createReflexChecks({ knowledgeGraph }) });
    const result = gate.evaluate(makeProposal({ target: 'src/user-manager2.ts' }));
    expect(result.verdict).toBe('block');
    expect(result.evidence[0]!.evidence).toContain('file:src/legacy/user-manager.ts');
    expect(result.evidence[0]!.threshold).toBe('overlap>=0.6');
  });

  it('passes when no overlapping artifact exists', () => {
    const knowledgeGraph = { search: () => [], findArtifacts: () => [] };
    const gate = new ReflexGate({ checks: createReflexChecks({ knowledgeGraph }) });
    const result = gate.evaluate(makeProposal({ target: 'src/user-manager2.ts' }));
    expect(result.verdict).toBe('allow');
  });

  it('passes when no graphs are provided', () => {
    const gate = new ReflexGate({ checks: createReflexChecks({}) });
    const result = gate.evaluate(makeProposal({ target: 'src/user-manager2.ts' }));
    expect(result.verdict).toBe('allow');
    expect(result.checks_run).toContain('duplicate-abstraction');
  });

  it('evidence includes decision-graph hits too', () => {
    const decision = { id: 'decision:user-manager-2', type: 'decision', name: 'user-manager-2', properties: {}, created_at: 1 };
    const knowledgeGraph = { search: () => [], findArtifacts: () => [] };
    const decisionGraph = { search: (q: string) => (q === 'user' ? [decision] : []) };
    const gate = new ReflexGate({ checks: createReflexChecks({ knowledgeGraph, decisionGraph }) });
    const result = gate.evaluate(makeProposal({ target: 'src/user-manager2.ts' }));
    expect(result.verdict).toBe('block');
    expect(result.evidence[0]!.evidence).toContain('decision:user-manager-2');
  });

  it('token overlap below 0.6 passes', () => {
    const auth = artifactNode('file:src/auth.ts', 'auth');
    const knowledgeGraph = {
      search: (q: string) => (q === 'auth' ? [auth] : []),
      findArtifacts: () => [auth],
    };
    const gate = new ReflexGate({ checks: createReflexChecks({ knowledgeGraph }) });
    const result = gate.evaluate(makeProposal({ target: 'src/auth-login.ts' }));
    expect(result.verdict).toBe('allow');
  });
});
