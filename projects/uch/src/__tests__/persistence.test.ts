import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PersistenceProvider } from '../cognitive-plane/persistence/persistence-provider.js';
import { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';
import { WorkspaceGenome } from '../cognitive-plane/genome/workspace-genome.js';
import { ScientificMemory } from '../cognitive-plane/memory/scientific-memory.js';
import { TrustEngine } from '../cognitive-plane/trust/trust-engine.js';
import { DecisionLog } from '../cognitive-plane/decisions/decision-log.js';
import { PatternLibrary } from '../cognitive-plane/patterns/pattern-library.js';

const tmpDir = path.resolve('.uccp-test-persist');

function tmpFile(name: string): string {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  return path.join(tmpDir, name);
}

describe('PersistenceProvider', () => {
  afterAll(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('registers and resolves stores', () => {
    const pp = new PersistenceProvider({ baseDir: tmpDir });
    const con = new CognitiveConstitution();
    pp.register('constitution', con, 'con.json');
    expect(pp.storeNames()).toContain('constitution');
  });

  it('persists and loads all stores', async () => {
    const dir = tmpFile('all-test');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const pp = new PersistenceProvider({ baseDir: dir });

    const con = new CognitiveConstitution();
    const genome = new WorkspaceGenome({ workspaceId: 'test', projectName: 'Test', description: '' });
    const mem = new ScientificMemory(500);
    const trust = new TrustEngine();
    const log = new DecisionLog(500);
    const pat = new PatternLibrary(500);

    pp.register('constitution', con, 'con.json');
    pp.register('genome', genome, 'gen.json');
    pp.register('memory', mem, 'mem.json');
    pp.register('trust', trust, 'trust.json');
    pp.register('decision-log', log, 'log.json');
    pp.register('patterns', pat, 'pat.json');

    await pp.persistAll();

    expect(fs.existsSync(path.join(dir, 'con.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'gen.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'mem.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'trust.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'log.json'))).toBe(true);

    const pp2 = new PersistenceProvider({ baseDir: dir });
    const con2 = new CognitiveConstitution();
    const genome2 = new WorkspaceGenome({ workspaceId: 'test', projectName: 'Test', description: '' });
    const mem2 = new ScientificMemory(500);
    const trust2 = new TrustEngine();
    const log2 = new DecisionLog(500);
    const pat2 = new PatternLibrary(500);

    pp2.register('constitution', con2, 'con.json');
    pp2.register('genome', genome2, 'gen.json');
    pp2.register('memory', mem2, 'mem.json');
    pp2.register('trust', trust2, 'trust.json');
    pp2.register('decision-log', log2, 'log.json');
    pp2.register('patterns', pat2, 'pat.json');

    const counts = await pp2.loadAll();
    expect(counts['constitution']).toBeGreaterThanOrEqual(10);
    expect(counts['genome']).toBe(10);
    expect(counts['memory']).toBe(0);
    expect(counts['trust']).toBe(0);
    expect(counts['decision-log']).toBe(0);
    expect(counts['patterns']).toBe(0);
  });

  it('handles missing files gracefully', async () => {
    const pp = new PersistenceProvider({ baseDir: '/nonexistent/path' });
    const con = new CognitiveConstitution();
    pp.register('constitution', con, 'nope.json');
    const counts = await pp.loadAll();
    expect(counts.constitution).toBe(0);
  });

  it('persists and loads stores with data', async () => {
    const dir = tmpFile('data-test');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const mem = new ScientificMemory(500);
    mem.store({ key: 'fact-1', value: { text: 'the sky is blue' }, source: 'source-1', confidence: 0.9 });
    mem.store({ key: 'fact-2', value: { text: 'water is wet' }, source: 'source-2', confidence: 0.8 });

    await mem.persist(path.join(dir, 'sci.json'));

    const mem2 = new ScientificMemory(500);
    const count = await mem2.load(path.join(dir, 'sci.json'));
    expect(count).toBe(2);
    expect(mem2.getByKey('fact-1')?.confidence).toBe(0.9);
    expect(mem2.getByKey('fact-2')?.value).toEqual({ text: 'water is wet' });
  });

  it('persists and loads trust entries with dates', async () => {
    const dir = tmpFile('trust-test');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const trust = new TrustEngine();
    trust.register('src-a', 'source', 'standard');
    trust.recordSuccess('src-a');
    await trust.persist(path.join(dir, 'trust.json'));

    const trust2 = new TrustEngine();
    const count = await trust2.load(path.join(dir, 'trust.json'));
    expect(count).toBe(1);
    const assessment = trust2.assess('src-a');
    expect(assessment.verdict).toBe('trusted');
  });

  it('persists and loads decision log entries', async () => {
    const dir = tmpFile('dec-test');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const log = new DecisionLog(500);
    log.record({
      title: 'decision-1', description: 'made choice A',
      rationale: 'option-1 was best',
      outcome: 'option-1',
      alternatives: [{ name: 'opt-1', description: 'Option 1', pros: ['fast'], cons: ['costly'] }],
      traceIds: ['test'], tags: ['test'], metadata: { key: 'val' },
    });
    await log.persist(path.join(dir, 'decisions.json'));

    const log2 = new DecisionLog(500);
    const count = await log2.load(path.join(dir, 'decisions.json'));
    expect(count).toBe(1);
    const entries = log2.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.title).toBe('decision-1');
  });
});
