import { describe, it, expect } from 'vitest';
import { generateTaskId, LocalAgentTask, LocalShellTask, DreamTask, createTaskRegistry, taskToModel, taskSummary, type TaskContext } from '../tasks/tasks.js';
import { checkTokenBudget, createTokenBudget, createContinuationTracker, recordContinuation, shouldStopContinuations, getMaxOutputTokensForModel, computeCostUsd } from '../query/token-budget.js';

describe('task ids', () => {
  it('generates prefixed ids', () => {
    const id = generateTaskId('agent_');
    expect(id.startsWith('agent_')).toBe(true);
    expect(id.length).toBe('agent_'.length + 8);
  });

  it('generates distinct ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateTaskId('x_')));
    expect(ids.size).toBe(50);
  });
});

describe('LocalAgentTask', () => {
  it('runs and completes', async () => {
    const task = new LocalAgentTask('do work', async () => 'done!');
    const context: TaskContext = { abortController: new AbortController(), sessionId: 's1', getState: () => ({}) };
    await task.start(context);
    expect(task.status).toBe('completed');
    expect(task.result).toBe('done!');
  });

  it('captures failures', async () => {
    const task = new LocalAgentTask('fail', async () => {
      throw new Error('boom');
    });
    await task.start({ abortController: new AbortController(), sessionId: 's1', getState: () => ({}) });
    expect(task.status).toBe('failed');
    expect(task.error).toBe('boom');
  });

  it('can be killed', async () => {
    const task = new LocalAgentTask('slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return 'never';
    });
    await task.kill();
    expect(task.status).toBe('cancelled');
  });
});

describe('LocalShellTask', () => {
  it('runs a command', async () => {
    const task = new LocalShellTask('echo hello', process.cwd());
    await task.start({ abortController: new AbortController(), sessionId: 's1', getState: () => ({}) });
    expect(task.status).toBe('completed');
    expect(task.result).toContain('hello');
  });
});

describe('DreamTask', () => {
  it('runs and completes', async () => {
    const task = new DreamTask('dream', async () => 'insight');
    await task.start();
    expect(task.status).toBe('completed');
    expect(task.result).toBe('insight');
  });
});

describe('task registry', () => {
  it('registers, retrieves, and removes', () => {
    const registry = createTaskRegistry();
    const task = new LocalAgentTask('t', async () => 'x');
    registry.register(task);
    expect(registry.get(task.id)).toBe(task);
    expect(registry.getAll()).toHaveLength(1);
    expect(registry.remove(task.id)).toBe(true);
    expect(registry.get(task.id)).toBeUndefined();
  });

  it('groups by type', () => {
    const registry = createTaskRegistry();
    registry.register(new LocalAgentTask('a', async () => 'x'));
    registry.register(new LocalAgentTask('b', async () => 'x'));
    registry.register(new DreamTask('d', async () => 'x'));
    expect(registry.getByType('local_agent')).toHaveLength(2);
    expect(registry.getByType('dream')).toHaveLength(1);
  });

  it('converts to model and summary', () => {
    const task = new LocalAgentTask('work', async () => 'x');
    const model = taskToModel(task);
    expect(model.type).toBe('local_agent');
    expect(model.status).toBe('pending');
    expect(taskSummary(task)).toContain('work');
  });
});

describe('token budget', () => {
  it('flags budget exhaustion at 90%', () => {
    const budget = createTokenBudget(1000);
    expect(checkTokenBudget(budget, { inputTokens: 500, outputTokens: 0 }).ok).toBe(true);
    const exhausted = checkTokenBudget(budget, { inputTokens: 900, outputTokens: 0 });
    expect(exhausted.ok).toBe(false);
    expect(exhausted.reason).toContain('90%');
  });

  it('tracks continuations and diminishing returns', () => {
    const tracker = createContinuationTracker();
    recordContinuation(tracker, { inputTokens: 3000, outputTokens: 1000 });
    recordContinuation(tracker, { inputTokens: 300, outputTokens: 50 });
    expect(tracker.count).toBe(2);
    expect(tracker.diminishing).toBe(true);
    expect(shouldStopContinuations(tracker)).toBe(false);
    recordContinuation(tracker, { inputTokens: 200, outputTokens: 40 });
    expect(shouldStopContinuations(tracker)).toBe(true);
  });

  it('computes max output tokens by model', () => {
    expect(getMaxOutputTokensForModel('gpt-4o')).toBe(8192);
    expect(getMaxOutputTokensForModel('gpt-4o-mini')).toBe(4096);
    expect(getMaxOutputTokensForModel('gemini-2.0-flash')).toBe(4096);
    expect(getMaxOutputTokensForModel('o3-mini')).toBe(16384);
  });

  it('computes costs', () => {
    const cost = computeCostUsd({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, 'gpt-4o');
    expect(cost).toBe(18);
    const cheap = computeCostUsd({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, 'gpt-4o-mini');
    expect(cheap).toBe(1.5);
  });
});
