import { describe, it, expect } from 'vitest';
import { MCPSSETransport } from '../control-plane/transport/mcp-sse.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

describe('MCPSSETransport', () => {
  function createTransport() {
    const bus = new NeuralEventBus();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const ws = new WorkspaceBrain({ workspace_id: 'test', name: 'test', root_path: '/test', eventBus: bus });
    const exec = new ExecutiveBrain({ eventBus: bus });
    const bio = new BiologicalFunctions(kernel, ws, exec);
    return { transport: new MCPSSETransport(bio, kernel, bus), bus };
  }

  it('handles SSE connections', () => {
    const { transport } = createTransport();
    const sent: string[] = [];
    transport.handleSSEConnection('client-1', (data) => { sent.push(data); });
    expect(transport.getClientCount()).toBe(1);
    expect(sent.length).toBeGreaterThanOrEqual(1);
  });

  it('handles initialize message', async () => {
    const { transport } = createTransport();
    transport.handleSSEConnection('c1', () => {});
    const response = await transport.handleMessage('c1', JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
    }));
    const parsed = JSON.parse(response);
    expect(parsed.result.protocolVersion).toBe('2025-03-26');
    expect(parsed.result.serverInfo.name).toBe('uccp');
  });

  it('handles tools/list message', async () => {
    const { transport } = createTransport();
    transport.handleSSEConnection('c1', () => {});
    const response = await transport.handleMessage('c1', JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/list',
    }));
    const parsed = JSON.parse(response);
    expect(parsed.result.tools).toBeInstanceOf(Array);
    const names = parsed.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('observe');
    expect(names).toContain('retrieve');
  });

  it('handles tools/call message', async () => {
    const { transport } = createTransport();
    transport.handleSSEConnection('c1', () => {});
    const response = await transport.handleMessage('c1', JSON.stringify({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'observe', arguments: { text: 'test observation' } },
    }));
    const parsed = JSON.parse(response);
    expect(parsed.result?.content).toBeDefined();
  });

  it('handles resources/list message', async () => {
    const { transport } = createTransport();
    transport.handleSSEConnection('c1', () => {});
    const response = await transport.handleMessage('c1', JSON.stringify({
      jsonrpc: '2.0', id: 4, method: 'resources/list',
    }));
    const parsed = JSON.parse(response);
    expect(parsed.result.resources).toHaveLength(1);
    expect(parsed.result.resources[0].uri).toBe('uccp://cognitive/state');
  });

  it('handles prompts/list message', async () => {
    const { transport } = createTransport();
    transport.handleSSEConnection('c1', () => {});
    const response = await transport.handleMessage('c1', JSON.stringify({
      jsonrpc: '2.0', id: 5, method: 'prompts/list',
    }));
    const parsed = JSON.parse(response);
    expect(parsed.result.prompts).toHaveLength(1);
  });

  it('handles unknown tool error', async () => {
    const { transport } = createTransport();
    transport.handleSSEConnection('c1', () => {});
    const response = await transport.handleMessage('c1', JSON.stringify({
      jsonrpc: '2.0', id: 6, method: 'tools/call',
      params: { name: 'nonexistent', arguments: {} },
    }));
    const parsed = JSON.parse(response);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe(-32602);
  });

  it('handles parse errors', async () => {
    const { transport } = createTransport();
    const response = await transport.handleMessage('c1', 'not json');
    const parsed = JSON.parse(response);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe(-32700);
  });

  it('closes connections', () => {
    const { transport } = createTransport();
    transport.handleSSEConnection('c1', () => {});
    expect(transport.getClientCount()).toBe(1);
    transport.closeConnection('c1');
    expect(transport.getClientCount()).toBe(0);
  });

  it('broadcasts notifications', () => {
    const { transport } = createTransport();
    const received: string[] = [];
    transport.handleSSEConnection('c1', (data) => { received.push(data); });
    transport.broadcastNotification('test:event', { data: 1 });
    expect(received.length).toBeGreaterThanOrEqual(2);
  });
});
