import type { NeuralEventBus, EventType } from '../../event-bus/neural-event-bus.js';

export interface AgentInstance {
  id: string;
  type: string;
  status: 'idle' | 'running' | 'stopped' | 'error';
  startedAt: Date;
  config: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AgentDriverConfig {
  maxAgents?: number;
  defaultTimeout?: number;
}

export class AgentDriver {
  private eventBus: NeuralEventBus;
  private config: Required<AgentDriverConfig>;
  private agents: Map<string, AgentInstance> = new Map();
  private messageHandlers: Map<string, Array<(message: unknown) => void | Promise<void>>> = new Map();
  private active = false;

  constructor(eventBus: NeuralEventBus, config?: AgentDriverConfig) {
    this.eventBus = eventBus;
    this.config = {
      maxAgents: config?.maxAgents ?? 20,
      defaultTimeout: config?.defaultTimeout ?? 30000,
    };
  }

  start(): void {
    this.active = true;
  }

  stop(): void {
    this.active = false;

    for (const [id] of this.agents) {
      const agent = this.agents.get(id);
      if (agent) {
        agent.status = 'stopped';
        this.agents.set(id, agent);
      }
    }

    this.messageHandlers.clear();
  }

  async spawnAgent(type: string, config?: Record<string, unknown>): Promise<AgentInstance | null> {
    if (!this.active) return null;
    if (this.agents.size >= this.config.maxAgents) return null;

    try {
      const instance: AgentInstance = {
        id: crypto.randomUUID(),
        type,
        status: 'running',
        startedAt: new Date(),
        config: config ?? {},
      };

      this.agents.set(instance.id, instance);

      await this.eventBus.publish({
        type: 'agent:spawned' as EventType,
        source: 'agent-driver',
        payload: {
          id: instance.id,
          type: instance.type,
          startedAt: instance.startedAt,
        },
      });

      return instance;
    } catch {
      return null;
    }
  }

  async stopAgent(id: string): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent) return false;

    try {
      agent.status = 'stopped';
      this.agents.set(id, agent);
      this.messageHandlers.delete(id);

      await this.eventBus.publish({
        type: 'agent:stopped' as EventType,
        source: 'agent-driver',
        payload: { id, type: agent.type },
      });

      return true;
    } catch {
      return false;
    }
  }

  getActiveAgents(): AgentInstance[] {
    return Array.from(this.agents.values()).filter(
      (a) => a.status === 'running' || a.status === 'idle',
    );
  }

  async sendToAgent(id: string, message: unknown): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent || agent.status !== 'running') return false;

    try {
      const handlers = this.messageHandlers.get(id);
      if (handlers) {
        for (const handler of handlers) {
          try {
            await Promise.resolve(handler(message));
          } catch {
            // Isolated handler failure
          }
        }
      }

      await this.eventBus.publish({
        type: 'agent:message' as EventType,
        source: 'agent-driver',
        payload: { agentId: id, agentType: agent.type, message },
      });

      return true;
    } catch {
      return false;
    }
  }

  onAgentMessage(id: string, handler: (message: unknown) => void | Promise<void>): void {
    const handlers = this.messageHandlers.get(id) ?? [];
    handlers.push(handler);
    this.messageHandlers.set(id, handlers);
  }

  async setAgentError(id: string, error: Error): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) return;

    agent.status = 'error';
    this.agents.set(id, agent);

    await this.eventBus.publish({
      type: 'agent:error' as EventType,
      source: 'agent-driver',
      payload: { id, type: agent.type, error: error.message },
    });
  }

  getAgent(id: string): AgentInstance | undefined {
    return this.agents.get(id);
  }

  getAgentCount(): number {
    return this.agents.size;
  }
}
