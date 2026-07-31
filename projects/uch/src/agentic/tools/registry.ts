import { findToolByName, type Tool } from './types.js';

export type { Tool } from './types.js';
import {
  AskUserQuestionTool,
  BashTool,
  FileEditTool,
  FileReadTool,
  FileWriteTool,
  GlobTool,
  GrepTool,
  MemoryTool,
  SleepTool,
  SubagentTool,
  TodoWriteTool,
  WebFetchTool,
} from './implementations.js';

export function getAllBaseTools(): Tool[] {
  return [
    BashTool,
    FileReadTool,
    FileEditTool,
    FileWriteTool,
    GlobTool,
    GrepTool,
    WebFetchTool,
    TodoWriteTool,
    MemoryTool,
    AskUserQuestionTool,
    SleepTool,
    SubagentTool,
  ];
}

export type ToolVisibility = 'all' | 'readonly' | 'core' | 'reasoning';

const EXECUTION_TOOLS = ['Bash', 'Edit', 'Write'] as const;

export function getTools(visibility: ToolVisibility = 'all'): Tool[] {
  const all = getAllBaseTools();
  if (visibility === 'all') {
    return all.filter((t) => t.isEnabled?.() !== false);
  }
  if (visibility === 'readonly') {
    return all.filter((t) => t.isEnabled?.() !== false && t.isReadOnly?.({} as never) !== false);
  }
  if (visibility === 'reasoning') {
    return all.filter((t) =>
      t.isEnabled?.() !== false &&
      !(EXECUTION_TOOLS as readonly string[]).includes(t.name),
    );
  }
  const core = all.filter((t) => t.isEnabled?.() !== false);
  return core.filter((t) =>
    ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Memory'].includes(t.name),
  );
}

export function assembleToolPool(
  builtIn: Tool[],
  extra: Tool[] = [],
  denyRules: string[] = [],
): Tool[] {
  const denied = new Set(denyRules);
  const byName = new Map<string, Tool>();
  for (const tool of builtIn) {
    if (denied.has(tool.name)) continue;
    byName.set(tool.name, tool);
  }
  for (const tool of extra) {
    if (denied.has(tool.name)) continue;
    if (byName.has(tool.name)) continue;
    byName.set(tool.name, tool);
  }
  const sorted = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

export function filterToolsByDenyRules(tools: Tool[], denyRules: string[]): Tool[] {
  if (denyRules.length === 0) return tools;
  const denied = new Set(denyRules);
  return tools.filter((t) => !denied.has(t.name));
}

export function registerTool(tools: Tool[], tool: Tool): Tool[] {
  const idx = tools.findIndex((t) => t.name === tool.name);
  if (idx >= 0) {
    const next = [...tools];
    next[idx] = tool;
    return next;
  }
  return [...tools, tool];
}

export function registerTools(tools: Tool[], additions: Tool[]): Tool[] {
  let current = tools;
  for (const tool of additions) {
    current = registerTool(current, tool);
  }
  return current;
}

export function findTool(tools: Tool[], name: string): Tool | undefined {
  return findToolByName(tools, name);
}

export function isDeferredTool(_tool: Tool): boolean {
  return false;
}

export const SIMPLE_MODE_TOOLS = ['Bash', 'Read', 'Edit', 'Write'] as const;

export function buildSimpleModePool(): Tool[] {
  const all = getAllBaseTools();
  return all.filter((t) =>
    (SIMPLE_MODE_TOOLS as readonly string[]).includes(t.name),
  );
}
