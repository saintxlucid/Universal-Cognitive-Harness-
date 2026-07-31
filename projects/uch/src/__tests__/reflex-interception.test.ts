import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileEditor } from '../coding/file-editor.js';
import { ReflexGate } from '../reflex/gate.js';
import { createReflexChecks } from '../reflex/checks.js';
import type { NeuralEvent } from '../event-bus/neural-event-bus.js';
import type { ReflexCheck, ReflexGateLike, ReflexVerdict, WriteProposal } from '../reflex/types.js';
import type { GraphNode } from '../kernel/storage/graph-store.js';

let dir: string;
let editor: FileEditor;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'uch-ri-'));
  editor = new FileEditor({ root: dir });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function makeStubGate(verdict: ReflexVerdict): ReflexGateLike {
  return { evaluate: () => ({ verdict, checks_run: [], evidence: [], duration_ms: 1, target: 'x' }) };
}

function makeBlockingGate(): ReflexGateLike {
  return {
    evaluate: () => ({
      verdict: 'block',
      checks_run: ['duplicate-abstraction'],
      evidence: [{
        check_id: 'duplicate-abstraction',
        rule: 'duplicate-abstraction-overlap',
        level: 'block',
        evidence: ['file:src/legacy/user-manager.ts'],
        reason: 'overlap',
      }],
      duration_ms: 1,
      target: 'x',
    }),
  };
}

function makeBlockingCheck(): ReflexCheck {
  return {
    id: 'duplicate-abstraction',
    rule: 'duplicate-abstraction-overlap',
    evaluate: () => ({
      check_id: 'duplicate-abstraction',
      rule: 'duplicate-abstraction-overlap',
      level: 'block',
      evidence: ['file:src/legacy/user-manager.ts'],
      threshold: 'overlap>=0.6',
      reason: 'src/user-manager2.ts overlaps existing artifact user-manager.ts',
    }),
  };
}

function artifactNode(id: string, name: string): GraphNode {
  return { id, type: 'artifact', name, properties: {}, created_at: 1 };
}

describe('ReflexGate interception — FileEditor', () => {
  it('blocked write creates NO file and returns applied:false', () => {
    const gated = new FileEditor({ root: dir, gate: makeBlockingGate() });
    const res = gated.write('src/new.ts', 'export {}');
    expect(res.applied).toBe(false);
    expect(res.undoAvailable).toBe(false);
    expect(res.message).toContain('blocked');
    expect(existsSync(join(dir, 'src', 'new.ts'))).toBe(false);
    expect(gated.getUndoHistory('src/new.ts')).toBe(0);
  });

  it('blocked edit does not modify the file', () => {
    writeFileSync(join(dir, 'keep.ts'), 'const a = 1;', 'utf-8');
    const gated = new FileEditor({ root: dir, gate: makeBlockingGate() });
    const res = gated.edit('keep.ts', 1, 1, 'const b = 2;');
    expect(res.applied).toBe(false);
    expect(readFileSync(join(dir, 'keep.ts'), 'utf-8')).toBe('const a = 1;');
  });

  it('blocked insert/append/deleteLines also return applied:false', () => {
    writeFileSync(join(dir, 'keep.ts'), 'const a = 1;', 'utf-8');
    const gated = new FileEditor({ root: dir, gate: makeBlockingGate() });
    const inserted = gated.insert('keep.ts', 1, 'const b = 2;');
    const appended = gated.append('keep.ts', 'const c = 3;');
    const deleted = gated.deleteLines('keep.ts', 1, 1);
    expect(inserted.applied).toBe(false);
    expect(appended.applied).toBe(false);
    expect(deleted.applied).toBe(false);
    expect(readFileSync(join(dir, 'keep.ts'), 'utf-8')).toBe('const a = 1;');
  });

  it('blocked delete returns false and keeps the file', () => {
    writeFileSync(join(dir, 'keep.ts'), 'const a = 1;', 'utf-8');
    const gated = new FileEditor({ root: dir, gate: makeBlockingGate() });
    const deleted = gated.delete('keep.ts');
    expect(deleted).toBe(false);
    expect(existsSync(join(dir, 'keep.ts'))).toBe(true);
  });

  it('defer holds the write', () => {
    const gated = new FileEditor({ root: dir, gate: makeStubGate('defer') });
    const res = gated.write('src/new.ts', 'export {}');
    expect(res.applied).toBe(false);
    expect(res.message).toContain('deferred');
    expect(existsSync(join(dir, 'src', 'new.ts'))).toBe(false);
  });

  it('allow behaves exactly as before', () => {
    const gated = new FileEditor({ root: dir, gate: makeStubGate('allow') });
    const res = gated.write('src/new.ts', 'export {}');
    expect(res.applied).toBe(true);
    expect(existsSync(join(dir, 'src', 'new.ts'))).toBe(true);
    expect(readFileSync(join(dir, 'src', 'new.ts'), 'utf-8')).toBe('export {}');
    expect(res.message.startsWith('Created')).toBe(true);
  });

  it('no gate configured behaves exactly as before', () => {
    const res = editor.write('src/new.ts', 'export {}');
    expect(res.applied).toBe(true);
    expect(existsSync(join(dir, 'src', 'new.ts'))).toBe(true);
  });

  it('target passed to the gate is the original path, not resolved', () => {
    const proposals: WriteProposal[] = [];
    const spyGate: ReflexGateLike = {
      evaluate: (p) => {
        proposals.push(p);
        return { verdict: 'allow', checks_run: [], evidence: [], duration_ms: 1, target: p.target };
      },
    };
    const gated = new FileEditor({ root: dir, gate: spyGate });
    gated.write('src/new.ts', 'const x = 1;');
    expect(proposals.length).toBe(1);
    expect(proposals[0]!.target).toBe('src/new.ts');
    expect(proposals[0]!.tool).toBe('file-editor');
    expect(proposals[0]!.content).toBe('const x = 1;');
  });

  it('real ReflexGate integration: block-before-write end-to-end', () => {
    const artifact = artifactNode('file:src/legacy/user-manager.ts', 'user-manager.ts');
    const knowledgeGraph = {
      search: (q: string) => (q === 'user' || q === 'manager' ? [artifact] : []),
      findArtifacts: () => [artifact],
    };
    const gate = new ReflexGate({ checks: createReflexChecks({ knowledgeGraph }) });
    const gated = new FileEditor({ root: dir, gate });
    const res = gated.write('src/user-manager2.ts', 'export class UserManager2 {}');
    expect(res.applied).toBe(false);
    expect(existsSync(join(dir, 'src', 'user-manager2.ts'))).toBe(false);
  });

  it('every mutation method consults the gate once', () => {
    writeFileSync(join(dir, 'keep.ts'), 'const a = 1;', 'utf-8');
    let calls = 0;
    const countingGate: ReflexGateLike = {
      evaluate: (p) => {
        calls++;
        return { verdict: 'allow', checks_run: [], evidence: [], duration_ms: 1, target: p.target };
      },
    };
    const gated = new FileEditor({ root: dir, gate: countingGate });
    gated.write('src/w.ts', 'export {}');
    gated.edit('keep.ts', 1, 1, 'const b = 2;');
    gated.insert('keep.ts', 1, 'const c = 3;');
    gated.append('keep.ts', 'const d = 4;');
    expect(calls).toBe(4);
  });
});

describe('ReflexGate interception — records flow from tool layer', () => {
  it('blocked write still emits the governance:event_denied record when the gate has an eventSink', async () => {
    const events: Array<Omit<NeuralEvent, 'id' | 'timestamp'>> = [];
    const gate = new ReflexGate({
      checks: [makeBlockingCheck()],
      eventSink: (ev) => { events.push(ev); },
    });
    const gated = new FileEditor({ root: dir, gate });
    const res = gated.write('src/new.ts', 'export {}');
    expect(res.applied).toBe(false);
    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('governance:event_denied');
    const payload = events[0]!.payload as { tool?: string; target?: string };
    expect(payload.tool).toBe('file-editor');
    expect(payload.target).toBe('src/new.ts');
  });
});
