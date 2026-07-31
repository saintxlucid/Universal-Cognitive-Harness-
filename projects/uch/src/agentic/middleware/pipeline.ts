import type { AgentMiddleware, MiddlewareContext } from './types.js';

export const PROTECTED_MIDDLEWARE = new Set<string>(['FilesystemMiddleware', 'SubAgentMiddleware']);

export interface AssemblyOptions {
  base?: AgentMiddleware[];
  user?: AgentMiddleware[];
  tail?: AgentMiddleware[];
  excluded?: string[];
}

export function assembleMiddleware(options: AssemblyOptions): AgentMiddleware[] {
  const stack = [...(options.base ?? []), ...(options.user ?? []), ...(options.tail ?? [])];
  return applyExcludedMiddleware(stack, options.excluded ?? []);
}

export function applyExcludedMiddleware(stack: AgentMiddleware[], excluded: string[]): AgentMiddleware[] {
  if (excluded.length === 0) return [...stack];
  for (const name of excluded) {
    if (name.startsWith('_')) {
      throw new Error(`Cannot exclude private middleware: ${name}`);
    }
    if (PROTECTED_MIDDLEWARE.has(name)) {
      throw new Error(`Cannot exclude protected middleware: ${name}`);
    }
  }
  const excludedSet = new Set(excluded);
  const matched = new Set<string>();
  const result = stack.filter((middleware) => {
    if (excludedSet.has(middleware.name)) {
      matched.add(middleware.name);
      return false;
    }
    return true;
  });
  for (const name of excluded) {
    if (!matched.has(name)) {
      throw new Error(`Excluded middleware not present in stack: ${name}`);
    }
  }
  return result;
}

export function mergeMiddlewareStacks(base: AgentMiddleware[], extra: AgentMiddleware[]): AgentMiddleware[] {
  const names = new Set(extra.map((m) => m.name));
  return [...base.filter((m) => !names.has(m.name)), ...extra];
}

export function collectMiddlewareTools(stack: AgentMiddleware[]): ToolLike[] {
  return stack.flatMap((middleware) => middleware.tools?.() ?? []);
}

export function collectMiddlewareSystemPromptContributions(
  stack: AgentMiddleware[],
  current: string,
  context: MiddlewareContext,
): Promise<string> {
  return stack.reduce<Promise<string>>(async (acc, middleware) => {
    const prompt = await acc;
    if (!middleware.systemPrompt) return prompt;
    return middleware.systemPrompt(prompt, context);
  }, Promise.resolve(current));
}

export function findMiddleware(stack: AgentMiddleware[], name: string): AgentMiddleware | undefined {
  return stack.find((middleware) => middleware.name === name);
}

interface ToolLike {
  name: string;
}
