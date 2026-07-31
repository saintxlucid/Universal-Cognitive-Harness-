import type { CognitiveExoskeleton, ExoskeletonTransport } from '../exoskeleton/exoskeleton.js';
import type { AgentCapability, AgentRegistration, AgentStatus, HandoffRequest, DelegationRequest } from '../event-bus/agent-coordinator.js';

export interface A2AMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface A2ATransportConfig {
  agentId: string;
  agentName: string;
  capabilities: AgentCapability[];
  handshakeTimeoutMs: number;
  heartbeatIntervalMs: number;
}

export class A2ATransport implements ExoskeletonTransport {
  name = 'a2a';
  private exoskeleton: CognitiveExoskeleton | null = null;
  private config: Required<A2ATransportConfig>;
  private peers: Map<string, { capabilities: AgentCapability[]; lastSeen: Date; status: string }> = new Map();
  private pendingRequests: Map<string | number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageHandler: ((msg: A2AMessage) => Promise<A2AMessage>) | null = null;

  constructor(config?: Partial<A2ATransportConfig>) {
    this.config = {
      agentId: config?.agentId ?? 'uch-a2a',
      agentName: config?.agentName ?? 'UCH A2A Agent',
      capabilities: config?.capabilities ?? [],
      handshakeTimeoutMs: config?.handshakeTimeoutMs ?? 5000,
      heartbeatIntervalMs: config?.heartbeatIntervalMs ?? 30000,
    };
  }

  attach(exoskeleton: CognitiveExoskeleton): void {
    this.exoskeleton = exoskeleton;
  }

  detach(): void {
    this.stop();
    this.exoskeleton = null;
  }

  setMessageHandler(handler: (msg: A2AMessage) => Promise<A2AMessage>): void {
    this.messageHandler = handler;
  }

  start(): void {
    this.heartbeatTimer = setInterval(() => {
      this.broadcastHeartbeat();
    }, this.config.heartbeatIntervalMs);
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const [, entry] of this.pendingRequests) {
      clearTimeout(entry.timer);
      entry.reject(new Error('A2A transport stopped'));
    }
    this.pendingRequests.clear();
  }

  status(): Record<string, unknown> {
    return {
      agentId: this.config.agentId,
      peerCount: this.peers.size,
      peers: [...this.peers.entries()].map(([id, info]) => ({
        id,
        status: info.status,
        lastSeen: info.lastSeen.toISOString(),
        capabilities: info.capabilities.length,
      })),
      pendingRequests: this.pendingRequests.size,
    };
  }

  registerPeer(agentId: string, capabilities: AgentCapability[]): void {
    this.peers.set(agentId, {
      capabilities,
      lastSeen: new Date(),
      status: 'idle',
    });
  }

  unregisterPeer(agentId: string): void {
    this.peers.delete(agentId);
  }

  getPeers(): string[] {
    return [...this.peers.keys()];
  }

  getPeerCapabilities(agentId: string): AgentCapability[] | null {
    return this.peers.get(agentId)?.capabilities ?? null;
  }

  async sendHandshake(peerId: string): Promise<boolean> {
    const msg: A2AMessage = {
      jsonrpc: '2.0',
      method: 'a2a.handshake',
      params: {
        agentId: this.config.agentId,
        agentName: this.config.agentName,
        capabilities: this.config.capabilities,
      },
    };

    try {
      const response = await this.sendRequest(peerId, msg);
      const result = response as { agentId?: string; capabilities?: AgentCapability[] };
      if (result?.agentId) {
        this.registerPeer(result.agentId, result.capabilities ?? []);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async sendDelegation(peerId: string, request: DelegationRequest): Promise<unknown> {
    const msg: A2AMessage = {
      jsonrpc: '2.0',
      method: 'a2a.delegate',
      params: request as unknown as Record<string, unknown>,
    };
    return this.sendRequest(peerId, msg);
  }

  async sendHandoff(peerId: string, request: HandoffRequest): Promise<unknown> {
    const msg: A2AMessage = {
      jsonrpc: '2.0',
      method: 'a2a.handoff',
      params: request as unknown as Record<string, unknown>,
    };
    return this.sendRequest(peerId, msg);
  }

  async handleIncoming(message: A2AMessage): Promise<A2AMessage> {
    if (message.method === 'a2a.handshake') {
      const params = message.params as { agentId?: string; agentName?: string; capabilities?: AgentCapability[] } | undefined;
      if (params?.agentId) {
        this.registerPeer(params.agentId, params.capabilities ?? []);
      }
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          agentId: this.config.agentId,
          agentName: this.config.agentName,
          capabilities: this.config.capabilities,
        },
      };
    }

    if (message.method === 'a2a.heartbeat') {
      const params = message.params as { agentId?: string } | undefined;
      if (params?.agentId) {
        const peer = this.peers.get(params.agentId);
        if (peer) {
          peer.lastSeen = new Date();
        }
      }
      return { jsonrpc: '2.0', id: message.id, result: { status: 'ok' } };
    }

    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const entry = this.pendingRequests.get(message.id)!;
      clearTimeout(entry.timer);
      this.pendingRequests.delete(message.id);
      if ('result' in message) {
        entry.resolve(message.result);
      } else {
        entry.reject(new Error(message.error?.message ?? 'A2A error'));
      }
      return { jsonrpc: '2.0', id: message.id, result: null };
    }

    if (this.messageHandler) {
      return this.messageHandler(message);
    }

    return {
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: 'Method not found' },
    };
  }

  private async sendRequest(peerId: string, message: A2AMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = message.id ?? crypto.randomUUID();
      message.id = id;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`A2A request timed out for peer ${peerId}`));
      }, this.config.handshakeTimeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
    });
  }

  private broadcastHeartbeat(): void {
    for (const peerId of this.peers.keys()) {
      const msg: A2AMessage = {
        jsonrpc: '2.0',
        method: 'a2a.heartbeat',
        params: { agentId: this.config.agentId },
      };
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.lastSeen = new Date();
      }
    }
  }

  getPeerStatus(agentId: string): string | null {
    return this.peers.get(agentId)?.status ?? null;
  }

  getStats(): Record<string, unknown> {
    return {
      agentId: this.config.agentId,
      peers: this.peers.size,
      pendingRequests: this.pendingRequests.size,
      heartbeatIntervalMs: this.config.heartbeatIntervalMs,
    };
  }
}
