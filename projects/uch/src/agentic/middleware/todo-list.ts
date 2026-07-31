import type { AgentMiddleware, MiddlewareContext } from './types.js';
import { buildTool } from '../tools/types.js';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
}

export class TodoListMiddleware implements AgentMiddleware {
  readonly name = 'TodoListMiddleware';
  private items: TodoItem[] = [];

  constructor(private readonly maxItems = 20) {}

  list(): TodoItem[] {
    return [...this.items];
  }

  private upsert(input: { content: string; status?: TodoItem['status']; priority?: TodoItem['priority'] }): void {
    const existing = this.items.find((item) => item.content === input.content);
    if (existing) {
      if (input.status) existing.status = input.status;
      if (input.priority) existing.priority = input.priority;
      return;
    }
    if (this.items.length >= this.maxItems) {
      this.items.shift();
    }
    this.items.push({
      content: input.content,
      status: input.status ?? 'pending',
      priority: input.priority ?? 'medium',
    });
  }

  private render(): string {
    if (this.items.length === 0) return '';
    const lines = this.items.map((item) => {
      const mark = item.status === 'completed' ? '[x]' : item.status === 'in_progress' ? '[*]' : item.status === 'cancelled' ? '[-]' : '[ ]';
      return `- ${mark} ${item.content} (${item.priority})`;
    });
    return `Current todo list:\n${lines.join('\n')}`;
  }

  tools() {
    return [
      buildTool({
        name: 'write_todos',
        description: 'Create or update the todo list. Use for multi-step work; keep items short and actionable.',
        inputSchema: {
          type: 'object',
          properties: {
            todos: {
              type: 'array',
              description: 'Todo items',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string', description: 'Short actionable item' },
                  status: { type: 'string', description: 'pending | in_progress | completed | cancelled', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
                  priority: { type: 'string', description: 'high | medium | low', enum: ['high', 'medium', 'low'] },
                },
              },
            },
          },
          required: ['todos'],
        },
        call: async (input: { todos: TodoItem[] }) => {
          for (const todo of input.todos) {
            this.upsert(todo);
          }
          return { data: `Todo list updated (${this.items.length} items)` };
        },
      }),
    ];
  }

  systemPrompt(current: string, _context: MiddlewareContext): string {
    const section = this.render();
    if (!section) return current;
    return `${current}\n\n${section}`;
  }
}
