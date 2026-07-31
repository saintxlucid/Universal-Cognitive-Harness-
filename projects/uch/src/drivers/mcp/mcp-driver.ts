import type { NeuralEventBus, EventType } from '../../event-bus/neural-event-bus.js';

export interface MCPConnection {
  serverUrl: string;
  status: 'connected' | 'disconnected' | 'error';
  connectedAt: Date;
  tools: MCPToolDefinition[];
  config: Record<string, unknown>;
}

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPToolResult {
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

export interface MCPDriverConfig {
  defaultTimeout?: number;
  maxConnections?: number;
  reconnectOnError?: boolean;
}

export class MCPDriver {
  private eventBus: NeuralEventBus;
  private config: Required<MCPDriverConfig>;
  private connections: Map<string, MCPConnection> = new Map();
  private active = false;

  constructor(eventBus: NeuralEventBus, config?: MCPDriverConfig) {
    this.eventBus = eventBus;
    this.config = {
      defaultTimeout: config?.defaultTimeout ?? 30000,
      maxConnections: config?.maxConnections ?? 10,
      reconnectOnError: config?.reconnectOnError ?? true,
    };
  }

  start(): void {
    this.active = true;
  }

  stop(): void {
    this.active = false;

    for (const [serverUrl] of this.connections) {
      const conn = this.connections.get(serverUrl);
      if (conn) {
        conn.status = 'disconnected';
        this.connections.set(serverUrl, conn);
      }
    }
  }

  async connect(serverUrl: string, connConfig?: Record<string, unknown>): Promise<boolean> {
    if (!this.active) return false;
    if (this.connections.size >= this.config.maxConnections) return false;

    try {
      const connection: MCPConnection = {
        serverUrl,
        status: 'connected',
        connectedAt: new Date(),
        tools: [],
        config: connConfig ?? {},
      };

      this.connections.set(serverUrl, connection);

      await this.eventBus.publish({
        type: 'mcp:connected' as EventType,
        source: 'mcp-driver',
        payload: { serverUrl, connectedAt: connection.connectedAt },
      });

      return true;
    } catch {
      return false;
    }
  }

  async disconnect(serverUrl?: string): Promise<void> {
    if (serverUrl) {
      await this.disconnectServer(serverUrl);
    } else {
      for (const [url] of this.connections) {
        await this.disconnectServer(url);
      }
    }
  }

  private async disconnectServer(serverUrl: string): Promise<void> {
    const conn = this.connections.get(serverUrl);
    if (!conn) return;

    conn.status = 'disconnected';
    this.connections.set(serverUrl, conn);

    await this.eventBus.publish({
      type: 'mcp:disconnected' as EventType,
      source: 'mcp-driver',
      payload: { serverUrl },
    });

    this.connections.delete(serverUrl);
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<MCPToolResult> {
    const startTime = Date.now();

    try {
      await this.eventBus.publish({
        type: 'mcp:tool_called' as EventType,
        source: 'mcp-driver',
        payload: { tool: name, args },
      });

      const result: MCPToolResult = {
        tool: name,
        success: true,
        duration: Date.now() - startTime,
      };

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      await this.eventBus.publish({
        type: 'mcp:error' as EventType,
        source: 'mcp-driver',
        payload: { tool: name, error: errorMessage, args },
      });

      return {
        tool: name,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  async listTools(serverUrl?: string): Promise<MCPToolDefinition[]> {
    if (serverUrl) {
      return this.connections.get(serverUrl)?.tools ?? [];
    }

    const all: MCPToolDefinition[] = [];
    for (const [, conn] of this.connections) {
      all.push(...conn.tools);
    }
    return all;
  }

  getConnectedServers(): MCPConnection[] {
    return Array.from(this.connections.values()).filter(
      (c) => c.status === 'connected',
    );
  }

  async registerTool(serverUrl: string, tool: MCPToolDefinition): Promise<void> {
    const conn = this.connections.get(serverUrl);
    if (!conn) return;

    const existing = conn.tools.findIndex((t) => t.name === tool.name);
    if (existing >= 0) {
      conn.tools[existing] = tool;
    } else {
      conn.tools.push(tool);
    }

    this.connections.set(serverUrl, conn);
  }

  getConnection(serverUrl: string): MCPConnection | undefined {
    return this.connections.get(serverUrl);
  }
}
