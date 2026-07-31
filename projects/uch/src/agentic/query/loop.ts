import type { Message, ModelCallResult, StreamEvent, Terminal, MessageUsage } from '../types.js';
import type { ModelCaller } from '../model/caller.js';
import type { Tool, ToolUseContext, CanUseToolFn } from '../tools/types.js';
import type { PermissionMode, PermissionRuleSet } from '../permissions/permissions.js';
import { buildSystemPrompt } from '../context/prompt-builder.js';
import { shouldAutoCompact, compactConversation, mergeUsage, type CompactResult } from '../context/compaction.js';
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
      return makeTerminal(state, 'aborted', 'Query aborted');
    }

    if (state.turnCount >= maxTurns) {
      return makeTerminal(state, 'success', `Reached max turns (${maxTurns})`);
    }

    if (enableAutoCompact && shouldAutoCompact(state.messages, maxContextTokens)) {
      const compacted = await compactIfNeeded(options, state, maxContextTokens, 0.6, 'compact');
      yield {
        type: 'stream-event',
        data: { compactedMessages: compacted.compactedMessages, summary: compacted.summary.slice(0, 200) },
      };
    }

    const budget = checkTokenBudget({ totalTokens: maxBudgetOrFallback(options.maxBudgetTokens), budgetTokens: 0, usedTokens: 0, continuationCount: 0 }, state.usage);
    if (!budget.ok && state.turnCount > 0) {
      return makeTerminal(state, 'budget-exceeded', budget.reason ?? 'Budget exceeded');
    }

    if (shouldStopContinuations(continuationTracker)) {
      return makeTerminal(state, 'success', 'Diminishing returns detected, ending turn');
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
        return makeTerminal(state, 'aborted', 'Query aborted');
      }
      if (errMessage.includes('max_output_tokens') && state.maxOutputTokensRecoveryCount < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT) {
        state.maxOutputTokensRecoveryCount += 1;
        yield { type: 'stream-event', data: { recovery: 'max_output_tokens' } };
        continue;
      }
      if (errMessage.includes('prompt_too_long')) {
        await compactIfNeeded(options, state, maxContextTokens, 0.4, 'ptl-compact');
        yield { type: 'stream-event', data: { recovery: 'prompt_too_long' } };
        continue;
      }
      return makeTerminal(state, 'error', errMessage);
    }

    state.turnCount += 1;
    state.usage = mergeUsage(state.usage, modelResult.usage);
    recordContinuation(continuationTracker, modelResult.usage);
    state.lastStopReason = modelResult.stopReason;

    const assistantMessage = buildAssistantMessage(modelResult);
    yield { type: 'message', message: assistantMessage };
    state.messages.push(assistantMessage);

    if (modelResult.toolCalls.length === 0) {
      yield { type: 'done' };
      const terminal = makeTerminal(state, 'success', 'Turn completed');
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

function makeTerminal(state: QueryLoopState, status: Terminal['state'], message: string): Terminal {
  return {
    state: status,
    message,
    turnCount: state.turnCount,
    usage: state.usage,
  };
}

function buildAssistantMessage(modelResult: ModelCallResult): Message {
  return {
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
}

function summarizeWith(model: ModelCaller, messageId: string) {
  return async (text: string): Promise<string> => {
    const result = await model.call(
      [{ id: messageId, role: 'user', content: [{ type: 'text', text }], timestamp: new Date().toISOString() }],
      { systemPrompt: 'You are a conversation summarizer.', maxTokens: 2048 },
    );
    return result.text;
  };
}

async function compactIfNeeded(
  options: QueryLoopOptions,
  state: QueryLoopState,
  maxContextTokens: number,
  factor: number,
  summarizeId: string,
): Promise<CompactResult> {
  const compacted = await compactConversation({
    messages: state.messages,
    maxContextTokens: maxContextTokens * factor,
    summarize: summarizeWith(options.model, summarizeId),
  });
  state.messages = compacted.messages;
  options.onMessagesReplaced?.(state.messages);
  return compacted;
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
