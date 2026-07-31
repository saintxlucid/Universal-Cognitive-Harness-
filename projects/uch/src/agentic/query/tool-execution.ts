import type { Message, ToolCall } from '../types.js';
import type { Tool, ToolUseContext, CanUseToolFn, ToolCallProgress } from '../tools/types.js';
import { findToolByName, validateInputAgainstSchema, toolResultToBlock } from '../tools/types.js';
import { hasPermissionsToUseTool, type PermissionRuleSet, type PermissionMode } from '../permissions/permissions.js';

export interface ToolExecutionOptions {
  tools: Tool[];
  context: ToolUseContext;
  canUseTool?: CanUseToolFn;
  permissionMode?: PermissionMode;
  permissionRules?: PermissionRuleSet;
  headless?: boolean;
  maxConcurrency?: number;
}

export interface ToolExecutionResult {
  messages: Message[];
  failures: { toolCall: ToolCall; error: string }[];
}

export const MAX_TOOL_CONCURRENCY = 10;

export async function runTools(
  toolCalls: ToolCall[],
  assistantMessage: Message,
  options: ToolExecutionOptions,
): Promise<ToolExecutionResult> {
  const toolResults: Message[] = [];

  const withResults = toolCalls.map(async (call) => {
    return runToolUse(call, assistantMessage, options);
  });

  const results = await Promise.all(withResults);

  for (const result of results) {
    toolResults.push(...result.messages);
  }

  return {
    messages: toolResults,
    failures: results.flatMap((r) => r.failures),
  };
}

export async function runToolUse(
  toolCall: ToolCall,
  assistantMessage: Message,
  options: ToolExecutionOptions,
): Promise<ToolExecutionResult> {
  const { tools, context } = options;
  const tool = findToolByName(tools, toolCall.name);
  if (!tool) {
    const block = {
      type: 'tool_result' as const,
      toolUseId: toolCall.id,
      content: `Unknown tool: ${toolCall.name}`,
      isError: true,
    };
    return {
      messages: [createToolResultMessage([block], assistantMessage.id)],
      failures: [{ toolCall, error: `Unknown tool: ${toolCall.name}` }],
    };
  }

  try {
    if (context.abortController.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const schemaError = validateInputAgainstSchema(toolCall.input, tool.inputSchema);
    if (schemaError) {
      return {
        messages: [createToolResultMessage([
          { type: 'tool_result', toolUseId: toolCall.id, content: `Invalid input: ${schemaError}`, isError: true },
        ], assistantMessage.id)],
        failures: [{ toolCall, error: schemaError }],
      };
    }

    const toolError = tool.validateInput ? await tool.validateInput(toolCall.input as never, context) : null;
    if (toolError) {
      return {
        messages: [createToolResultMessage([
          { type: 'tool_result', toolUseId: toolCall.id, content: toolError, isError: true },
        ], assistantMessage.id)],
        failures: [{ toolCall, error: toolError }],
      };
    }

    if (options.canUseTool) {
      const decision = await options.canUseTool(tool.name, toolCall.input, context);
      if (decision.behavior !== 'allow') {
        const reason = decision.reason ?? 'Permission denied';
        return {
          messages: [createToolResultMessage([
            { type: 'tool_result', toolUseId: toolCall.id, content: `Permission denied: ${reason}`, isError: true },
          ], assistantMessage.id)],
          failures: [{ toolCall, error: reason }],
        };
      }
    } else {
      const decision = await hasPermissionsToUseTool(
        tool,
        toolCall.input,
        context,
        {
          mode: options.permissionMode ?? 'default',
          rules: options.permissionRules ?? { alwaysAllow: [], alwaysDeny: [], alwaysAsk: [] },
          headless: options.headless,
        },
      );
      if (decision.behavior !== 'allow') {
        const reason = decision.reason ?? 'Permission denied';
        return {
          messages: [createToolResultMessage([
            { type: 'tool_result', toolUseId: toolCall.id, content: `Permission denied: ${reason}`, isError: true },
          ], assistantMessage.id)],
          failures: [{ toolCall, error: reason }],
        };
      }
    }

    const progress: ToolCallProgress[] = [];
    const result = await tool.call(toolCall.input as never, context, (p) => progress.push(p));
    const block = toolResultToBlock(toolCall.id, tool.name, result);
    const resultMessage = createToolResultMessage([block], assistantMessage.id);

    return {
      messages: [resultMessage],
      failures: result.isError ? [{ toolCall, error: String(result.data) }] : [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      messages: [createToolResultMessage([
        { type: 'tool_result', toolUseId: toolCall.id, content: `Tool error: ${message}`, isError: true },
      ], assistantMessage.id)],
      failures: [{ toolCall, error: message }],
    };
  }
}

export function partitionToolCalls(toolCalls: ToolCall[], tools: Tool[]): ToolCall[][] {
  const batches: ToolCall[][] = [];
  let current: ToolCall[] = [];
  for (const call of toolCalls) {
    const tool = findToolByName(tools, call.name);
    const isSafe = tool?.isConcurrencySafe?.(call.input as never) ?? false;
    if (isSafe) {
      current.push(call);
      if (current.length >= MAX_TOOL_CONCURRENCY) {
        batches.push(current);
        current = [];
      }
    } else {
      if (current.length > 0) {
        batches.push(current);
        current = [];
      }
      batches.push([call]);
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function createToolResultMessage(
  blocks: { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean }[],
  sourceAssistantId: string,
): Message {
  return {
    id: `tr_${Math.random().toString(36).slice(2, 10)}`,
    role: 'user',
    content: blocks,
    timestamp: new Date().toISOString(),
    metadata: { sourceAssistantId },
  };
}

export async function runToolsPartitioned(
  toolCalls: ToolCall[],
  assistantMessage: Message,
  options: ToolExecutionOptions,
): Promise<ToolExecutionResult> {
  const batches = partitionToolCalls(toolCalls, options.tools);
  const messages: Message[] = [];
  const failures: { toolCall: ToolCall; error: string }[] = [];
  for (const batch of batches) {
    const result = await runTools(batch, assistantMessage, options);
    messages.push(...result.messages);
    failures.push(...result.failures);
  }
  return { messages, failures };
}
