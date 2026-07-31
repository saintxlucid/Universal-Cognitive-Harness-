import type { Message, ModelCallResult, StreamEvent, Terminal, MessageUsage } from '../types.js';
import type { ModelCaller } from '../model/caller.js';
import type { Tool, ToolUseContext, CanUseToolFn } from '../tools/types.js';
import type { PermissionMode, PermissionRuleSet } from '../permissions/permissions.js';
import { buildSystemPrompt } from '../context/prompt-builder.js';
import { shouldAutoCompact, compactConversation, mergeUsage } from '../context/compaction.js';
import { runToolsPartitioned } from './tool-execution.js';
import { checkTokenBudget, createContinuationTracker, recordContinuation, shouldStopContinuations, getMaxOutputTokensForModel } from './token-budget.js';
import { handleStopHooks, type StopHook, type StopHookContext } from './stop-hooks.js';
import { hasPermissionsToUseTool } from '../permissions/permissions.js';

export interface QueryLoopOptions {
  messages: Message[];
  tools: Tool[];
  systemPrompt?: string;
  appendSystemPrompt?: string;
  cwd: string;
  model: ModelCaller;
  maxTurns?: number;
  maxBudgetTokens?: number;
  permissionMode?: PermissionMode;
  permissionRules?: PermissionRuleSet;
  headless?: boolean;
  canUseTool?: CanUseToolFn;
  abortController?: AbortController;
  toolContext: ToolUseContext;
  stopHooks?: StopHook[];
  onToolResult?: (messages: Message[]) => void;
  onMessagesReplaced?: (messages: Message[]) => void;
  extractMemories?: (text: string) => Promise<unknown>;
  triggerDream?: () => Promise<unknown>;
  autoCompact?: boolean;
  maxContextTokens?: number;
}

const MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3;

export interface QueryLoopState {
  messages: Message[];
  usage: MessageUsage;
  turnCount: number;
  lastStopReason: string | null;
  maxOutputTokensRecoveryCount: number;
}

export async function* queryLoop(
  options: QueryLoopOptions,
): AsyncGenerator<StreamEvent, Terminal> {
  const abortController = options.abortController ?? new AbortController();
  const maxTurns = options.maxTurns ?? 50;
  const maxOutputTokens = getMaxOutputTokensForModel(options.model.modelName);
  const continuationTracker = createContinuationTracker();
  const maxContextTokens = options.maxContextTokens ?? 200000;
  const enableAutoCompact = options.autoCompact ?? true;

  const state: QueryLoopState = {
    messages: options.messages,
    usage: { inputTokens: 0, outputTokens: 0 },
    turnCount: 0,
    lastStopReason: null,
    maxOutputTokensRecoveryCount: 0,
  };

  const systemPrompt = buildSystemPrompt({
    tools: options.tools,
    systemPrompt: options.systemPrompt,
    appendSystemPrompt: options.appendSystemPrompt,
    cwd: options.cwd,
    date: new Date().toISOString(),
  });

  yield { type: 'request-start' };

  while (true) {
    if (abortController.signal.aborted) {
      return {
        state: 'aborted',
        message: 'Query aborted',
        turnCount: state.turnCount,
        usage: state.usage,
      };
    }

    if (state.turnCount >= maxTurns) {
      return {
        state: 'success',
        message: `Reached max turns (${maxTurns})`,
        turnCount: state.turnCount,
        usage: state.usage,
      };
    }

    if (enableAutoCompact && shouldAutoCompact(state.messages, maxContextTokens)) {
      const compacted = await compactConversation({
        messages: state.messages,
        maxContextTokens: maxContextTokens * 0.6,
        summarize: async (text) => {
          const result = await options.model.call(
            [{ id: 'compact', role: 'user', content: [{ type: 'text', text }], timestamp: new Date().toISOString() }],
            { systemPrompt: 'You are a conversation summarizer.', maxTokens: 2048 },
          );
          return result.text;
        },
      });
      state.messages = compacted.messages;
      options.onMessagesReplaced?.(state.messages);
      yield {
        type: 'stream-event',
        data: { compactedMessages: compacted.compactedMessages, summary: compacted.summary.slice(0, 200) },
      };
    }

    const budget = checkTokenBudget({ totalTokens: maxBudgetOrFallback(options.maxBudgetTokens), budgetTokens: 0, usedTokens: 0, continuationCount: 0 }, state.usage);
    if (!budget.ok && state.turnCount > 0) {
      return {
        state: 'budget-exceeded',
        message: budget.reason ?? 'Budget exceeded',
        turnCount: state.turnCount,
        usage: state.usage,
      };
    }

    if (shouldStopContinuations(continuationTracker)) {
      return {
        state: 'success',
        message: 'Diminishing returns detected, ending turn',
        turnCount: state.turnCount,
        usage: state.usage,
      };
    }

    let modelResult: ModelCallResult;
    try {
      modelResult = await options.model.call(state.messages, {
        systemPrompt,
        maxTokens: maxOutputTokens,
        signal: abortController.signal,
      });
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { state: 'aborted', message: 'Query aborted', turnCount: state.turnCount, usage: state.usage };
      }
      if (errMessage.includes('max_output_tokens') && state.maxOutputTokensRecoveryCount < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT) {
        state.maxOutputTokensRecoveryCount += 1;
        yield { type: 'stream-event', data: { recovery: 'max_output_tokens' } };
        continue;
      }
      if (errMessage.includes('prompt_too_long')) {
        const compacted = await compactConversation({
          messages: state.messages,
          maxContextTokens: maxContextTokens * 0.4,
          summarize: async (text) => {
            const result = await options.model.call(
              [{ id: 'ptl-compact', role: 'user', content: [{ type: 'text', text }], timestamp: new Date().toISOString() }],
              { systemPrompt: 'You are a conversation summarizer.', maxTokens: 2048 },
            );
            return result.text;
          },
        });
        state.messages = compacted.messages;
        options.onMessagesReplaced?.(state.messages);
        yield { type: 'stream-event', data: { recovery: 'prompt_too_long' } };
        continue;
      }
      return {
        state: 'error',
        message: errMessage,
        turnCount: state.turnCount,
        usage: state.usage,
      };
    }

    state.turnCount += 1;
    state.usage = mergeUsage(state.usage, modelResult.usage);
    recordContinuation(continuationTracker, modelResult.usage);
    state.lastStopReason = modelResult.stopReason;

    const assistantMessage: Message = {
      id: `am_${Math.random().toString(36).slice(2, 10)}`,
      role: 'assistant',
      content: [
        ...(modelResult.text ? [{ type: 'text' as const, text: modelResult.text }] : []),
        ...modelResult.toolCalls.map((call) => ({
          type: 'tool_use' as const,
          id: call.id,
          name: call.name,
          input: call.input,
        })),
      ],
      timestamp: new Date().toISOString(),
      metadata: { stopReason: modelResult.stopReason ?? undefined },
    };

    yield { type: 'message', message: assistantMessage };
    state.messages.push(assistantMessage);

    if (modelResult.toolCalls.length === 0) {
      yield { type: 'done' };
      const terminal: Terminal = {
        state: 'success',
        message: 'Turn completed',
        turnCount: state.turnCount,
        usage: state.usage,
      };
      const hookContext: StopHookContext = {
        messages: state.messages,
        terminal,
        extractMemories: options.extractMemories,
        triggerDream: options.triggerDream,
      };
      if (options.stopHooks && options.stopHooks.length > 0) {
        const results = await handleStopHooks(options.stopHooks, hookContext);
        for (const result of results) {
          if (result.newMessages) {
            state.messages.push(...result.newMessages);
          }
        }
      }
      return terminal;
    }

    const execution = await runToolsPartitioned(
      modelResult.toolCalls,
      assistantMessage,
      {
        tools: options.tools,
        context: options.toolContext,
        canUseTool:
          options.canUseTool ??
          ((toolName: string, input: Record<string, unknown>) =>
            hasPermissionsToUseToolWrapper(toolName, input, options)),
        permissionMode: options.permissionMode,
        permissionRules: options.permissionRules,
        headless: options.headless,
      },
    );

    state.messages.push(...execution.messages);
    options.onToolResult?.(execution.messages);
  }
}

function maxBudgetOrFallback(budget?: number): number {
  return budget ?? 500000;
}

async function hasPermissionsToUseToolWrapper(
  toolName: string,
  input: Record<string, unknown>,
  options: QueryLoopOptions,
) {
  const tool = options.tools.find((t) => t.name === toolName);
  if (!tool) return { behavior: 'deny' as const, reason: `Unknown tool: ${toolName}` };
  return hasPermissionsToUseTool(tool, input, options.toolContext, {
    mode: options.permissionMode ?? 'default',
    rules: options.permissionRules ?? { alwaysAllow: [], alwaysDeny: [], alwaysAsk: [] },
    headless: options.headless,
  });
}
