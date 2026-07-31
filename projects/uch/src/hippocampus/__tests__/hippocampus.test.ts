import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hippocampus } from '../consolidator.js';
import { CognitiveKernel } from '../../kernel/cognitive-kernel.js';
import type { Episode } from '../../kernel/types/episode.js';

function makeKernel() {
  return new CognitiveKernel({ agent_id: 'test', user_id: 'user', project_id: 'proj' });
}

describe('Hippocampus', () => {
  let kernel: CognitiveKernel;
  let hippocampus: Hippocampus;
  let rememberSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    kernel = makeKernel();
    hippocampus = new Hippocampus(kernel);
    rememberSpy = vi.spyOn(kernel, 'remember').mockResolvedValue({ id: 'ep' } as Episode);
  });

  afterEach(() => {
    vi.useRealTimers();
    rememberSpy.mockRestore();
  });

  it('records memories with generated ids and defaults', () => {
    const id = hippocampus.record('error', 'Something failed', { code: 500 });
    expect(id).toMatch(/^mem-\d+$/);
    const status = hippocampus.getStatus();
    expect(status.bufferSize).toBe(1);
    expect(status.totalMemories).toBe(1);
  });

  it('evicts the least-important memory when the buffer exceeds 200', () => {
    hippocampus.record('seed', 'lowest importance first', {}, 0.1);
    for (let i = 0; i < 200; i++) {
      hippocampus.record('fill', `memory ${i}`, {}, 0.5);
    }
    expect(hippocampus.getStatus().bufferSize).toBe(200);
    expect(hippocampus.recall('lowest importance')).toHaveLength(0);
    expect(hippocampus.recall('memory 199')).toHaveLength(1);
  });

  it('consolidates high-importance memories into long-term and writes to the kernel', async () => {
    hippocampus.record('low', 'not important enough', {}, 0.5);
    hippocampus.record('high', 'important observation', {}, 0.9);
    await hippocampus.tick();
    const status = hippocampus.getStatus();
    expect(status.longTermSize).toBe(1);
    expect(status.bufferSize).toBe(1);
    expect(status.consolidated).toBe(1);
    expect(rememberSpy).toHaveBeenCalledWith(
      expect.objectContaining({ content: { type: 'text', text: 'important observation' } }),
    );
  });

  it('keeps only the top 1000 long-term memories by importance', async () => {
    for (let batch = 0; batch < 6; batch++) {
      for (let i = 0; i < 200; i++) {
        hippocampus.record('bulk', `bulk memory ${batch}-${i}`, {}, 0.9);
      }
      await hippocampus.tick();
    }
    const status = hippocampus.getStatus();
    expect(status.longTermSize).toBe(1000);
    expect(status.bufferSize).toBe(0);
  });

  it('rehearses old, high-importance memories by boosting their importance', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    hippocampus.record('critical', 'old but critical fact', {}, 0.9);
    await hippocampus.tick();
    vi.setSystemTime(new Date('2026-01-05T00:00:00Z'));
    await hippocampus.tick();
    const status = hippocampus.getStatus();
    expect(status.longTermSize).toBe(1);
    expect(status.avgImportance).toBeCloseTo(0.95, 5);
  });

  it('does not rehearse memories below the 0.8 importance threshold', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    hippocampus.record('ok', 'older but less critical', {}, 0.7);
    await hippocampus.tick();
    vi.setSystemTime(new Date('2026-01-05T00:00:00Z'));
    await hippocampus.tick();
    expect(hippocampus.getStatus().avgImportance).toBeCloseTo(0.7, 5);
  });

  it('recalls by substring on summary or type, ranked by importance', () => {
    hippocampus.record('alpha', 'very valuable insight', {}, 0.9);
    hippocampus.record('beta', 'minor note', {}, 0.4);
    hippocampus.record('alpha', 'another alpha topic', {}, 0.6);

    const results = hippocampus.recall('alpha', 10);
    expect(results.map((r) => r.type)).toEqual(['alpha', 'alpha']);
    expect(results[0]!.importance).toBeGreaterThan(results[1]!.importance);

    expect(hippocampus.recall('valuable')).toHaveLength(1);
    expect(hippocampus.recall('missing')).toHaveLength(0);
  });

  it('recalls across buffer and long-term with a limit', async () => {
    hippocampus.record('low', 'buffered item', {}, 0.5);
    hippocampus.record('high', 'consolidated item', {}, 0.9);
    await hippocampus.tick();
    const results = hippocampus.recall('item', 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.summary).toBe('consolidated item');
  });

  it('reports status including average importance', async () => {
    hippocampus.record('a', 'first', {}, 0.8);
    hippocampus.record('b', 'second', {}, 0.6);
    await hippocampus.tick();
    const status = hippocampus.getStatus() as {
      bufferSize: number;
      longTermSize: number;
      totalMemories: number;
      avgImportance: number;
      consolidated: number;
    };
    expect(status.bufferSize).toBe(1);
    expect(status.longTermSize).toBe(1);
    expect(status.totalMemories).toBe(2);
    expect(status.consolidated).toBe(1);
    expect(status.avgImportance).toBeCloseTo(0.8, 5);
  });
});
