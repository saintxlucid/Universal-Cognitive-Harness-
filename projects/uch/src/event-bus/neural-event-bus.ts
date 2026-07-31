export type EventType =
  | 'file:opened'
  | 'file:saved'
  | 'file:deleted'
  | 'file:created'
  | 'git:commit'
  | 'git:branch_changed'
  | 'git:push'
  | 'git:pull'
  | 'terminal:executed'
  | 'terminal:output'
  | 'test:passed'
  | 'test:failed'
  | 'test:started'
  | 'build:started'
  | 'build:finished'
  | 'build:failed'
  | 'ci:passed'
  | 'ci:failed'
  | 'ci:started'
  | 'prompt:sent'
  | 'prompt:responded'
  | 'tool:called'
  | 'tool:result'
  | 'error:occurred'
  | 'error:handled'
  | 'debug:started'
  | 'debug:stopped'
  | 'dependency:installed'
  | 'dependency:removed'
  | 'pr:created'
  | 'pr:merged'
  | 'pr:reviewed'
  | 'review:requested'
  | 'review:submitted'
  | 'workspace:switched'
  | 'workspace:opened'
  | 'workspace:closed'
  | 'agent:attached'
  | 'agent:detached'
  | 'agent:message_sent'
  | 'agent:message_received'
  | 'session:started'
  | 'session:ended'
  | 'sleep:cycle'
  | 'consolidation:completed'
  | 'prediction:made'
  | 'prediction:failed'
  | 'memory:ingest'
  | 'memory:recall'
  | 'memory:consolidate'
  | 'module:message'
  | 'module:handoff'
  | 'cognitive:state_changed'
  | 'aether:started'
  | 'aether:stopped'
  | 'aether:tick'
  | 'acp:message_sent'
  | 'acp:message_received'
  | 'acp:agent_connected'
  | 'acp:agent_disconnected'
  | 'agent:spawned'
  | 'agent:stopped'
  | 'agent:message'
  | 'agent:error'
  | 'ide:file_opened'
  | 'ide:file_closed'
  | 'ide:cursor_moved'
  | 'ide:selection_changed'
  | 'mcp:connected'
  | 'mcp:disconnected'
  | 'mcp:tool_called'
  | 'mcp:error'
  | 'runtime:memory_warning'
  | 'runtime:cpu_spike'
  | 'runtime:health_check';

export interface NeuralEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  source: string;
  payload: Record<string, unknown>;
  metadata?: {
    session_id?: string;
    agent_id?: string;
    workspace_id?: string;
    importance?: number;
    module?: string;
    protocol?: string;
    targets?: string[];
  };
}

export interface ModuleRegistration {
  name: string;
  protocols: string[];
}

export type EventHandler = (event: NeuralEvent) => void | Promise<void>;
export type EventFilter = (event: NeuralEvent) => boolean;

interface Subscription {
  id: string;
  handler: EventHandler;
  filter?: EventFilter;
  label?: string;
}

export class NeuralEventBus {
  private subscriptions: Map<EventType, Subscription[]> = new Map();
  private moduleSubscriptions: Map<string, Subscription[]> = new Map();
  private protocolSubscriptions: Map<string, Subscription[]> = new Map();
  private modules: Map<string, ModuleRegistration> = new Map();
  private history: NeuralEvent[] = [];
  private maxHistory: number;
  private queue: NeuralEvent[] = [];
  private processing = false;

  constructor(maxHistory = 1000) {
    this.maxHistory = maxHistory;
  }

  subscribe(handler: EventHandler, label?: string): string;
  subscribe(
    eventType: EventType | EventType[],
    handler: EventHandler,
    filter?: EventFilter,
    label?: string,
  ): string;
  subscribe(
    eventTypeOrHandler: EventType | EventType[] | EventHandler,
    handlerOrLabel?: EventHandler | string,
    filter?: EventFilter,
    label?: string,
  ): string {
    const subId = crypto.randomUUID();

    if (typeof eventTypeOrHandler === 'function') {
      const handler = eventTypeOrHandler;
      const subs = this.subscriptions.get('*' as EventType) ?? [];
      subs.push({ id: subId, handler, label: handlerOrLabel as string | undefined });
      this.subscriptions.set('*' as EventType, subs);
      return subId;
    }

    const eventTypes = Array.isArray(eventTypeOrHandler)
      ? eventTypeOrHandler
      : [eventTypeOrHandler];
    const handler = handlerOrLabel as EventHandler;

    for (const type of eventTypes) {
      const subs = this.subscriptions.get(type) ?? [];
      subs.push({ id: subId, handler, filter, label });
      this.subscriptions.set(type, subs);
    }

    return subId;
  }

  registerModule(moduleName: string, protocols: string[] = []): void {
    this.modules.set(moduleName, { name: moduleName, protocols: [...protocols] });
  }

  subscribeToModule(
    moduleName: string,
    handler: EventHandler,
    filter?: EventFilter,
    label?: string,
  ): string {
    const subId = crypto.randomUUID();
    const subs = this.moduleSubscriptions.get(moduleName) ?? [];
    subs.push({ id: subId, handler, filter, label });
    this.moduleSubscriptions.set(moduleName, subs);
    return subId;
  }

  subscribeToProtocol(
    protocolName: string,
    handler: EventHandler,
    filter?: EventFilter,
    label?: string,
  ): string {
    const subId = crypto.randomUUID();
    const subs = this.protocolSubscriptions.get(protocolName) ?? [];
    subs.push({ id: subId, handler, filter, label });
    this.protocolSubscriptions.set(protocolName, subs);
    return subId;
  }

  unsubscribe(subscriptionId: string): void {
    for (const [, subs] of this.subscriptions) {
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx >= 0) subs.splice(idx, 1);
    }
    for (const [, subs] of this.moduleSubscriptions) {
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx >= 0) subs.splice(idx, 1);
    }
    for (const [, subs] of this.protocolSubscriptions) {
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx >= 0) subs.splice(idx, 1);
    }
  }

  async publish(event: Omit<NeuralEvent, 'id' | 'timestamp'>): Promise<void> {
    await this.enqueueEvent({
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    });
  }

  async publishToModule(
    moduleName: string,
    event: Omit<NeuralEvent, 'id' | 'timestamp'>,
  ): Promise<void> {
    const metadata = {
      ...(event.metadata ?? {}),
      module: moduleName,
    };

    await this.enqueueEvent({
      ...event,
      metadata,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    });
  }

  async publishProtocol(
    protocolName: string,
    source: string,
    payload: Record<string, unknown>,
    targets: string[] = [],
  ): Promise<void> {
    await this.enqueueEvent({
      id: crypto.randomUUID(),
      type: protocolName as EventType,
      timestamp: new Date(),
      source,
      payload: { ...payload, protocol: protocolName },
      metadata: { protocol: protocolName, targets },
    });
  }

  private async enqueueEvent(event: NeuralEvent): Promise<void> {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.queue.push(event);
    if (!this.processing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      const subs = [
        ...(this.subscriptions.get(event.type) ?? []),
        ...(this.subscriptions.get('*' as EventType) ?? []),
      ];
      const moduleSubs = event.metadata?.module
        ? (this.moduleSubscriptions.get(event.metadata.module) ?? [])
        : [];
      const protocolSubs =
        this.protocolSubscriptions.get(event.metadata?.protocol ?? event.type) ?? [];

      for (const sub of subs) {
        try {
          if (sub.filter && !sub.filter(event)) continue;
          const result = sub.handler(event);
          if (result instanceof Promise) {
            await result;
          }
        } catch {
          // Isolated handler failures don't crash the bus
        }
      }

      for (const sub of moduleSubs) {
        try {
          if (sub.filter && !sub.filter(event)) continue;
          await Promise.resolve(sub.handler(event));
        } catch {
          // Isolated handler failures don't crash the bus
        }
      }

      for (const sub of protocolSubs) {
        try {
          if (sub.filter && !sub.filter(event)) continue;
          await Promise.resolve(sub.handler(event));
        } catch {
          // Isolated handler failures don't crash the bus
        }
      }
    }
    this.processing = false;
  }

  getHistory(eventType?: EventType): NeuralEvent[] {
    if (eventType) {
      return this.history.filter((e) => e.type === eventType);
    }
    return [...this.history];
  }

  getRecent(count = 10): NeuralEvent[] {
    return this.history.slice(-count);
  }

  clearHistory(): void {
    this.history = [];
  }

  getSubscriptionCount(): number {
    let count = 0;
    for (const [, subs] of this.subscriptions) {
      count += subs.length;
    }
    for (const [, subs] of this.moduleSubscriptions) {
      count += subs.length;
    }
    for (const [, subs] of this.protocolSubscriptions) {
      count += subs.length;
    }
    return count;
  }
}
