export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  id: string;
  role: MessageRole;
  content: ContentBlock[];
  usage?: MessageUsage;
  apiError?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MessageUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ModelCallResult {
  text: string;
  toolCalls: ToolCall[];
  usage: MessageUsage;
  stopReason: string | null;
}

export type StreamEventType =
  | 'request-start'
  | 'stream-event'
  | 'message'
  | 'tombstone'
  | 'tool-use-summary'
  | 'done';

export interface StreamEvent<T = unknown> {
  type: StreamEventType;
  message?: Message;
  partialText?: string;
  toolCall?: ToolCall;
  error?: string;
  data?: T;
}

export interface Terminal {
  state: 'success' | 'error' | 'aborted' | 'max-tokens' | 'budget-exceeded';
  message: string;
  turnCount: number;
  usage: MessageUsage;
}

export interface AgenticConfig {
  cwd: string;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  model?: string;
  maxTokens?: number;
  maxOutputTokens?: number;
  autoCompactThresholdRatio?: number;
  compactMinMessages?: number;
  permissionMode?: string;
  permissionRules?: PermissionRuleConfig[];
  historyFile?: string;
  abortController?: AbortController;
}

export interface PermissionRuleConfig {
  bucket: 'allow' | 'deny' | 'ask';
  pattern: string;
  source?: string;
}

export interface TaskModel {
  id: string;
  type: string;
  status: TaskStatus;
  description: string;
  createdAt: Date;
  result?: string;
  error?: string;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
