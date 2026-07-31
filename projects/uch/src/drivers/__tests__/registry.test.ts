import { describe, it, expect } from 'vitest';
import { DriverRegistry } from '../registry.js';
import type { Driver, DriverEvent } from '../registry.js';

function makeDriver(id: string, name: string, opts?: { failStart?: boolean; failHandle?: boolean }): Driver {
  return {
    id,
    name,
    start: () => {
      if (opts?.failStart) throw new Error(`${id} start failed`);
    },
    stop: () => undefined,
    handleEvent: async (event: DriverEvent) => {
      if (opts?.failHandle) throw new Error(`${id} handle failed`);
      void event;
    },
  };
}

describe('DriverRegistry', () => {
  it('registers, lists, and counts drivers', () => {
    const registry = new DriverRegistry();
    registry.register(makeDriver('fs', 'filesystem'));
    registry.register(makeDriver('git', 'git'));
    expect(registry.count()).toBe(2);
    expect(registry.list().map((d) => d.id)).toEqual(['fs', 'git']);
    expect(registry.has('git')).toBe(true);
    expect(registry.get('git')?.name).toBe('git');
  });

  it('rejects duplicate ids', () => {
    const registry = new DriverRegistry();
    registry.register(makeDriver('fs', 'filesystem'));
    expect(() => registry.register(makeDriver('fs', 'dup'))).toThrow(/already registered/);
  });

  it('manages lifecycle per driver and globally', async () => {
    const registry = new DriverRegistry();
    const started: string[] = [];
    const stopped: string[] = [];
    registry.register({
      id: 'a', name: 'A',
      start: () => { started.push('a'); },
      stop: () => { stopped.push('a'); },
    });
    registry.register({
      id: 'b', name: 'B',
      start: () => { started.push('b'); },
      stop: () => { stopped.push('b'); },
    });

    const ids = await registry.startAll();
    expect(ids).toEqual(['a', 'b']);
    expect(registry.isStarted('a')).toBe(true);
    expect(started).toEqual(['a', 'b']);

    await registry.start('a');
    expect(started).toEqual(['a', 'b']);

    await registry.stopAll();
    expect(stopped).toEqual(['a', 'b']);
    expect(registry.isStarted('a')).toBe(false);
  });

  it('unregisters drivers and stops them first', async () => {
    const registry = new DriverRegistry();
    let stopped = false;
    registry.register({ id: 'x', name: 'X', start: () => undefined, stop: () => { stopped = true; } });
    await registry.start('x');
    const removed = await registry.unregister('x');
    expect(removed).toBe(true);
    expect(stopped).toBe(true);
    expect(registry.has('x')).toBe(false);
    expect(await registry.unregister('x')).toBe(false);
  });

  it('dispatches events to drivers with handleEvent', async () => {
    const registry = new DriverRegistry();
    const received: string[] = [];
    registry.register({
      id: 'h', name: 'H',
      start: () => undefined, stop: () => undefined,
      handleEvent: (event: DriverEvent) => { received.push(event.type); },
    });
    const failures = await registry.dispatch({ type: 'session:started', source: 'test' });
    expect(failures).toEqual([]);
    expect(received).toEqual(['session:started']);
  });

  it('collects handler failures without stopping other drivers', async () => {
    const registry = new DriverRegistry();
    registry.register(makeDriver('ok', 'OK'));
    registry.register(makeDriver('bad', 'BAD', { failHandle: true }));
    const failures = await registry.dispatch({ type: 'x', source: 'y' });
    expect(failures).toEqual([{ id: 'bad', error: 'bad handle failed' }]);
  });

  it('start failures propagate to the caller', async () => {
    const registry = new DriverRegistry();
    registry.register(makeDriver('bad', 'BAD', { failStart: true }));
    await expect(registry.startAll()).rejects.toThrow(/start failed/);
    expect(registry.isStarted('bad')).toBe(false);
  });
});
