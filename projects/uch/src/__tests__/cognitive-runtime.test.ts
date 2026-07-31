import { describe, it, expect } from 'vitest';
import { SkillRegistry } from '../cognitive-memory/skill-registry.js';
import { CapabilityRegistry } from '../cognitive-runtime/capability-registry.js';
import { MCPTransport } from '../cognitive-runtime/mcp-transport.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

describe('SkillRegistry', () => {
  it('registers and retrieves skills', () => {
    const registry = new SkillRegistry();
    registry.register({
      id: 'code-review',
      name: 'Code Review',
      description: 'Review code for quality issues',
      trigger_patterns: ['review', 'audit', 'inspect'],
      location: './skills/code-review',
      enabled: true,
      version: '1.0.0',
      metadata: {},
    });

    expect(registry.count()).toBe(1);
    expect(registry.getById('code-review')).toBeDefined();
  });

  it('finds skills by trigger pattern', () => {
    const registry = new SkillRegistry();
    registry.register({
      id: 'test-skill',
      name: 'Test Skill',
      description: 'A test skill',
      trigger_patterns: ['test', 'verify', 'check'],
      location: './skills/test',
      enabled: true,
      version: '1.0.0',
      metadata: {},
    });

    const matches = registry.findByTrigger('run tests please');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.id).toBe('test-skill');
  });

  it('returns empty for non-matching triggers', () => {
    const registry = new SkillRegistry();
    registry.register({
      id: 'test-skill',
      name: 'Test Skill',
      description: 'A test skill',
      trigger_patterns: ['test', 'verify'],
      location: './skills/test',
      enabled: true,
      version: '1.0.0',
      metadata: {},
    });

    expect(registry.findByTrigger('build the app')).toHaveLength(0);
  });

  it('unregisters skills', () => {
    const registry = new SkillRegistry();
    registry.register({
      id: 'temp',
      name: 'Temp',
      description: '',
      trigger_patterns: [],
      location: '',
      enabled: true,
      version: '1.0.0',
      metadata: {},
    });
    expect(registry.count()).toBe(1);
    registry.unregister('temp');
    expect(registry.count()).toBe(0);
  });

  it('records and retrieves invocations', () => {
    const registry = new SkillRegistry();
    registry.register({
      id: 'test',
      name: 'Test',
      description: '',
      trigger_patterns: [],
      location: '',
      enabled: true,
      version: '1.0.0',
      metadata: {},
    });

    registry.recordInvocation({
      skill_id: 'test',
      timestamp: new Date(),
      input: 'test input',
      output: 'test output',
      duration_ms: 100,
      success: true,
    });

    const invocations = registry.getRecentInvocations();
    expect(invocations).toHaveLength(1);
    expect(invocations[0]!.skill_id).toBe('test');
  });

  it('provides stats', () => {
    const registry = new SkillRegistry();
    registry.register({
      id: 's1', name: 'S1', description: '', trigger_patterns: [], location: '',
      enabled: true, version: '1.0.0', metadata: {},
    });
    registry.register({
      id: 's2', name: 'S2', description: '', trigger_patterns: [], location: '',
      enabled: false, version: '1.0.0', metadata: {},
    });
    registry.recordInvocation({ skill_id: 's1', timestamp: new Date(), input: '', output: '', duration_ms: 10, success: true });
    registry.recordInvocation({ skill_id: 's1', timestamp: new Date(), input: '', output: '', duration_ms: 10, success: false });

    const stats = registry.getStats();
    expect(stats.total_skills).toBe(2);
    expect(stats.enabled_skills).toBe(1);
    expect(stats.total_invocations).toBe(2);
    expect(stats.success_rate).toBe(0.5);
  });
});

describe('CapabilityRegistry', () => {
  it('registers and retrieves capabilities', () => {
    const registry = new CapabilityRegistry();
    registry.register({
      name: 'memory',
      version: '1.0',
      description: 'Episodic memory storage',
      requires: [],
      provides: ['storage', 'retrieval'],
      enabled: true,
    });
    expect(registry.count()).toBe(1);
    expect(registry.get('memory')).toBeDefined();
  });

  it('gets only enabled capabilities', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'a', version: '1.0', description: '', requires: [], provides: [], enabled: true });
    registry.register({ name: 'b', version: '1.0', description: '', requires: [], provides: [], enabled: false });
    expect(registry.getEnabled()).toHaveLength(1);
  });

  it('checks dependencies', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'database', version: '1.0', description: '', requires: ['storage'], provides: [], enabled: true });
    const result = registry.checkDependency('database');
    expect(result.satisfied).toBe(false);
    expect(result.missing).toContain('storage');
  });

  it('reports satisfied dependencies', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'storage', version: '1.0', description: '', requires: [], provides: [], enabled: true });
    registry.register({ name: 'database', version: '1.0', description: '', requires: ['storage'], provides: [], enabled: true });
    expect(registry.checkDependency('database').satisfied).toBe(true);
  });

  it('resets all capabilities', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'a', version: '1.0', description: '', requires: [], provides: [], enabled: true });
    registry.reset();
    expect(registry.count()).toBe(0);
  });
});

describe('MCPTransport', () => {
  function createTransport() {
    const bus = new NeuralEventBus();
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const ws = new WorkspaceBrain({ workspace_id: 'test', name: 'test', root_path: '/test', eventBus: bus });
    const exec = new ExecutiveBrain({ eventBus: bus });
    const bio = new BiologicalFunctions(kernel, ws, exec);
    return { transport: new MCPTransport(bio, kernel, bus), bus };
  }

  it('handles initialize request', async () => {
    const { transport } = createTransport();
    const response = await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: 'test-client', version: '1.0' }, capabilities: {} },
    }));
    const parsed = JSON.parse(response!);
    expect(parsed.jsonrpc).toBe('2.0');
    expect(parsed.id).toBe(1);
    expect(parsed.result.protocolVersion).toBe('2025-03-26');
    expect(parsed.result.serverInfo.name).toBe('uch');
    expect(parsed.result.capabilities.tools).toBeDefined();
  });

  it('handles tools/list request', async () => {
    const { transport } = createTransport();
    const response = await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/list',
    }));
    const parsed = JSON.parse(response!);
    expect(parsed.result.tools).toBeInstanceOf(Array);
    const toolNames = parsed.result.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain('observe');
    expect(toolNames).toContain('retrieve');
    expect(toolNames).toContain('plan');
    expect(toolNames).toContain('reflect');
    expect(toolNames).toContain('learn');
  });

  it('handles tools/call after initialization', async () => {
    const { transport } = createTransport();
    await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: {}, capabilities: {} },
    }));
    await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', method: 'notifications/initialized',
    }));
    const response = await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'status', arguments: {} },
    }));
    const parsed = JSON.parse(response!);
    expect(parsed.result.content[0].text).toBeDefined();
  });

  it('returns error for unknown tool', async () => {
    const { transport } = createTransport();
    await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: {}, capabilities: {} },
    }));
    await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', method: 'notifications/initialized',
    }));
    const response = await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nonexistent', arguments: {} },
    }));
    const parsed = JSON.parse(response!);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe(-32602);
  });

  it('returns error before initialization for tools/call', async () => {
    const { transport } = createTransport();
    const response = await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'status', arguments: {} },
    }));
    const parsed = JSON.parse(response!);
    expect(parsed.error).toBeDefined();
  });

  it('handles parse errors', async () => {
    const { transport } = createTransport();
    const response = await transport.handleMessage('not json');
    const parsed = JSON.parse(response!);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe(-32700);
  });

  it('handles method not found', async () => {
    const { transport } = createTransport();
    await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: {}, capabilities: {} },
    }));
    await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', method: 'notifications/initialized',
    }));
    const response = await transport.handleMessage(JSON.stringify({
      jsonrpc: '2.0', id: 6, method: 'unknown_method',
    }));
    const parsed = JSON.parse(response!);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe(-32601);
  });

  it('provides tool definitions with input schemas', () => {
    const { transport } = createTransport();
    const tools = transport.getTools();
    const observeTool = tools.find((t) => t.name === 'observe');
    expect(observeTool).toBeDefined();
    expect(observeTool!.inputSchema.required).toContain('text');
  });
});
