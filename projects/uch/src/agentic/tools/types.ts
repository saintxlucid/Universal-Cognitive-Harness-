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
  roots?: string[];
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

interface TypeCheck {
  type: string;
  invalid: (value: unknown) => boolean;
  message: (key: string) => string;
}

const TYPE_CHECKS: TypeCheck[] = [
  { type: 'string', invalid: (v) => typeof v !== 'string', message: (key) => `Input ${key} must be a string` },
  { type: 'number', invalid: (v) => typeof v !== 'number', message: (key) => `Input ${key} must be a number` },
  { type: 'boolean', invalid: (v) => typeof v !== 'boolean', message: (key) => `Input ${key} must be a boolean` },
  { type: 'array', invalid: (v) => !Array.isArray(v), message: (key) => `Input ${key} must be an array` },
  { type: 'object', invalid: (v) => typeof v !== 'object' || Array.isArray(v), message: (key) => `Input ${key} must be an object` },
];

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
    const typeCheck = TYPE_CHECKS.find((check) => check.type === prop.type);
    if (typeCheck && typeCheck.invalid(value)) {
      return typeCheck.message(key);
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
