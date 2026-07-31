import { NeuralEventBus, type EventType } from './neural-event-bus.js';

export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';
export type AgentCapability = string;

export interface AgentRegistration {
  id: string;
  name: string;
  capabilities: AgentCapability[];
  status: AgentStatus;
  lastSeen: string;
  metadata: Record<string, unknown>;
}

export interface HandoffRequest {
  id: string;
  task: string;
  fromAgent: string;
  toAgent: string;
  context: Record<string, unknown>;
  priority: number;
  created_at: string;
}

export interface DelegationRequest {
  id: string;
  task: string;
  parentTask: string;
  fromAgent: string;
  targetCapability: AgentCapability;
  context: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'completed' | 'failed';
  result?: unknown;
  created_at: string;
}

export interface CoordinationMessage {
  type: 'handoff' | 'delegate' | 'discover' | 'broadcast' | 'sync';
  from: string;
  to?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export class AgentCoordinator {
  private bus: NeuralEventBus;
  private agents: Map<string, AgentRegistration> = new Map();
  private handoffs: HandoffRequest[] = [];
  private delegations: DelegationRequest[] = [];
  private nextId = 0;

  constructor(bus: NeuralEventBus) {
    this.bus = bus;
  }

  registerAgent(name: string, capabilities: AgentCapability[], metadata: Record<string, unknown> = {}): AgentRegistration {
    const id = `agent-${crypto.randomUUID().slice(0, 8)}`;
    const registration: AgentRegistration = {
      id, name, capabilities, status: 'idle', lastSeen: new Date().toISOString(), metadata,
    };
    this.agents.set(id, registration);
    this.bus.registerModule(id, capabilities);
    return registration;
  }

  discoverAgent(capability: AgentCapability): AgentRegistration | undefined {
    return Array.from(this.agents.values()).find(
      (a) => a.capabilities.includes(capability) && a.status !== 'offline',
    );
  }

  discoverAll(capability?: AgentCapability): AgentRegistration[] {
    const all = Array.from(this.agents.values()).filter((a) => a.status !== 'offline');
    return capability ? all.filter((a) => a.capabilities.includes(capability)) : all;
  }

  async handoff(task: string, fromAgent: string, toAgent: string, context: Record<string, unknown> = {}): Promise<HandoffRequest> {
    const request: HandoffRequest = {
      id: `handoff-${this.nextId++}`,
      task, fromAgent, toAgent, context, priority: 0.5, created_at: new Date().toISOString(),
    };
    this.handoffs.push(request);

    await this.bus.publishToModule(toAgent, {
      type: 'module:handoff',
      source: fromAgent,
      payload: { ...request, action: 'handoff_request' },
    });

    return request;
  }

  async delegate(task: string, parentTask: string, fromAgent: string, targetCapability: AgentCapability, context: Record<string, unknown> = {}): Promise<DelegationRequest | null> {
    const target = this.discoverAgent(targetCapability);
    if (!target) return null;

    const request: DelegationRequest = {
      id: `delegate-${this.nextId++}`,
      task, parentTask, fromAgent, targetCapability, context, status: 'pending', created_at: new Date().toISOString(),
    };
    this.delegations.push(request);

    await this.bus.publishToModule(target.id, {
      type: 'module:message',
      source: fromAgent,
      payload: { ...request, action: 'delegation_request' },
    });

    request.status = 'accepted';
    return request;
  }

  async completeDelegation(delegationId: string, result: unknown): Promise<void> {
    const delegation = this.delegations.find((d) => d.id === delegationId);
    if (delegation) {
      delegation.status = 'completed';
      delegation.result = result;

      await this.bus.publish({
        type: 'module:handoff',
        source: delegation.fromAgent,
        payload: { delegation_id: delegationId, status: 'completed', result },
      });
    }
  }

  async broadcast(type: EventType, payload: Record<string, unknown>, source: string): Promise<void> {
    await this.bus.publish({ type, source, payload: { ...payload, broadcast: true } });
  }

  setAgentStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastSeen = new Date().toISOString();
    }
  }

  getAgent(agentId: string): AgentRegistration | undefined {
    return this.agents.get(agentId);
  }

  getPendingHandoffs(toAgent: string): HandoffRequest[] {
    return this.handoffs.filter((h) => h.toAgent === toAgent);
  }

  getDelegations(fromAgent: string): DelegationRequest[] {
    return this.delegations.filter((d) => d.fromAgent === fromAgent);
  }

  getStats(): { agentCount: number; activeDelegations: number; totalHandoffs: number } {
    return {
      agentCount: this.agents.size,
      activeDelegations: this.delegations.filter((d) => d.status === 'accepted').length,
      totalHandoffs: this.handoffs.length,
    };
  }
}
