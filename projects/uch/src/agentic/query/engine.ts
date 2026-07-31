import type { Message, StreamEvent, Terminal, MessageUsage } from '../types.js';
import type { ModelCaller } from '../model/caller.js';
import type { Tool, ToolUseContext, CanUseToolFn } from '../tools/types.js';
import type { PermissionMode, PermissionRuleSet } from '../permissions/permissions.js';
import { queryLoop } from './loop.js';
import type { StopHook } from './stop-hooks.js';
import { emptyUsage } from '../state/session-state.js';
import { computeCostUsd } from './token-budget.js';
import { hasPermissionsToUseTool, EMPTY_PERMISSION_RULE_SET } from '../permissions/permissions.js';
import type { PermissionDecision } from '../tools/types.js';
import type { Store } from '../state/store.js';
import type { AgenticSessionState } from '../state/session-state.js';

export interface QueryEngineConfig {
  cwd: string;
  tools: Tool[];
  model: ModelCaller;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  canUseTool?: CanUseToolFn;
  permissionMode?: PermissionMode;
  permissionRules?: PermissionRuleSet;
  headless?: boolean;
  initialMessages?: Message[];
  maxTurns?: number;
  maxBudgetUsd?: number;
  maxBudgetTokens?: number;
  abortController?: AbortController;
  toolContext: ToolUseContext;
  stopHooks?: StopHook[];
  stateStore?: Store<AgenticSessionState>;
  onMessage?: (message: Message) => void;
  onToolResult?: (messages: Message[]) => void;
  extractMemories?: (text: string) => Promise<unknown>;
  triggerDream?: () => Promise<unknown>;
  autoCompact?: boolean;
  maxContextTokens?: number;
}

export interface SubmitMessageOptions {
  uuid?: string;
  isMeta?: boolean;
}

export class QueryEngine {
  private config: QueryEngineConfig;
  private mutableMessages: Message[];
  private abortController: AbortController;
  private permissionDenials: { toolName: string; toolUseId: string; toolInput: Record<string, unknown> }[];
  private totalUsage: MessageUsage;
  private discoveredSkillNames = new Set<string>();
  private running = false;
  private lastTerminal: Terminal | null = null;

  constructor(config: QueryEngineConfig) {
    this.config = config;
    this.mutableMessages = config.initialMessages ?? [];
    this.abortController = config.abortController ?? new AbortController();
    this.permissionDenials = [];
    this.totalUsage = emptyUsage();
  }

  get messages(): Message[] {
    return this.mutableMessages;
  }

  get usage(): MessageUsage {
    return this.totalUsage;
  }

  get costUsd(): number {
    return computeCostUsd(this.totalUsage, this.config.model.modelName);
  }

  get permissionDenialCount(): number {
    return this.permissionDenials.length;
  }

  get skillNames(): string[] {
    return [...this.discoveredSkillNames];
  }

  get isRunning(): boolean {
    return this.running;
  }

  getTerminal(): Terminal | null {
    return this.lastTerminal;
  }

  abort(): void {
    this.abortController.abort();
  }

  setMessages(updater: (prev: Message[]) => Message[]): void {
    this.mutableMessages = updater(this.mutableMessages);
  }

  async *submitMessage(
    prompt: string,
    options?: SubmitMessageOptions,
  ): AsyncGenerator<StreamEvent, Terminal> {
    if (this.running) {
      throw new Error('QueryEngine is already running a turn');
    }
    this.running = true;
    this.discoveredSkillNames.clear();

    try {
      const userMessage: Message = {
        id: options?.uuid ?? `um_${Math.random().toString(36).slice(2, 10)}`,
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        timestamp: new Date().toISOString(),
        metadata: options?.isMeta ? { isMeta: true } : undefined,
      };
      this.mutableMessages.push(userMessage);
      this.config.onMessage?.(userMessage);

      const wrappedCanUseTool: CanUseToolFn = async (toolName, input, context) => {
        let result: PermissionDecision;
        if (this.config.canUseTool) {
          result = await this.config.canUseTool(toolName, input, context);
        } else {
          const tool = this.config.tools.find((t) => t.name === toolName);
          if (!tool) {
            result = { behavior: 'deny', reason: `Unknown tool: ${toolName}` };
          } else {
            result = await hasPermissionsToUseTool(tool, input, context, {
              mode: this.config.permissionMode ?? 'default',
              rules: this.config.permissionRules ?? EMPTY_PERMISSION_RULE_SET,
              headless: this.config.headless,
            });
          }
        }
        if (result.behavior !== 'allow') {
          this.permissionDenials.push({
            toolName,
            toolUseId: `permission-${this.permissionDenials.length}`,
            toolInput: input,
          });
        }
        return result;
      };

      const terminal = yield* queryLoop({
        messages: this.mutableMessages,
        tools: this.config.tools,
        systemPrompt: this.config.systemPrompt,
        appendSystemPrompt: this.config.appendSystemPrompt,
        cwd: this.config.cwd,
        model: this.config.model,
        maxTurns: this.config.maxTurns,
        maxBudgetTokens: this.config.maxBudgetTokens,
        permissionMode: this.config.permissionMode,
        permissionRules: this.config.permissionRules,
        headless: this.config.headless,
        canUseTool: wrappedCanUseTool,
        abortController: this.abortController,
        toolContext: {
          ...this.config.toolContext,
          permissionDecision: wrappedCanUseTool,
        },
        stopHooks: this.config.stopHooks,
        onToolResult: this.config.onToolResult,
        onMessagesReplaced: (messages) => {
          this.mutableMessages = messages;
        },
        extractMemories: this.config.extractMemories,
        triggerDream: this.config.triggerDream,
        autoCompact: this.config.autoCompact,
        maxContextTokens: this.config.maxContextTokens,
      });

      this.totalUsage = mergeUsages(this.totalUsage, terminal.usage);
      this.lastTerminal = terminal;
      return terminal;
    } finally {
      this.running = false;
    }
  }
}

function mergeUsages(a: MessageUsage, b: MessageUsage): MessageUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: (a.cacheReadInputTokens ?? 0) + (b.cacheReadInputTokens ?? 0),
    cacheCreationInputTokens: (a.cacheCreationInputTokens ?? 0) + (b.cacheCreationInputTokens ?? 0),
  };
}
