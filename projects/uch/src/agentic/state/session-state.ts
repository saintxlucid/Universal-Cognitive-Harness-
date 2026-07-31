import { createStore, type Store } from './store.js';
import type { Message, MessageUsage, TaskModel, Terminal } from '../types.js';

export interface AgenticSessionState {
  sessionId: string;
  cwd: string;
  messages: Message[];
  tasks: TaskModel[];
  running: boolean;
  usage: MessageUsage;
  costUsd: number;
  lastTerminal: Terminal | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface AgenticSessionEvents {
  onMessage?: (message: Message) => void;
  onTerminal?: (terminal: Terminal) => void;
  onUsage?: (usage: MessageUsage) => void;
  onTaskUpdate?: (tasks: TaskModel[]) => void;
}

export const emptyUsage = (): MessageUsage => ({
  inputTokens: 0,
  outputTokens: 0,
});

export function createSessionState(
  sessionId: string,
  cwd: string,
  events?: AgenticSessionEvents,
): Store<AgenticSessionState> {
  const store = createStore<AgenticSessionState>({
    sessionId,
    cwd,
    messages: [],
    tasks: [],
    running: false,
    usage: emptyUsage(),
    costUsd: 0,
    lastTerminal: null,
    startedAt: null,
    endedAt: null,
  });

  if (events) {
    store.subscribe((state, prev) => {
      if (state.messages.length > prev.messages.length) {
        const last = state.messages[state.messages.length - 1];
        if (last) events.onMessage?.(last);
      }
      if (state.usage !== prev.usage) events.onUsage?.(state.usage);
      if (state.lastTerminal !== prev.lastTerminal && state.lastTerminal) {
        events.onTerminal?.(state.lastTerminal);
      }
      if (state.tasks !== prev.tasks) events.onTaskUpdate?.(state.tasks);
    });
  }

  return store;
}

export interface SessionTracker {
  start(): void;
  stop(terminal: Terminal): void;
  addMessage(message: Message): void;
  addUsage(usage: MessageUsage): void;
  addTask(task: TaskModel): void;
  updateTask(id: string, patch: Partial<TaskModel>): void;
  getState(): AgenticSessionState;
}

export function createSessionTracker(
  store: Store<AgenticSessionState>,
): SessionTracker {
  return {
    start: () => {
      store.setState((s) => ({ ...s, running: true, startedAt: new Date().toISOString() }));
    },
    stop: (terminal) => {
      store.setState((s) => ({
        ...s,
        running: false,
        endedAt: new Date().toISOString(),
        lastTerminal: terminal,
      }));
    },
    addMessage: (message) => {
      store.setState((s) => ({ ...s, messages: [...s.messages, message] }));
    },
    addUsage: (usage) => {
      store.setState((s) => ({
        ...s,
        usage: {
          inputTokens: s.usage.inputTokens + usage.inputTokens,
          outputTokens: s.usage.outputTokens + usage.outputTokens,
          cacheReadInputTokens:
            (s.usage.cacheReadInputTokens ?? 0) + (usage.cacheReadInputTokens ?? 0),
          cacheCreationInputTokens:
            (s.usage.cacheCreationInputTokens ?? 0) + (usage.cacheCreationInputTokens ?? 0),
        },
      }));
    },
    addTask: (task) => {
      store.setState((s) => ({ ...s, tasks: [...s.tasks, task] }));
    },
    updateTask: (id, patch) => {
      store.setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
    },
    getState: () => store.getState(),
  };
}

export function formatMessagesForModel(messages: Message[]): Message[] {
  return messages
    .filter((m) => m.role !== 'tool')
    .map((m) => ({
      ...m,
      content: m.content.map((block) => {
        if (block.type === 'tool_result') {
          return {
            type: 'text' as const,
            text: `<tool_result id="${block.toolUseId}">${block.content}</tool_result>`,
          };
        }
        return block;
      }),
    }));
}
