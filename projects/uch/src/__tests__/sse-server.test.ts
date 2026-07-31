import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MCPSSETransport } from '../control-plane/transport/mcp-sse.js';
import { SSEServer } from '../control-plane/transport/sse-server.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';

function createTestTransport(): MCPSSETransport {
  const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
  const eventBus = new NeuralEventBus();
  const ws = new WorkspaceBrain({ workspace_id: 'test', name: 'test', root_path: '/tmp', eventBus });
  const exec = new ExecutiveBrain({ eventBus });
  const bio = new BiologicalFunctions(kernel, ws, exec);
  return new MCPSSETransport(bio, kernel, eventBus);
}

describe('MCPSSETransport', () => {
  let transport: MCPSSETransport;

  beforeEach(() => {
    transport = createTestTransport();
  });

  it('handles SSE connection and sends endpoint event', () => {
    const send = vi.fn();
    transport.handleSSEConnection('client-1', send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(expect.stringContaining('event: endpoint'));
    expect(send).toHaveBeenCalledWith(expect.stringContaining('client-1'));
  });

  it('processes initialize request', async () => {
    const response = await transport.handleMessage('c1', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }));
    const parsed = JSON.parse(response);
    expect(parsed.result.serverInfo.name).toBe('uccp');
    expect(parsed.result.capabilities.tools).toBeDefined();
  });

  it('processes tools/list request', async () => {
    const response = await transport.handleMessage('c1', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
    const parsed = JSON.parse(response);
    expect(parsed.result.tools).toBeInstanceOf(Array);
    expect(parsed.result.tools.length).toBeGreaterThanOrEqual(7);
    const names = parsed.result.tools.map((t: any) => t.name);
    expect(names).toContain('observe');
    expect(names).toContain('remember');
    expect(names).toContain('retrieve');
    expect(names).toContain('plan');
    expect(names).toContain('reflect');
    expect(names).toContain('learn');
    expect(names).toContain('critique');
  });

  it('processes resources/list request', async () => {
    const response = await transport.handleMessage('c1', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'resources/list' }));
    const parsed = JSON.parse(response);
    expect(parsed.result.resources).toHaveLength(1);
    expect(parsed.result.resources[0].uri).toBe('uccp://cognitive/state');
  });

  it('processes prompts/list request', async () => {
    const response = await transport.handleMessage('c1', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'prompts/list' }));
    const parsed = JSON.parse(response);
    expect(parsed.result.prompts).toHaveLength(1);
  });

  it('returns parse error for invalid JSON', async () => {
    const response = await transport.handleMessage('c1', 'not json');
    const parsed = JSON.parse(response);
    expect(parsed.error.code).toBe(-32700);
  });

  it('returns method not found for unknown method', async () => {
    const response = await transport.handleMessage('c1', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'unknown' }));
    const parsed = JSON.parse(response);
    expect(parsed.error.code).toBe(-32601);
  });

  it('broadcasts notifications to all clients', () => {
    const send1 = vi.fn();
    const send2 = vi.fn();
    transport.handleSSEConnection('c1', send1);
    transport.handleSSEConnection('c2', send2);
    transport.broadcastNotification('test', { msg: 'hello' });
    expect(send1).toHaveBeenCalledWith(expect.stringContaining('test'));
    expect(send2).toHaveBeenCalledWith(expect.stringContaining('test'));
  });

  it('tracks client count', () => {
    const send = vi.fn();
    expect(transport.getClientCount()).toBe(0);
    transport.handleSSEConnection('c1', send);
    expect(transport.getClientCount()).toBe(1);
    transport.closeConnection('c1');
    expect(transport.getClientCount()).toBe(0);
  });

  it('registers custom tools', async () => {
    transport.registerTool('custom', 'A custom tool', { type: 'object', properties: {} }, async () => 'done');
    const response = await transport.handleMessage('c1', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
    const names = JSON.parse(response).result.tools.map((t: any) => t.name);
    expect(names).toContain('custom');
  });

  it('calls a custom tool', async () => {
    transport.registerTool('echo', 'Echo', { type: 'object', properties: { msg: { type: 'string' } } }, async (args) => args.msg);
    const response = await transport.handleMessage('c1', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: { msg: 'hello' } } }));
    const parsed = JSON.parse(response);
    expect(parsed.result.content[0].text).toBe('"hello"');
  });

  it('returns error for unknown tool call', async () => {
    const response = await transport.handleMessage('c1', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'nonexistent', arguments: {} } }));
    const parsed = JSON.parse(response);
    expect(parsed.error.code).toBe(-32602);
  });
});

describe('SSEServer', () => {
  let sse: SSEServer;

  beforeEach(() => {
    sse = new SSEServer(createTestTransport(), { heartbeatIntervalMs: 50000, sessionTimeoutMs: 100000 });
  });

  afterEach(() => {
    sse.stopTimers();
  });

  it('creates session on SSE connect', () => {
    const req = { socket: { remoteAddress: '127.0.0.1' }, headers: { 'user-agent': 'test' }, on: vi.fn() } as any;
    const res = { writeHead: vi.fn(), write: vi.fn(), on: vi.fn() } as any;
    sse.handleSSE(req, res);
    expect(sse.getTotalSessions()).toBe(1);
  });

  it('returns session by client ID', () => {
    const req = { socket: { remoteAddress: '127.0.0.1' }, headers: {}, on: vi.fn() } as any;
    const res = { writeHead: vi.fn(), write: vi.fn(), on: vi.fn() } as any;
    sse.handleSSE(req, res);
    const sessions = sse.listSessions();
    expect(sessions).toHaveLength(1);
    const session = sessions[0]!;
    expect(session.status).toBe('active');
    expect(session.metadata.remoteAddress).toBe('127.0.0.1');
  });

  it('returns stats', () => {
    const req = { socket: { remoteAddress: '10.0.0.1' }, headers: {}, on: vi.fn() } as any;
    const res = { writeHead: vi.fn(), write: vi.fn(), on: vi.fn() } as any;
    sse.handleSSE(req, res);
    const stats = sse.getStats();
    expect(stats.totalSessions).toBe(1);
    expect(stats.activeSessions).toBe(1);
  });

  it('initializes with zero sessions', () => {
    expect(sse.getTotalSessions()).toBe(0);
    expect(sse.getActiveCount()).toBe(0);
  });
});
