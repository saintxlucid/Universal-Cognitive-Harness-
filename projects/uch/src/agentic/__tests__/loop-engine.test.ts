import { describe, it, expect } from 'vitest';
import { queryLoop } from '../query/loop.js';
import { QueryEngine } from '../query/engine.js';
import { buildTool } from '../tools/types.js';
import { getTools } from '../tools/registry.js';
import type { ModelCaller, ModelCallOptions } from '../model/caller.js';
import type { Message, ModelCallResult, Terminal } from '../types.js';
import { createPermissionRuleSet } from '../permissions/permissions.js';

function toolContext(sessionId = 'test') {
  return {
    cwd: process.cwd(),
    abortController: new AbortController(),
    getSessionId: () => sessionId,
  };
}

class FakeModel implements ModelCaller {
  readonly modelName = 'fake-model';
  readonly available = true;
  script: ModelCallResult[] = [];
  private index = 0;
  calls: Message[][] = [];

  call(messages: Message[], _options?: ModelCallOptions): Promise<ModelCallResult> {
    this.calls.push(messages);
    const next = this.script[this.index] ?? {
      text: 'Final answer.',
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: 'end_turn',
    };
    this.index += 1;
    return Promise.resolve(next);
  }
}

const baseResult: ModelCallResult = {
  text: '',
  toolCalls: [],
  usage: { inputTokens: 10, outputTokens: 10 },
  stopReason: 'end_turn',
};

async function drain(generator: AsyncGenerator<unknown, Terminal>): Promise<{ events: unknown[]; terminal: Terminal }> {
  const events: unknown[] = [];
  let result = await generator.next();
  while (!result.done) {
    events.push(result.value);
    result = await generator.next();
  }
  return { events, terminal: result.value };
}

describe('query loop', () => {
  it('runs a simple turn without tools', async () => {
    const model = new FakeModel();
    model.script = [
      { ...baseResult, text: 'Hello world!' },
    ];
    const { terminal } = await drain(queryLoop({
      messages: [{ id: 'm1', role: 'user', content: [{ type: 'text', text: 'hi' }], timestamp: '' }],
      tools: getTools('all'),
      cwd: process.cwd(),
      model,
      toolContext: toolContext(),
    }));
    expect(terminal.state).toBe('success');
    expect(model.calls).toHaveLength(1);
  });

  it('executes tool calls and feeds results back', async () => {
    const model = new FakeModel();
    model.script = [
      {
        ...baseResult,
        toolCalls: [{ id: 'tc1', name: 'Memory', input: { action: 'recall', content: 'anything' } }],
        stopReason: 'tool_use',
      },
      { ...baseResult, text: 'Based on memory: done' },
    ];
    const { events, terminal } = await drain(queryLoop({
      messages: [{ id: 'm1', role: 'user', content: [{ type: 'text', text: 'remember context' }], timestamp: '' }],
      tools: getTools('all'),
      cwd: process.cwd(),
      model,
      toolContext: toolContext(),
      permissionMode: 'bypassPermissions',
    }));
    expect(terminal.state).toBe('success');
    expect(model.calls).toHaveLength(2);
    const toolResultSeen = events.some(
      (e) =>
        (e as { type?: string }).type === 'stream-event' &&
        JSON.stringify(e).includes('tool_result'),
    );
    expect(toolResultSeen).toBe(false);
    const fedBack = (model.calls[1] ?? []).some((m) => m.content.some((b) => b.type === 'tool_result'));
    expect(fedBack).toBe(true);
  });

  it('stops after max turns', async () => {
    const model = new FakeModel();
    model.script = [
      { ...baseResult, toolCalls: [{ id: 'a', name: 'Sleep', input: { seconds: 1 } }], stopReason: 'tool_use' },
      { ...baseResult, toolCalls: [{ id: 'b', name: 'Sleep', input: { seconds: 1 } }], stopReason: 'tool_use' },
    ];
    const { terminal } = await drain(queryLoop({
      messages: [{ id: 'm1', role: 'user', content: [{ type: 'text', text: 'loop' }], timestamp: '' }],
      tools: getTools('all'),
      cwd: process.cwd(),
      model,
      toolContext: toolContext(),
      permissionMode: 'bypassPermissions',
      maxTurns: 2,
    }));
    expect(terminal.state).toBe('success');
    expect(terminal.message).toContain('max turns');
  });

  it('aborts cleanly', async () => {
    const controller = new AbortController();
    const model = new FakeModel();
    const generator = queryLoop({
      messages: [{ id: 'm1', role: 'user', content: [{ type: 'text', text: 'x' }], timestamp: '' }],
      tools: getTools('all'),
      cwd: process.cwd(),
      model,
      toolContext: toolContext(),
      abortController: controller,
    });
    const first = await generator.next();
    expect(first.done).toBe(false);
    controller.abort();
    const second = await generator.next();
    expect(second.done).toBe(true);
    if (second.done) {
      expect(second.value.state).toBe('aborted');
    }
  });

  it('handles unknown tools with errors', async () => {
    const model = new FakeModel();
    model.script = [
      { ...baseResult, toolCalls: [{ id: 'x', name: 'NotARealTool', input: {} }], stopReason: 'tool_use' },
      { ...baseResult, text: 'recovered' },
    ];
    const { terminal } = await drain(queryLoop({
      messages: [{ id: 'm1', role: 'user', content: [{ type: 'text', text: 'x' }], timestamp: '' }],
      tools: getTools('all'),
      cwd: process.cwd(),
      model,
      toolContext: toolContext(),
      permissionMode: 'bypassPermissions',
    }));
    expect(terminal.state).toBe('success');
    expect(model.calls).toHaveLength(2);
  });

  it('respects permission denials', async () => {
    const model = new FakeModel();
    model.script = [
      { ...baseResult, toolCalls: [{ id: 'd', name: 'Write', input: { file_path: 'x', content: 'y' } }], stopReason: 'tool_use' },
      { ...baseResult, text: 'could not write' },
    ];
    const { terminal } = await drain(queryLoop({
      messages: [{ id: 'm1', role: 'user', content: [{ type: 'text', text: 'write' }], timestamp: '' }],
      tools: getTools('all'),
      cwd: process.cwd(),
      model,
      toolContext: toolContext(),
      permissionMode: 'dontAsk',
    }));
    expect(terminal.state).toBe('success');
    const lastMessages = model.calls[1] ?? [];
    expect(JSON.stringify(lastMessages)).toContain('Permission denied');
  });
});

describe('QueryEngine', () => {
  it('maintains conversation state across turns', async () => {
    const model = new FakeModel();
    model.script = [
      { ...baseResult, text: 'First answer' },
      { ...baseResult, text: 'Second answer' },
    ];
    const engine = new QueryEngine({
      cwd: process.cwd(),
      tools: getTools('all'),
      model,
      toolContext: toolContext(),
      permissionMode: 'bypassPermissions',
    });

    const t1 = await drain(engine.submitMessage('first question'));
    expect(t1.terminal.state).toBe('success');
    expect(engine.messages).toHaveLength(2);

    const t2 = await drain(engine.submitMessage('second question'));
    expect(t2.terminal.state).toBe('success');
    expect(engine.messages).toHaveLength(4);
    expect(model.calls).toHaveLength(2);
  });

  it('tracks usage and cost across turns', async () => {
    const model = new FakeModel();
    model.script = [
      { ...baseResult, text: 'a' },
      { ...baseResult, text: 'b' },
    ];
    const engine = new QueryEngine({
      cwd: process.cwd(),
      tools: getTools('all'),
      model,
      toolContext: toolContext(),
      permissionMode: 'bypassPermissions',
    });
    await drain(engine.submitMessage('q1'));
    await drain(engine.submitMessage('q2'));
    expect(engine.usage.inputTokens).toBe(20);
    expect(engine.usage.outputTokens).toBe(20);
    expect(engine.getTerminal()?.turnCount).toBeGreaterThan(0);
  });

  it('records permission denials', async () => {
    const model = new FakeModel();
    model.script = [
      { ...baseResult, toolCalls: [{ id: 'w', name: 'Write', input: { file_path: 'a', content: 'b' } }], stopReason: 'tool_use' },
      { ...baseResult, text: 'done' },
    ];
    const engine = new QueryEngine({
      cwd: process.cwd(),
      tools: getTools('all'),
      model,
      toolContext: toolContext(),
      permissionMode: 'dontAsk',
    });
    await drain(engine.submitMessage('write a file'));
    expect(engine.permissionDenialCount).toBeGreaterThan(0);
  });

  it('rejects concurrent turns', async () => {
    const model = new FakeModel();
    model.script = [{ ...baseResult, text: 'a' }];
    const engine = new QueryEngine({
      cwd: process.cwd(),
      tools: getTools('all'),
      model,
      toolContext: toolContext(),
      permissionMode: 'bypassPermissions',
    });
    const first = engine.submitMessage('q1');
    await first.next();
    await expect(engine.submitMessage('q2').next()).rejects.toThrow(/already running/);
    await first.return?.({ state: 'aborted', message: '', turnCount: 0, usage: { inputTokens: 0, outputTokens: 0 } });
  });

  it('aborts mid-turn', async () => {
    const model = new FakeModel();
    model.script = [{ ...baseResult, text: 'a' }];
    const controller = new AbortController();
    const engine = new QueryEngine({
      cwd: process.cwd(),
      tools: getTools('all'),
      model,
      toolContext: toolContext(),
      permissionMode: 'bypassPermissions',
      abortController: controller,
    });
    controller.abort();
    const { terminal } = await drain(engine.submitMessage('q'));
    expect(terminal.state).toBe('aborted');
  });

  it('uses custom tools with canUseTool decisions', async () => {
    const customTool = buildTool({
      name: 'Custom',
      description: 'custom tool',
      inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
      call: async (input) => ({ data: `got ${input.value}` }),
    });
    const model = new FakeModel();
    model.script = [
      { ...baseResult, toolCalls: [{ id: 'c1', name: 'Custom', input: { value: '42' } }], stopReason: 'tool_use' },
      { ...baseResult, text: 'result seen' },
    ];
    const engine = new QueryEngine({
      cwd: process.cwd(),
      tools: [...getTools('all'), customTool],
      model,
      toolContext: toolContext(),
      permissionMode: 'bypassPermissions',
    });
    const { terminal } = await drain(engine.submitMessage('use custom'));
    expect(terminal.state).toBe('success');
    const secondCall = model.calls[1] ?? [];
    expect(JSON.stringify(secondCall)).toContain('got 42');
  });

  it('works with permission rules', async () => {
    const model = new FakeModel();
    model.script = [
      { ...baseResult, toolCalls: [{ id: 'b1', name: 'Bash', input: { command: 'echo hi' } }], stopReason: 'tool_use' },
      { ...baseResult, text: 'ran bash' },
    ];
    const engine = new QueryEngine({
      cwd: process.cwd(),
      tools: getTools('all'),
      model,
      toolContext: toolContext(),
      permissionMode: 'default',
      permissionRules: createPermissionRuleSet([
        { bucket: 'allow', pattern: 'Bash(echo *)' },
      ]),
      headless: true,
    });
    const { terminal } = await drain(engine.submitMessage('echo hi'));
    expect(terminal.state).toBe('success');
    expect(JSON.stringify(model.calls[1] ?? [])).toContain('hi');
  }, 15000);
});
