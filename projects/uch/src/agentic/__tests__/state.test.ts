import { describe, it, expect } from 'vitest';
import { createStore, diffSubscribe } from '../state/store.js';
import { createSessionState, createSessionTracker, emptyUsage, formatMessagesForModel } from '../state/session-state.js';
import type { Message, Terminal } from '../types.js';

describe('createStore', () => {
  it('gets and sets state', () => {
    const store = createStore({ count: 0 });
    expect(store.getState().count).toBe(0);
    store.setState((s) => ({ count: s.count + 1 }));
    expect(store.getState().count).toBe(1);
  });

  it('skips identical state', () => {
    const store = createStore({ count: 0 });
    let notifications = 0;
    store.subscribe(() => notifications++);
    store.setState((s) => ({ count: s.count + 1 }));
    expect(notifications).toBe(1);
    store.setState((s) => s);
    expect(notifications).toBe(1);
  });

  it('unsubscribes', () => {
    const store = createStore({ count: 0 });
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    unsubscribe();
    store.setState(() => ({ count: 1 }));
    expect(notifications).toBe(0);
  });

  it('notifies with previous state', () => {
    const store = createStore({ count: 0 });
    let prevSeen: number | null = null;
    store.subscribe((state, prev) => {
      prevSeen = prev.count;
    });
    store.setState(() => ({ count: 5 }));
    expect(prevSeen).toBe(0);
  });
});

describe('diffSubscribe', () => {
  it('fires only when selected value changes', () => {
    const store = createStore({ a: 1, b: 2 });
    let aChanges = 0;
    diffSubscribe(store, (s) => s.a, () => aChanges++);
    store.setState((s) => ({ ...s, b: 3 }));
    expect(aChanges).toBe(0);
    store.setState((s) => ({ ...s, a: 2 }));
    expect(aChanges).toBe(1);
  });
});

describe('session state', () => {
  it('tracks lifecycle', () => {
    const store = createSessionState('s1', '/tmp');
    const tracker = createSessionTracker(store);
    expect(store.getState().running).toBe(false);
    tracker.start();
    expect(store.getState().running).toBe(true);
    expect(store.getState().startedAt).toBeTruthy();
    const terminal: Terminal = { state: 'success', message: 'done', turnCount: 1, usage: { inputTokens: 10, outputTokens: 5 } };
    tracker.stop(terminal);
    expect(store.getState().running).toBe(false);
    expect(store.getState().lastTerminal?.state).toBe('success');
  });

  it('accumulates usage', () => {
    const store = createSessionState('s1', '/tmp');
    const tracker = createSessionTracker(store);
    tracker.addUsage({ inputTokens: 100, outputTokens: 50 });
    tracker.addUsage({ inputTokens: 50, outputTokens: 25 });
    expect(store.getState().usage.inputTokens).toBe(150);
    expect(store.getState().usage.outputTokens).toBe(75);
  });

  it('emits events on changes', () => {
    const messages: Message[] = [];
    const store = createSessionState('s1', '/tmp', {
      onMessage: (m) => messages.push(m),
    });
    const tracker = createSessionTracker(store);
    tracker.addMessage({
      id: 'm1',
      role: 'user',
      content: [{ type: 'text', text: 'hi' }],
      timestamp: new Date().toISOString(),
    });
    expect(messages).toHaveLength(1);
  });

  it('manages tasks', () => {
    const store = createSessionState('s1', '/tmp');
    const tracker = createSessionTracker(store);
    tracker.addTask({ id: 't1', type: 'local_agent', status: 'pending', description: 'task', createdAt: new Date() });
    tracker.updateTask('t1', { status: 'completed', result: 'ok' });
    expect(store.getState().tasks[0]?.status).toBe('completed');
  });

  it('formats messages for the model', () => {
    const messages: Message[] = [
      { id: 'a', role: 'assistant', content: [{ type: 'tool_use', id: 'tc1', name: 'Read', input: {} }], timestamp: '' },
      { id: 'b', role: 'user', content: [{ type: 'tool_result', toolUseId: 'tc1', content: 'file contents' }], timestamp: '' },
    ];
    const formatted = formatMessagesForModel(messages);
    expect(formatted).toHaveLength(2);
    const resultBlock = formatted[1]?.content[0];
    expect(resultBlock?.type).toBe('text');
    expect((resultBlock as { text: string }).text).toContain('<tool_result id="tc1">');
  });

  it('emptyUsage returns zeros', () => {
    expect(emptyUsage()).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
