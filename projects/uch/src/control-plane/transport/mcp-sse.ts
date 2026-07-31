import type { BiologicalFunctions } from '../../harness-api/biological-functions.js';
import type { CognitiveKernel } from '../../kernel/cognitive-kernel.js';
import type { NeuralEventBus } from '../../event-bus/neural-event-bus.js';

export type TransportMessage = { jsonrpc: '2.0'; id?: string | number; method?: string; result?: unknown; error?: { code: number; message: string }; params?: Record<string, unknown> };

export class MCPSSETransport {
  private clients: Map<string, (data: string) => void> = new Map();
  private bio: BiologicalFunctions;
  private kernel: CognitiveKernel;
  private eventBus: NeuralEventBus;
  private tools: Map<string, { name: string; description: string; inputSchema: Record<string, unknown>; handler: (args: Record<string, unknown>) => Promise<unknown> }> = new Map();

  constructor(bio: BiologicalFunctions, kernel: CognitiveKernel, eventBus: NeuralEventBus) {
    this.bio = bio;
    this.kernel = kernel;
    this.eventBus = eventBus;
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    this.registerTool('observe', 'Record an observation', { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      async (args) => this.bio.observe({ text: args.text as string }));
    this.registerTool('remember', 'Store in episodic memory', { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
      async (args) => this.bio.remember({ content: args.content as string }));
    this.registerTool('retrieve', 'Search cognitive memory', { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      async (args) => this.bio.retrieve(args.query as string));
    this.registerTool('plan', 'Create a plan for a goal', { type: 'object', properties: { goal: { type: 'string' } }, required: ['goal'] },
      async (args) => this.bio.plan(args.goal as string));
    this.registerTool('reflect', 'Reflect on cognitive state', { type: 'object', properties: {} },
      async () => this.bio.reflect());
    this.registerTool('learn', 'Learn from proposition and evidence', { type: 'object', properties: { proposition: { type: 'string' }, evidence: { type: 'string' } }, required: ['proposition', 'evidence'] },
      async (args) => this.bio.learn(args.proposition as string, args.evidence as string));
    this.registerTool('critique', 'Critically evaluate a target', { type: 'object', properties: { target: { type: 'string' } }, required: ['target'] },
      async (args) => this.bio.critique(args.target as string));
  }

  registerTool(name: string, description: string, inputSchema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>): void {
    this.tools.set(name, { name, description, inputSchema, handler });
  }

  handleSSEConnection(clientId: string, send: (data: string) => void): void {
    this.clients.set(clientId, send);
    send(`event: endpoint\ndata: /messages?clientId=${clientId}\n\n`);
    this.sendEvent(clientId, 'connected', { clientId });

    this.eventBus.publish({
      type: 'agent:attached',
      source: 'mcp-sse',
      payload: { client_id: clientId, transport: 'sse' },
    });
  }

  closeConnection(clientId: string): void {
    this.clients.delete(clientId);
    this.eventBus.publish({
      type: 'agent:detached',
      source: 'mcp-sse',
      payload: { client_id: clientId },
    });
  }

  async handleMessage(clientId: string, body: string): Promise<string> {
    let msg: TransportMessage;
    try {
      msg = JSON.parse(body) as TransportMessage;
    } catch {
      return JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }

    if (!msg.method) {
      return JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32600, message: 'Invalid request' } });
    }

    switch (msg.method) {
      case 'initialize': {
        return JSON.stringify({
          jsonrpc: '2.0', id: msg.id,
          result: { protocolVersion: '2025-03-26', serverInfo: { name: 'uccp', version: '0.1.0' }, capabilities: { tools: {}, resources: {}, prompts: {} } },
        });
      }
      case 'tools/list': {
        const toolList = [...this.tools.values()].map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
        return JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: toolList } });
      }
      case 'tools/call': {
        const toolName = msg.params?.name as string;
        const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
        const tool = this.tools.get(toolName);
        if (!tool) {
          return JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: `Unknown tool: ${toolName}` } });
        }
        try {
          const result = await tool.handler(args);
          return JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } });
        } catch (err) {
          return JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: err instanceof Error ? err.message : String(err) } });
        }
      }
      case 'resources/list': {
        return JSON.stringify({
          jsonrpc: '2.0', id: msg.id,
          result: { resources: [{ uri: 'uccp://cognitive/state', name: 'Cognitive State', description: 'Current cognitive system state', mimeType: 'application/json' }] },
        });
      }
      case 'resources/read': {
        const uri = msg.params?.uri as string;
        if (uri === 'uccp://cognitive/state') {
          const stats = this.kernel.getStats();
          return JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(stats, null, 2) }] } });
        }
        return JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: `Unknown resource: ${uri}` } });
      }
      case 'prompts/list': {
        return JSON.stringify({
          jsonrpc: '2.0', id: msg.id,
          result: { prompts: [{ name: 'cognitive-status', description: 'Get current cognitive state summary', arguments: [] }] },
        });
      }
      case 'prompts/get': {
        const promptName = msg.params?.name as string;
        if (promptName === 'cognitive-status') {
          const stats = this.kernel.getStats();
          const text = `Cognitive System Status:\n- Episodes: ${stats.episodes}\n- Concepts: ${stats.concepts}\n- Relationships: ${stats.relationships}\n- Beliefs: ${stats.beliefs}\n- Sleep Cycles: ${stats.sleep_cycles}`;
          return JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { messages: [{ role: 'assistant', content: { type: 'text', text } }] } });
        }
        return JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: `Unknown prompt: ${promptName}` } });
      }
      default:
        return JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
    }
  }

  broadcastNotification(method: string, params?: Record<string, unknown>): void {
    const data = JSON.stringify({ jsonrpc: '2.0', method, params } as TransportMessage);
    for (const send of this.clients.values()) {
      try {
        this.sendEventData(send, 'message', data);
      } catch { /* skip dead clients */ }
    }
  }

  getClientCount(): number { return this.clients.size; }

  private sendEvent(clientId: string, event: string, data: unknown): void {
    const send = this.clients.get(clientId);
    if (send) this.sendEventData(send, event, JSON.stringify(data));
  }

  private sendEventData(send: (data: string) => void, event: string, data: string): void {
    send(`event: ${event}\ndata: ${data}\n\n`);
  }
}
