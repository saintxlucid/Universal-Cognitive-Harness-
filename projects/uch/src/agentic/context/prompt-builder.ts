import type { Tool, ToolInputSchema } from '../tools/types.js';
import type { Message } from '../types.js';

export function renderToolSchema(tool: Tool): string {
  const lines = [`<tool_name>${tool.name}</tool_name>`, `<description>${tool.description}</description>`];
  const schema = tool.inputSchema;
  if (Object.keys(schema.properties).length > 0) {
    lines.push('<parameters>');
    for (const [key, prop] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(key) ?? false;
      const requiredMark = required ? ' (required)' : '';
      const enumHint = prop.enum ? ` enum=[${prop.enum.join(', ')}]` : '';
      lines.push(`  ${key}: ${prop.type}${requiredMark} — ${prop.description ?? ''}${enumHint}`);
    }
    lines.push('</parameters>');
  }
  return lines.join('\n');
}

export function renderToolsAsXml(tools: Tool[]): string {
  return tools.map(renderToolSchema).join('\n\n');
}

export function buildSystemPrompt(options: {
  tools: Tool[];
  systemPrompt?: string;
  appendSystemPrompt?: string;
  cwd: string;
  date: string;
  extraContext?: string;
}): string {
  const toolXml = renderToolsAsXml(options.tools);
  const base = options.systemPrompt
    ? options.systemPrompt
    : `You are an AI agent running inside UCH (Universal Cognitive Harness).\n\n` +
      `You have access to the following tools. Emit tool calls as XML blocks:\n` +
      `<tool_call name="ToolName" id="unique-id"><input>{"json": true}</input></tool_call>\n\n` +
      `Tool definitions:\n${toolXml}\n\n` +
      `After tool results, continue reasoning. When the task is complete, write your final answer as plain text without tool calls.`;

  const context = [
    options.extraContext,
    `Workspace: ${options.cwd}`,
    `Current date: ${options.date.slice(0, 10)}`,
  ].filter(Boolean).join('\n');

  const append = options.appendSystemPrompt ? `\n\n${options.appendSystemPrompt}` : '';
  return `${base}\n\n${context}${append}`;
}

export function buildMessagesForModel(messages: Message[]): Message[] {
  const result: Message[] = [];
  let lastRole: string | null = null;
  for (const message of messages) {
    if (message.role === 'tool') continue;
    const content = message.content.map((block) => {
      if (block.type === 'tool_result') {
        return {
          type: 'text' as const,
          text: `<tool_result id="${block.toolUseId}"${block.isError ? ' error="true"' : ''}>${block.content}</tool_result>`,
        };
      }
      return block;
    });
    if (lastRole === message.role) {
      const prev = result[result.length - 1];
      if (prev) {
        prev.content = [...prev.content, ...content];
        continue;
      }
    }
    result.push({ ...message, content });
    lastRole = message.role;
  }
  return result;
}

export function renderMessagesAsText(messages: Message[]): string {
  return messages
    .map((m) => {
      const body = m.content
        .map((block) => {
          if (block.type === 'text') return block.text;
          if (block.type === 'tool_use') {
            return `<tool_call name="${block.name}" id="${block.id}">${JSON.stringify(block.input)}</tool_call>`;
          }
          if (block.type === 'tool_result') {
            return `<tool_result id="${block.toolUseId}">${block.content}</tool_result>`;
          }
          return '';
        })
        .join('\n');
      return `<${m.role}>\n${body}\n</${m.role}>`;
    })
    .join('\n\n');
}

export function describeSchema(schema: ToolInputSchema): string {
  return Object.entries(schema.properties)
    .map(([key, prop]) => `${key}: ${prop.type}${schema.required?.includes(key) ? ' (required)' : ''}`)
    .join(', ');
}
