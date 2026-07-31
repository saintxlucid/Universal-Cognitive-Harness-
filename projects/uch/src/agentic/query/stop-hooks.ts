import type { Message, Terminal } from '../types.js';
import type { ModelCaller } from '../model/caller.js';

export interface StopHook {
  name: string;
  run(context: StopHookContext): Promise<StopHookResult>;
}

export interface StopHookContext {
  messages: Message[];
  terminal: Terminal;
  extractMemories?: (text: string) => Promise<unknown>;
  triggerDream?: () => Promise<unknown>;
}

export interface StopHookResult {
  newMessages?: Message[];
  memoryExtraction?: unknown;
  dreamTriggered?: boolean;
}

export function createStopHook(definition: {
  name: string;
  run: (context: StopHookContext) => Promise<StopHookResult>;
}): StopHook {
  return definition;
}

export const MEMORY_EXTRACTION_HOOK = createStopHook({
  name: 'memory-extraction',
  run: async (context) => {
    if (!context.extractMemories) return {};
    const lastTexts = context.messages
      .slice(-4)
      .flatMap((m) => m.content)
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    if (!lastTexts.trim()) return {};
    const memoryExtraction = await context.extractMemories(lastTexts);
    return { memoryExtraction };
  },
});

export const DREAM_TRIGGER_HOOK = createStopHook({
  name: 'dream-trigger',
  run: async (context) => {
    if (!context.triggerDream) return {};
    if (context.messages.length < 12) return {};
    const dreamTriggered = await context.triggerDream();
    return { dreamTriggered: dreamTriggered !== undefined };
  },
});

export async function handleStopHooks(
  hooks: StopHook[],
  context: StopHookContext,
): Promise<StopHookResult[]> {
  const results: StopHookResult[] = [];
  for (const hook of hooks) {
    try {
      results.push(await hook.run(context));
    } catch {
      results.push({});
    }
  }
  return results;
}

export async function runAutoDream(
  model: ModelCaller,
  messages: Message[],
  extractMemories: (text: string) => Promise<unknown>,
): Promise<unknown> {
  const recent = messages.slice(-10);
  const transcript = recent
    .flatMap((m) => m.content)
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  if (!transcript.trim()) return undefined;
  const result = await model.call(
    [
      {
        id: 'dream',
        role: 'user',
        content: [{ type: 'text', text: `Extract durable memories worth remembering from:\n${transcript.slice(0, 12000)}` }],
        timestamp: new Date().toISOString(),
      },
    ],
    { systemPrompt: 'You are a memory consolidator. Output key durable facts, decisions, and patterns.', maxTokens: 1024 },
  );
  if (!result.text.trim()) return undefined;
  return extractMemories(result.text);
}
