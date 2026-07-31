import type { ToolCall } from '../types.js';

const TOOL_CALL_RE = /<tool_call(?:\s+name="([^"]+)")?(?:\s+id="([^"]+)")?[^>]*>([\s\S]*?)<\/tool_call>/g;

export function parseToolCallsFromText(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let match: RegExpExecArray | null;
  TOOL_CALL_RE.lastIndex = 0;
  while ((match = TOOL_CALL_RE.exec(text)) !== null) {
    const name = match[1]?.trim();
    const id = match[2]?.trim() ?? `tc_${Math.random().toString(36).slice(2, 10)}`;
    if (!name) continue;
    const rawInput = match[3]?.trim() ?? '';
    calls.push({ id, name, input: parseToolInput(rawInput) });
  }
  if (calls.length > 0) return calls;

  const inlineRe = /<tool_call\s+name="([^"]+)"\s*\/>/g;
  while ((match = inlineRe.exec(text)) !== null) {
    const name = match[1]?.trim();
    if (!name) continue;
    calls.push({
      id: `tc_${Math.random().toString(36).slice(2, 10)}`,
      name,
      input: {},
    });
  }
  return calls;
}

export function parseToolInput(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('<input>') && trimmed.endsWith('</input>')) {
    return parseToolInput(trimmed.slice(7, -8));
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return parseKeyValuePairs(trimmed);
    }
  }
  return parseKeyValuePairs(trimmed);
}

export function parseKeyValuePairs(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const re = /([^\s=]+)=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const key = match[1];
    let value = match[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

export function hasToolCallSyntax(text: string): boolean {
  return /<tool_call[\s>]/.test(text);
}

export function renderToolCallXml(toolCalls: ToolCall[]): string {
  return toolCalls
    .map(
      (call) =>
        `<tool_call name="${call.name}" id="${call.id}"><input>${JSON.stringify(call.input)}</input></tool_call>`,
    )
    .join('\n');
}
