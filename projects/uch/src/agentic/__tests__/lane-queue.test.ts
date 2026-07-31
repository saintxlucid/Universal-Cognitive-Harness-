import { describe, it, expect } from 'vitest';
import { LaneQueue, GLOBAL_LANE, createAbortError, DEFAULT_LANE_CAPACITY } from '../query/lane-queue.js';

function deferred() {
  let resolve: (value: string) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('LaneQueue', () => {
  it('runs tasks serially within a lane (single-flight)', async () => {
    const queue = new LaneQueue();
    const order: string[] = [];
    const first = deferred();
    const p1 = queue.enqueue('session-1', async () => {
      order.push('a');
      await first.promise;
      return 'a';
    });
    const p2 = queue.enqueue('session-1', async () => {
      order.push('b');
      return 'b';
    });
    expect(queue.isRunning('session-1')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(order).toEqual(['a']);
    first.resolve('done');
    expect(await p1).toBe('a');
    expect(await p2).toBe('b');
    expect(order).toEqual(['a', 'b']);
  });

  it('runs different lanes concurrently', async () => {
    const queue = new LaneQueue();
    const order: string[] = [];
    const first = deferred();
    const p1 = queue.enqueue('lane-a', async () => {
      await first.promise;
      order.push('a');
      return 'a';
    });
    const p2 = queue.enqueue('lane-b', async () => {
      order.push('b');
      return 'b';
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(order).toEqual(['b']);
    first.resolve('x');
    await p1;
    await p2;
    expect(order).toEqual(['b', 'a']);
  });

  it('global lane is exclusive and takes priority', async () => {
    const queue = new LaneQueue();
    const order: string[] = [];
    const first = deferred();
    const p1 = queue.enqueue('session', async () => {
      order.push('session');
      return 's';
    });
    const p2 = queue.enqueue(GLOBAL_LANE, async () => {
      await first.promise;
      order.push('global');
      return 'g';
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(order).toEqual(['session']);
    first.resolve('x');
    await p2;
    await p1;
    expect(order).toEqual(['session', 'global']);
  });

  it('honors priority ordering within a lane', async () => {
    const queue = new LaneQueue();
    const order: string[] = [];
    const first = deferred();
    const low = queue.enqueue('l', async () => {
      await first.promise;
      order.push('low');
      return 'low';
    }, { priority: 1 });
    const high = queue.enqueue('l', async () => {
      order.push('high');
      return 'high';
    }, { priority: 10 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    first.resolve('x');
    await low;
    await high;
    expect(order).toEqual(['low', 'high']);
  });

  it('rejects when lane queue is full', async () => {
    const queue = new LaneQueue({ laneCapacity: 2 });
    const first = deferred();
    const p1 = queue.enqueue('l', async () => {
      await first.promise;
      return '1';
    });
    const p2 = queue.enqueue('l', async () => '2');
    await expect(queue.enqueue('l', async () => '3')).rejects.toThrow('full');
    first.resolve('x');
    await p1;
    await p2;
  });

  it('rejects when max lanes exceeded', async () => {
    const queue = new LaneQueue({ maxLanes: 2 });
    const first = deferred();
    const p1 = queue.enqueue('a', async () => {
      await first.promise;
      return 'a';
    });
    const p2 = queue.enqueue('b', async () => 'b');
    await expect(queue.enqueue('c', async () => 'c')).rejects.toThrow('Lane limit');
    first.resolve('x');
    await p1;
    await p2;
  });

  it('supports abort via AbortSignal', async () => {
    const queue = new LaneQueue();
    const controller = new AbortController();
    const first = deferred();
    const running = queue.enqueue('l', async () => {
      await first.promise;
      return 'done';
    });
    const pending = queue.enqueue('l', async () => 'later', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    first.resolve('x');
    await running;
  });

  it('rejects immediately when signal already aborted', async () => {
    const queue = new LaneQueue();
    const controller = new AbortController();
    controller.abort();
    await expect(queue.enqueue('l', async () => 'x', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('aborts an entire lane', async () => {
    const queue = new LaneQueue();
    const first = deferred();
    const running = queue.enqueue('l', async () => {
      await first.promise;
      return 'done';
    });
    const pending = queue.enqueue('l', async () => 'later');
    queue.abortLane('l');
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    first.resolve('x');
    await running;
  });

  it('tracks status', async () => {
    const queue = new LaneQueue();
    const first = deferred();
    const p1 = queue.enqueue('a', async () => {
      await first.promise;
      return 'a';
    });
    const p2 = queue.enqueue('a', async () => 'a2');
    const status = queue.status();
    expect(status.running).toBe(1);
    expect(status.queued).toBe(1);
    expect(status.lanes.some((l) => l.lane === 'a' && l.running === 1 && l.queued === 1)).toBe(true);
    first.resolve('x');
    await p1;
    await p2;
    expect(queue.status().finishedCount).toBe(2);
  });

  it('propagates task errors to the caller', async () => {
    const queue = new LaneQueue();
    await expect(queue.enqueue('l', async () => {
      throw new Error('task failed');
    })).rejects.toThrow('task failed');
  });

  it('exposes default lane capacity', () => {
    expect(DEFAULT_LANE_CAPACITY).toBe(100);
    const queue = new LaneQueue();
    expect(queue.queuedIn('missing')).toBe(0);
  });

  it('creates DOMException-style abort errors', () => {
    const error = createAbortError();
    expect(error.name).toBe('AbortError');
  });
});
