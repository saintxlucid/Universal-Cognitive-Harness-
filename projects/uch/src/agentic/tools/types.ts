import type { Message, ToolResultBlock } from '../types.js';

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, ToolPropertySchema>;
  required?: string[];
}

export interface ToolPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  description?: string;
  enum?: string[];
  items?: ToolPropertySchema;
  default?: unknown;
}

export interface ToolUseContext {
  cwd: string;
  abortController: AbortController;
  requestPrompt?: (prompt: string, options?: { isRequired?: boolean }) => Promise<string>;
  getSessionId: () => string;
  memory?: {
    remember(content: string, importance: number): Promise<unknown>;
    recall(query: string): Promise<unknown>;
  };
  permissionDecision?: CanUseToolFn;
  getSubagentRunner?(): ((request: {
    prompt: string;
    type: string;
    model?: string;
    parentSessionId: string;
  }) => Promise<string>) | undefined;
  getAppState?(): Record<string, unknown>;
}

export interface ToolCallProgress<P = unknown> {
  type: 'progress' | 'log' | 'output';
  message: string;
  data?: P;
}

export interface ToolResult<T = unknown> {
  data: T;
  isError?: boolean;
  newMessages?: Message[];
}

export interface PermissionDecision {
  behavior: 'allow' | 'ask' | 'deny';
  reason?: string;
  updatedInput?: Record<string, unknown>;
}

export type CanUseToolFn = (
  toolName: string,
  input: Record<string, unknown>,
  context: ToolUseContext,
) => Promise<PermissionDecision>;

export interface Tool<Input extends Record<string, unknown> = Record<string, unknown>, Output = unknown> {
  name: string;
  aliases?: string[];
  description: string;
  inputSchema: ToolInputSchema;
  isEnabled?: () => boolean;
  isConcurrencySafe?: (input: Input) => boolean;
  isReadOnly?: (input: Input) => boolean;
  isDestructive?: (input: Input) => boolean;
  requiresUserInteraction?: () => boolean;
  maxResultSizeChars?: number;
  checkPermissions?: (
    input: Input,
    context: ToolUseContext,
  ) => Promise<PermissionDecision> | PermissionDecision;
  validateInput?: (input: Input, context: ToolUseContext) => Promise<string | null> | string | null;
  call(
    input: Input,
    context: ToolUseContext,
    onProgress?: (progress: ToolCallProgress) => void,
  ): Promise<ToolResult<Output>>;
}

export type ToolDef<Input extends Record<string, unknown> = Record<string, unknown>, Output = unknown> = {
  name: string;
  aliases?: string[];
  description: string;
  inputSchema: ToolInputSchema;
  isEnabled?: () => boolean;
  isConcurrencySafe?: (input: Input) => boolean;
  isReadOnly?: (input: Input) => boolean;
  isDestructive?: (input: Input) => boolean;
  requiresUserInteraction?: () => boolean;
  maxResultSizeChars?: number;
  checkPermissions?: (
    input: Input,
    context: ToolUseContext,
  ) => Promise<PermissionDecision> | PermissionDecision;
  validateInput?: (input: Input, context: ToolUseContext) => Promise<string | null> | string | null;
  call(
    input: Input,
    context: ToolUseContext,
    onProgress?: (progress: ToolCallProgress) => void,
  ): Promise<ToolResult<Output>>;
};

const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isDestructive: () => false,
  requiresUserInteraction: () => false,
  maxResultSizeChars: 50000,
};

export function buildTool<D extends ToolDef>(def: D): Tool {
  return {
    ...TOOL_DEFAULTS,
    name: def.name,
    aliases: def.aliases ?? [],
    description: def.description,
    inputSchema: def.inputSchema,
    isEnabled: def.isEnabled ?? TOOL_DEFAULTS.isEnabled,
    isConcurrencySafe: def.isConcurrencySafe ?? TOOL_DEFAULTS.isConcurrencySafe,
    isReadOnly: def.isReadOnly ?? TOOL_DEFAULTS.isReadOnly,
    isDestructive: def.isDestructive ?? TOOL_DEFAULTS.isDestructive,
    requiresUserInteraction: def.requiresUserInteraction ?? TOOL_DEFAULTS.requiresUserInteraction,
    maxResultSizeChars: def.maxResultSizeChars ?? TOOL_DEFAULTS.maxResultSizeChars,
    checkPermissions: def.checkPermissions,
    validateInput: def.validateInput,
    call: def.call,
  };
}

export function validateInputAgainstSchema(
  input: Record<string, unknown>,
  schema: ToolInputSchema,
): string | null {
  for (const key of schema.required ?? []) {
    const value = input[key];
    if (value === undefined || value === null || value === '') {
      return `Missing required input: ${key}`;
    }
  }
  for (const [key, prop] of Object.entries(schema.properties)) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (prop.type === 'string' && typeof value !== 'string') {
      return `Input ${key} must be a string`;
    }
    if (prop.type === 'number' && typeof value !== 'number') {
      return `Input ${key} must be a number`;
    }
    if (prop.type === 'boolean' && typeof value !== 'boolean') {
      return `Input ${key} must be a boolean`;
    }
    if (prop.type === 'array' && !Array.isArray(value)) {
      return `Input ${key} must be an array`;
    }
    if (prop.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      return `Input ${key} must be an object`;
    }
    if (prop.enum && typeof value === 'string' && !prop.enum.includes(value)) {
      return `Input ${key} must be one of: ${prop.enum.join(', ')}`;
    }
  }
  return null;
}

export function toolResultToBlock(
  toolUseId: string,
  toolName: string,
  result: ToolResult,
): ToolResultBlock {
  const content =
    typeof result.data === 'string'
      ? result.data
      : result.data === undefined || result.data === null
        ? `${toolName} completed with no output`
        : JSON.stringify(result.data);
  return {
    type: 'tool_result',
    toolUseId,
    content,
    isError: result.isError ?? false,
  };
}

export function findToolByName(tools: Tool[], name: string): Tool | undefined {
  return tools.find((t) => t.name === name || t.aliases?.includes(name));
}

export function toolMatchesName(tool: Tool, name: string): boolean {
  return tool.name === name || (tool.aliases?.includes(name) ?? false);
}
