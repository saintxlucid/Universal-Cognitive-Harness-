import type { BiologicalFunctions } from '../harness-api/biological-functions.js';
import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import type { NeuralEventBus } from '../event-bus/neural-event-bus.js';

// ── JSON-RPC 2.0 types ─────────────────────────────────────

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ── MCP Protocol types ─────────────────────────────────────

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

interface MCPServerCapabilities {
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
}

// ── MCP Transport ──────────────────────────────────────────

export class MCPTransport {
  private bio: BiologicalFunctions;
  private kernel: CognitiveKernel;
  private eventBus: NeuralEventBus;
  private serverInfo = { name: 'uch', version: '0.1.0' };
  private initialized = false;
  private requestHandler: ((request: JSONRPCRequest) => void) | null = null;
  private onClose: (() => void) | null = null;

  constructor(bio: BiologicalFunctions, kernel: CognitiveKernel, eventBus: NeuralEventBus) {
    this.bio = bio;
    this.kernel = kernel;
    this.eventBus = eventBus;
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'observe',
        description: 'Record an observation into cognitive memory',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The observation text' },
            source: { type: 'string', description: 'Source identifier' },
          },
          required: ['text'],
        },
      },
      {
        name: 'remember',
        description: 'Store content in episodic memory',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Content to remember' },
            importance: { type: 'number', description: 'Importance score (0-1)' },
          },
          required: ['content'],
        },
      },
      {
        name: 'retrieve',
        description: 'Search cognitive memory for relevant information',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'plan',
        description: 'Create a plan to achieve a goal',
        inputSchema: {
          type: 'object',
          properties: {
            goal: { type: 'string', description: 'The goal to plan for' },
          },
          required: ['goal'],
        },
      },
      {
        name: 'reflect',
        description: 'Reflect on current cognitive state',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'learn',
        description: 'Learn from a proposition with supporting evidence',
        inputSchema: {
          type: 'object',
          properties: {
            proposition: { type: 'string', description: 'The proposition to evaluate' },
            evidence: { type: 'string', description: 'Supporting evidence' },
          },
          required: ['proposition', 'evidence'],
        },
      },
      {
        name: 'critique',
        description: 'Critically evaluate a target',
        inputSchema: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'The target to critique' },
          },
          required: ['target'],
        },
      },
      {
        name: 'status',
        description: 'Get UCH system status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  async handleMessage(raw: string): Promise<string | null> {
    let request: JSONRPCRequest;
    try {
      request = JSON.parse(raw) as JSONRPCRequest;
    } catch {
      return this.errorResponse(null, -32700, 'Parse error');
    }

    if (request.jsonrpc !== '2.0') {
      return this.errorResponse(request.id, -32600, 'Invalid Request: jsonrpc must be 2.0');
    }

    switch (request.method) {
      case 'initialize':
        return this.handleInitialize(request);
      case 'tools/list':
        return this.handleToolsList(request);
      case 'tools/call':
        return await this.handleToolCall(request);
      case 'notifications/initialized':
        this.initialized = true;
        return null;
      default:
        if (!this.initialized) {
          return this.errorResponse(request.id, -32000, 'Server not initialized');
        }
        return this.errorResponse(request.id, -32601, `Method not found: ${request.method}`);
    }
  }

  private handleInitialize(request: JSONRPCRequest): string {
    const clientInfo = request.params?.clientInfo ?? { name: 'unknown', version: '0.0.0' };
    const capabilities = request.params?.capabilities as Record<string, unknown> | undefined;

    this.initialized = false;

    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2025-03-26',
        serverInfo: this.serverInfo,
        capabilities: {
          tools: {},
        } satisfies MCPServerCapabilities,
        clientInfo,
        ...(capabilities ? { clientCapabilities: capabilities } : {}),
      },
    };

    this.eventBus.publish({
      type: 'agent:attached',
      source: 'mcp-transport',
      payload: { client_info: clientInfo },
    });

    return JSON.stringify(response);
  }

  private handleToolsList(request: JSONRPCRequest): string {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: this.getTools(),
      },
    };
    return JSON.stringify(response);
  }

  private async handleToolCall(request: JSONRPCRequest): Promise<string> {
    if (!this.initialized) {
      return this.errorResponse(request.id, -32000, 'Server not initialized');
    }

    const name = request.params?.name as string | undefined;
    const args = (request.params?.arguments ?? {}) as Record<string, unknown>;

    if (!name) {
      return this.errorResponse(request.id, -32602, 'Missing tool name');
    }

    try {
      let result: unknown;

      switch (name) {
        case 'observe': {
          const r = await this.bio.observe({
            text: args.text as string,
            source: args.source as string | undefined,
          });
          result = { observation_id: r.observation_id, concepts: r.concepts };
          break;
        }
        case 'remember': {
          const r = await this.bio.remember({
            content: args.content as string,
            importance: args.importance as number | undefined,
          });
          result = r;
          break;
        }
        case 'retrieve': {
          const r = await this.bio.retrieve(args.query as string);
          result = r;
          break;
        }
        case 'plan': {
          const r = await this.bio.plan(args.goal as string);
          result = r;
          break;
        }
        case 'reflect': {
          const r = await this.bio.reflect();
          result = r;
          break;
        }
        case 'learn': {
          const r = await this.bio.learn(args.proposition as string, args.evidence as string);
          result = r;
          break;
        }
        case 'critique': {
          const r = await this.bio.critique(args.target as string);
          result = r;
          break;
        }
        case 'status': {
          result = {
            episodes: this.kernel.getStats().episodes,
            concepts: this.kernel.getStats().concepts,
            relationships: this.kernel.getStats().relationships,
            beliefs: this.kernel.getStats().beliefs,
            sleep_cycles: this.kernel.getStats().sleep_cycles,
          };
          break;
        }
        default:
          return this.errorResponse(request.id, -32602, `Unknown tool: ${name}`);
      }

      const response: JSONRPCResponse = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        },
      };

      this.eventBus.publish({
        type: 'tool:called',
        source: 'mcp-transport',
        payload: { tool: name, args, result },
      });

      return JSON.stringify(response);
    } catch (err) {
      return this.errorResponse(
        request.id,
        -32603,
        `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private errorResponse(id: string | number | null, code: number, message: string): string {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id: id ?? 0,
      error: { code, message },
    };
    return JSON.stringify(response);
  }
}
