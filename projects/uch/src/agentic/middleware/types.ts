import type { Message } from '../types.js';
import type { Tool, ToolUseContext } from '../tools/types.js';

export interface MiddlewareContext {
  messages: Message[];
  systemPrompt: string;
  cwd: string;
  toolContext: ToolUseContext;
}

export interface AgentMiddleware {
  name: string;
  tools?: () => Tool[];
  systemPrompt?: (current: string, context: MiddlewareContext) => string | Promise<string>;
  beforeModelCall?: (context: MiddlewareContext) => Promise<MiddlewareContext | null>;
  afterToolResult?: (context: MiddlewareContext) => Promise<void>;
  onError?: (error: unknown, context: MiddlewareContext) => Promise<void>;
}

export function isMiddleware(value: unknown): value is AgentMiddleware {
  return typeof value === 'object' && value !== null && typeof (value as AgentMiddleware).name === 'string';
}
