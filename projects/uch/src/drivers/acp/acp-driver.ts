import type { NeuralEventBus, EventType } from '../../event-bus/neural-event-bus.js';

export interface ACPMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  type: 'request' | 'response' | 'broadcast' | 'error';
}

export interface ACPDriverConfig {
  agentId?: string;
  maxMessageHistory?: number;
  reconnectInterval?: number;
}

interface ConnectedAgent {
  id: string;
  capabilities: string[];
  connectedAt: Date;
  lastSeen: Date;
  status: 'connected' | 'disconnected';
}

export class ACPDriver {
  private eventBus: NeuralEventBus;
  private config: Required<ACPDriverConfig>;
  private agents: Map<string, ConnectedAgent> = new Map();
  private messageHandlers: Array<(msg: ACPMessage) => void | Promise<void>> = [];
  private messageHistory: ACPMessage[] = [];
  private active = false;

  constructor(eventBus: NeuralEventBus, config?: ACPDriverConfig) {
    this.eventBus = eventBus;
    this.config = {
      agentId: config?.agentId ?? 'uch-default',
      maxMessageHistory: config?.maxMessageHistory ?? 1000,
      reconnectInterval: config?.reconnectInterval ?? 5000,
    };
  }

  start(): void {
    this.active = true;
  }

  stop(): void {
    this.active = false;
    this.agents.clear();
    this.messageHandlers = [];
  }

  async sendMessage(agentId: string, message: string, msgType: ACPMessage['type'] = 'request'): Promise<ACPMessage | null> {
    if (!this.active) return null;

    const agent = this.agents.get(agentId);
    if (!agent || agent.status === 'disconnected') return null;

    try {
      const msg: ACPMessage = {
        id: crypto.randomUUID(),
        from: this.config.agentId,
        to: agentId,
        content: message,
        timestamp: new Date(),
        type: msgType,
      };

      this.messageHistory.push(msg);
      if (this.messageHistory.length > this.config.maxMessageHistory) {
        this.messageHistory.shift();
      }

      await this.eventBus.publish({
        type: 'acp:message_sent' as EventType,
        source: 'acp-driver',
        payload: { message: msg },
      });

      return msg;
    } catch {
      return null;
    }
  }

  async broadcast(message: string): Promise<ACPMessage[]> {
    if (!this.active) return [];

    const results: ACPMessage[] = [];

    for (const [agentId] of this.agents) {
      const msg = await this.sendMessage(agentId, message, 'broadcast');
      if (msg) results.push(msg);
    }

    return results;
  }

  onMessage(handler: (msg: ACPMessage) => void | Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  getConnectedAgents(): ConnectedAgent[] {
    return Array.from(this.agents.values()).filter((a) => a.status === 'connected');
  }

  async registerAgent(agentId: string, capabilities: string[] = []): Promise<void> {
    const agent: ConnectedAgent = {
      id: agentId,
      capabilities,
      connectedAt: new Date(),
      lastSeen: new Date(),
      status: 'connected',
    };

    this.agents.set(agentId, agent);

    await this.eventBus.publish({
      type: 'acp:agent_connected' as EventType,
      source: 'acp-driver',
      payload: { agentId, capabilities, connectedAt: agent.connectedAt },
    });
  }

  async disconnectAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.status = 'disconnected';
    this.agents.set(agentId, agent);

    await this.eventBus.publish({
      type: 'acp:agent_disconnected' as EventType,
      source: 'acp-driver',
      payload: { agentId },
    });
  }

  async receiveMessage(msg: ACPMessage): Promise<void> {
    this.messageHistory.push(msg);
    if (this.messageHistory.length > this.config.maxMessageHistory) {
      this.messageHistory.shift();
    }

    await this.eventBus.publish({
      type: 'acp:message_received' as EventType,
      source: 'acp-driver',
      payload: { message: msg },
    });

    for (const handler of this.messageHandlers) {
      try {
        await Promise.resolve(handler(msg));
      } catch {
        // Isolated handler failure
      }
    }
  }

  getMessageHistory(agentId?: string): ACPMessage[] {
    if (agentId) {
      return this.messageHistory.filter((m) => m.from === agentId || m.to === agentId);
    }
    return [...this.messageHistory];
  }
}
