import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PersistenceProvider } from '../cognitive-plane/persistence/persistence-provider.js';
import type { Storable } from '../cognitive-plane/persistence/persistence-engine.js';
import { CognitiveCore } from '../cognitive-core/cognitive-core.js';

class FakeStore implements Storable {
  persistCount = 0;
  loadCount = 0;

  async persist(_filePath: string): Promise<void> {
    this.persistCount++;
  }

  async load(_filePath: string): Promise<number> {
    this.loadCount++;
    return 1;
  }
}

describe('Organism persistence (W-02: PersistenceProvider wiring)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-organism-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('autosaves registered stores on an interval', async () => {
    const provider = new PersistenceProvider({ baseDir: dir });
    const store = new FakeStore();
    provider.register('fake', store);

    provider.startAutoSave(10);
    await new Promise((r) => setTimeout(r, 50));
    provider.stopAutoSave();

    expect(store.persistCount).toBeGreaterThan(0);
    expect(provider.storeNames()).toEqual(['fake']);
  });

  it('startAutoSave is idempotent', async () => {
    const provider = new PersistenceProvider({ baseDir: dir });
    const store = new FakeStore();
    provider.register('fake', store);

    provider.startAutoSave(10);
    provider.startAutoSave(10);
    await new Promise((r) => setTimeout(r, 30));
    provider.stopAutoSave();
    provider.stopAutoSave();
  });

  it('round-trips connectome + signals across core start/stop cycles', async () => {
    const root = join(dir, 'ws');
    mkdirSync(root, { recursive: true });
    const makeCore = () =>
      new CognitiveCore({
        workspaceId: 'ws-1',
        workspaceName: 'ws',
        workspaceRoot: root,
      });

    const coreA = makeCore();
    await coreA.start();
    coreA.connectome.link('knowledge', 'persistence', 'reference', 'test link');
    await coreA.stop();

    const organismDir = join(root, '.uccp', 'persist', 'organism');
    expect(existsSync(join(organismDir, 'connectome.json'))).toBe(true);
    expect(existsSync(join(organismDir, 'signals.json'))).toBe(true);
    const saved = JSON.parse(readFileSync(join(organismDir, 'connectome.json'), 'utf-8'));
    expect(JSON.stringify(saved)).toContain('persistence');

    const coreB = makeCore();
    await coreB.start();
    const connections = coreB.connectome.getConnections();
    expect(connections.some((c) => c.from === 'knowledge' && c.to === 'persistence')).toBe(true);
    await coreB.stop();
  });
});
