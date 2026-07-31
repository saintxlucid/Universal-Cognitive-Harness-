import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import { FileSystemDriver } from '../filesystem/filesystem-driver.js';
import { GitDriver } from '../git/git-driver.js';
import { ACPDriver, type ACPMessage } from '../acp/acp-driver.js';
import { AgentDriver } from '../agent/agent-driver.js';
import { IDEDriver } from '../ide/ide-driver.js';
import { MCPDriver } from '../mcp/mcp-driver.js';
import { RuntimeDriver } from '../runtime/runtime-driver.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ── Helpers ─────────────────────────────────────────────────────

function createTempDir(prefix: string): string {
  const dir = path.join(
    os.tmpdir(),
    `uch-drv-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// =========================================================================
// FileSystemDriver
// =========================================================================

describe('FileSystemDriver', () => {
  let mockPublish: ReturnType<typeof vi.fn>;
  let driver: FileSystemDriver;
  let testDir: string;

  beforeEach(() => {
    mockPublish = vi.fn();
    testDir = createTempDir('fs');
    driver = new FileSystemDriver({ publish: mockPublish } as unknown as NeuralEventBus, {
      rootPath: testDir,
    });
  });

  afterEach(() => {
    driver.stop();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('uses default config when none provided', () => {
    const d = new FileSystemDriver({ publish: mockPublish } as unknown as NeuralEventBus);
    expect(d).toBeDefined();
    // Should not crash when methods are called with default rootPath
  });

  it('reads and returns file content', async () => {
    await driver.writeFile('test-read.txt', 'Hello, World!');
    const result = await driver.readFile('test-read.txt');
    expect(result.content).toBe('Hello, World!');
    expect(result.size).toBeGreaterThan(0);
  });

  it('throws when reading a non-existent file', async () => {
    await expect(driver.readFile('no-such-file.txt')).rejects.toThrow();
  });

  it('writes files and creates intermediate directories', async () => {
    const result = await driver.writeFile(
      'nested/a/b/deep-file.txt',
      'deep content',
    );
    expect(result.path).toContain('deep-file.txt');
    expect(result.size).toBeGreaterThan(0);
    expect(
      fs.existsSync(
        path.join(testDir, 'nested', 'a', 'b', 'deep-file.txt'),
      ),
    ).toBe(true);
  });

  it('deletes files', async () => {
    await driver.writeFile('delete-me.txt', 'bye');
    expect(await driver.deleteFile('delete-me.txt')).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'delete-me.txt'))).toBe(false);
  });

  it('returns false when deleting a non-existent file', async () => {
    expect(await driver.deleteFile('no-such-file.txt')).toBe(false);
  });

  it('lists directory contents', async () => {
    await driver.writeFile('a.txt', 'content a');
    await driver.writeFile('b.ts', 'content b');
    const entries = await driver.listDirectory('.');
    expect(entries).toHaveLength(2);
    expect(entries.some((e) => e.name === 'a.txt')).toBe(true);
    expect(entries.some((e) => e.name === 'b.ts')).toBe(true);
  });

  it('returns empty array when listing a non-existent directory', async () => {
    const entries = await driver.listDirectory('void');
    expect(entries).toEqual([]);
  });

  it('publishes events on file operations', async () => {
    await driver.writeFile('event-test.txt', 'payload');
    // writeFile → 'file:saved'
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish.mock.calls[0]?.[0]?.type).toBe('file:saved');
    expect(mockPublish.mock.calls[0]?.[0]?.source).toBe('filesystem-driver');

    mockPublish.mockClear();
    await driver.readFile('event-test.txt');
    // readFile → 'file:opened'
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish.mock.calls[0]?.[0]?.type).toBe('file:opened');

    mockPublish.mockClear();
    await driver.deleteFile('event-test.txt');
    // deleteFile → 'file:deleted'
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish.mock.calls[0]?.[0]?.type).toBe('file:deleted');
  });

  it('async operations work end-to-end', async () => {
    // Full workflow: write → exists → read → list → delete → exists-false → list-empty
    await driver.writeFile('e2e.txt', 'end-to-end');
    expect(await driver.fileExists('e2e.txt')).toBe(true);

    const read = await driver.readFile('e2e.txt');
    expect(read.content).toBe('end-to-end');

    let entries = await driver.listDirectory('.');
    expect(entries.some((e) => e.name === 'e2e.txt')).toBe(true);

    await driver.deleteFile('e2e.txt');
    expect(await driver.fileExists('e2e.txt')).toBe(false);

    entries = await driver.listDirectory('.');
    expect(entries.some((e) => e.name === 'e2e.txt')).toBe(false);
  });
});

// =========================================================================
// GitDriver
// =========================================================================

describe('GitDriver', () => {
  let mockPublish: ReturnType<typeof vi.fn>;
  let testDir: string;

  beforeEach(() => {
    mockPublish = vi.fn();
    testDir = createTempDir('git');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('uses dot as default repo path', () => {
    const d = new GitDriver({ publish: mockPublish } as unknown as NeuralEventBus);
    expect(d).toBeDefined();
  });

  it('getStatus returns empty array when not in a git repo', () => {
    const driver = new GitDriver({ publish: mockPublish } as unknown as NeuralEventBus, {
      repoPath: testDir,
    });
    expect(driver.getStatus()).toEqual([]);
  });

  it('getRecentCommits returns empty array when not in a git repo', () => {
    const driver = new GitDriver({ publish: mockPublish } as unknown as NeuralEventBus, {
      repoPath: testDir,
    });
    expect(driver.getRecentCommits(5)).toEqual([]);
  });

  it('handles non-git directory gracefully (branch and hash return empty)', () => {
    const driver = new GitDriver({ publish: mockPublish } as unknown as NeuralEventBus, {
      repoPath: testDir,
    });
    expect(driver.getBranch()).toBe('');
    expect(driver.getCurrentHash()).toBe('');
  });
});

// =========================================================================
// ACPDriver
// =========================================================================

describe('ACPDriver', () => {
  let mockPublish: ReturnType<typeof vi.fn>;
  let driver: ACPDriver;

  beforeEach(() => {
    mockPublish = vi.fn();
    driver = new ACPDriver(
      { publish: mockPublish } as unknown as NeuralEventBus,
      { agentId: 'uch-test' },
    );
    driver.start();
  });

  afterEach(() => {
    driver.stop();
  });

  it('starts and stops without error', () => {
    const d = new ACPDriver(
      { publish: mockPublish } as unknown as NeuralEventBus,
      { agentId: 'fresh' },
    );
    expect(() => d.start()).not.toThrow();
    expect(() => d.stop()).not.toThrow();
  });

  it('tracks connected agents with capabilities', async () => {
    await driver.registerAgent('peer-alpha', ['observe', 'act']);
    await driver.registerAgent('peer-beta', ['reflect']);
    const agents = driver.getConnectedAgents();
    expect(agents).toHaveLength(2);
    expect(agents[0]?.id).toBe('peer-alpha');
    expect(agents[0]?.capabilities).toEqual(['observe', 'act']);
    expect(agents[1]?.id).toBe('peer-beta');
  });

  it('onMessage registers handlers that fire on receiveMessage', async () => {
    const handler = vi.fn();
    driver.onMessage(handler);

    const msg: ACPMessage = {
      id: 'm-001',
      from: 'remote',
      to: 'uch-test',
      content: 'hello from peer',
      timestamp: new Date(),
      type: 'response',
    };
    await driver.receiveMessage(msg);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it('returns null when sending to a non-existent agent', async () => {
    const result = await driver.sendMessage('ghost', 'ping');
    expect(result).toBeNull();
  });

  it('returns null when sending to a disconnected agent', async () => {
    await driver.registerAgent('temp');
    await driver.disconnectAgent('temp');
    const result = await driver.sendMessage('temp', 'ping');
    expect(result).toBeNull();
  });

  it('broadcasts message to all connected agents', async () => {
    await driver.registerAgent('a');
    await driver.registerAgent('b');
    await driver.registerAgent('c');
    const results = await driver.broadcast('hello everyone');
    expect(results).toHaveLength(3);
    results.forEach((msg) => {
      expect(msg.type).toBe('broadcast');
    });
  });

  it('publishes events on sendMessage', async () => {
    await driver.registerAgent('peer');
    mockPublish.mockClear();

    await driver.sendMessage('peer', 'test message', 'request');
    expect(mockPublish).toHaveBeenCalledTimes(1);
    const event = mockPublish.mock.calls[0]?.[0];
    expect(event?.type).toBe('acp:message_sent');
    expect(event?.source).toBe('acp-driver');
    expect(event?.payload?.message?.content).toBe('test message');
  });
});

// =========================================================================
// AgentDriver
// =========================================================================

describe('AgentDriver', () => {
  let mockPublish: ReturnType<typeof vi.fn>;
  let driver: AgentDriver;

  beforeEach(() => {
    mockPublish = vi.fn();
    driver = new AgentDriver(
      { publish: mockPublish } as unknown as NeuralEventBus,
      { maxAgents: 10, defaultTimeout: 5000 },
    );
    driver.start();
  });

  afterEach(() => {
    driver.stop();
  });

  it('spawns agents and tracks them', async () => {
    const agent = await driver.spawnAgent('worker', { mode: 'parallel' });
    expect(agent).not.toBeNull();
    expect(agent!.id).toBeTruthy();
    expect(agent!.type).toBe('worker');
    expect(agent!.status).toBe('running');
    expect(agent!.config).toEqual({ mode: 'parallel' });
  });

  it('stops agents and removes from message handlers', async () => {
    const agent = await driver.spawnAgent('worker');
    expect(driver.getAgent(agent!.id)?.status).toBe('running');

    const stopped = await driver.stopAgent(agent!.id);
    expect(stopped).toBe(true);
    expect(driver.getAgent(agent!.id)?.status).toBe('stopped');
  });

  it('returns false when sending to non-existent agent', async () => {
    const result = await driver.sendToAgent('no-such-agent', { cmd: 'test' });
    expect(result).toBe(false);
  });

  it('getActiveAgents returns all running agents', async () => {
    await driver.spawnAgent('a');
    await driver.spawnAgent('b');
    await driver.spawnAgent('c');
    expect(driver.getActiveAgents()).toHaveLength(3);

    // After stopping one, it should no longer be active
    const agents = driver.getActiveAgents();
    await driver.stopAgent(agents[0]!.id);
    expect(driver.getActiveAgents()).toHaveLength(2);
  });

  it('publishes lifecycle events on spawn', async () => {
    mockPublish.mockClear();

    await driver.spawnAgent('listener', {});
    expect(mockPublish).toHaveBeenCalledTimes(1);
    const spawnEvent = mockPublish.mock.calls[0]?.[0];
    expect(spawnEvent?.type).toBe('agent:spawned');
    expect(spawnEvent?.source).toBe('agent-driver');
    expect(spawnEvent?.payload?.type).toBe('listener');
  });

  it('publishes lifecycle events on stop', async () => {
    const agent = await driver.spawnAgent('worker');
    mockPublish.mockClear();

    await driver.stopAgent(agent!.id);
    expect(mockPublish).toHaveBeenCalledTimes(1);
    const stopEvent = mockPublish.mock.calls[0]?.[0];
    expect(stopEvent?.type).toBe('agent:stopped');
    expect(stopEvent?.source).toBe('agent-driver');
    expect(stopEvent?.payload?.id).toBe(agent!.id);
  });

  it('publishes lifecycle events on error', async () => {
    const agent = await driver.spawnAgent('worker');
    mockPublish.mockClear();

    await driver.setAgentError(agent!.id, new Error('out of memory'));
    expect(mockPublish).toHaveBeenCalledTimes(1);
    const errEvent = mockPublish.mock.calls[0]?.[0];
    expect(errEvent?.type).toBe('agent:error');
    expect(errEvent?.payload?.error).toBe('out of memory');
  });
});

// =========================================================================
// IDEDriver
// =========================================================================

describe('IDEDriver', () => {
  let mockPublish: ReturnType<typeof vi.fn>;
  let driver: IDEDriver;

  beforeEach(() => {
    mockPublish = vi.fn();
    driver = new IDEDriver(
      { publish: mockPublish } as unknown as NeuralEventBus,
      { maxOpenFiles: 10, workspacePath: '/test-workspace' },
    );
    driver.start();
  });

  afterEach(() => {
    driver.stop();
  });

  it('tracks open files', async () => {
    await driver.openFile({
      path: '/src/main.ts',
      language: 'typescript',
      size: 2048,
      isActive: true,
      lastModified: new Date(),
    });
    await driver.openFile({
      path: '/src/utils.ts',
      language: 'typescript',
      size: 1024,
      isActive: false,
      lastModified: new Date(),
    });
    const files = driver.getOpenFiles();
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.path === '/src/main.ts')).toBe(true);
    expect(files.some((f) => f.path === '/src/utils.ts')).toBe(true);
  });

  it('returns the active file', async () => {
    expect(driver.getActiveFile()).toBeNull();

    await driver.openFile({
      path: '/index.ts',
      language: 'typescript',
      size: 500,
      isActive: true,
      lastModified: new Date(),
    });
    const active = driver.getActiveFile();
    expect(active).not.toBeNull();
    expect(active!.path).toBe('/index.ts');
  });

  it('stores cursor position', async () => {
    await driver.setCursorPosition({ line: 15, column: 4 });
    const pos = driver.getCursorPosition();
    expect(pos).toEqual({ line: 15, column: 4 });
  });

  it('stores selection state', async () => {
    await driver.setSelection({
      start: { line: 3, column: 0 },
      end: { line: 7, column: 12 },
      text: 'selected region',
    });
    const sel = driver.getSelection();
    expect(sel).not.toBeNull();
    expect(sel!.start).toEqual({ line: 3, column: 0 });
    expect(sel!.end).toEqual({ line: 7, column: 12 });
    expect(sel!.text).toBe('selected region');
  });

  it('sets and clears diagnostics', async () => {
    await driver.setDiagnostics('/src/app.ts', [
      { line: 1, column: 5, message: 'Type error', severity: 'error' },
      { line: 2, column: 1, message: 'Unused var', severity: 'warning' },
    ]);
    expect(driver.getDiagnostics('/src/app.ts')).toHaveLength(2);
    expect(driver.getDiagnostics('/src/other.ts')).toHaveLength(0);

    // Clear for a specific file
    driver.clearDiagnostics('/src/app.ts');
    expect(driver.getDiagnostics('/src/app.ts')).toHaveLength(0);
  });

  it('aggregates diagnostics across all files', async () => {
    await driver.setDiagnostics('/a.ts', [
      { line: 1, column: 0, message: 'E1', severity: 'error' },
    ]);
    await driver.setDiagnostics('/b.ts', [
      { line: 2, column: 0, message: 'W1', severity: 'warning' },
    ]);
    expect(driver.getDiagnostics()).toHaveLength(2);

    // Clear all diagnostics
    driver.clearDiagnostics();
    expect(driver.getDiagnostics()).toHaveLength(0);
  });

  it('publishes events on file open', async () => {
    mockPublish.mockClear();
    await driver.openFile({
      path: '/new.ts',
      language: 'typescript',
      size: 100,
      isActive: true,
      lastModified: new Date(),
    });
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish.mock.calls[0]?.[0]?.type).toBe('ide:file_opened');
  });

  it('publishes events on cursor move', async () => {
    mockPublish.mockClear();
    await driver.setCursorPosition({ line: 5, column: 10 });
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish.mock.calls[0]?.[0]?.type).toBe('ide:cursor_moved');
  });
});

// =========================================================================
// MCPDriver
// =========================================================================

describe('MCPDriver', () => {
  let mockPublish: ReturnType<typeof vi.fn>;
  let driver: MCPDriver;

  beforeEach(() => {
    mockPublish = vi.fn();
    driver = new MCPDriver(
      { publish: mockPublish } as unknown as NeuralEventBus,
      { maxConnections: 5, defaultTimeout: 5000, reconnectOnError: true },
    );
    driver.start();
  });

  afterEach(() => {
    driver.stop();
  });

  it('connects to a server and tracks it', async () => {
    const ok = await driver.connect('http://mcp-alpha:9090', { auth: 'token' });
    expect(ok).toBe(true);

    const conn = driver.getConnection('http://mcp-alpha:9090');
    expect(conn).toBeDefined();
    expect(conn!.status).toBe('connected');
    expect(conn!.config).toEqual({ auth: 'token' });
  });

  it('disconnect removes tracking for a specific server', async () => {
    await driver.connect('http://server-a:8080');
    await driver.connect('http://server-b:8080');
    expect(driver.getConnectedServers()).toHaveLength(2);

    await driver.disconnect('http://server-a:8080');
    const remaining = driver.getConnectedServers();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.serverUrl).toBe('http://server-b:8080');
  });

  it('disconnect() without arguments disconnects all servers', async () => {
    await driver.connect('http://x:8080');
    await driver.connect('http://y:8080');
    await driver.disconnect();
    expect(driver.getConnectedServers()).toHaveLength(0);
  });

  it('listConnectedServers returns all tracked servers with connected status', async () => {
    await driver.connect('http://s1:8080');
    await driver.connect('http://s2:8080');
    const servers = driver.getConnectedServers();
    expect(servers).toHaveLength(2);
    servers.forEach((s) => expect(s.status).toBe('connected'));
  });

  it('handles connection error when not active', async () => {
    driver.stop();
    const ok = await driver.connect('http://any:8080');
    expect(ok).toBe(false);
  });

  it('handles connection error when max connections reached', async () => {
    const small = new MCPDriver(
      { publish: mockPublish } as unknown as NeuralEventBus,
      { maxConnections: 1 },
    );
    small.start();
    await small.connect('http://first:8080');
    const second = await small.connect('http://second:8080');
    expect(second).toBe(false);
    small.stop();
  });

  it('publishes events on connect and disconnect', async () => {
    mockPublish.mockClear();
    await driver.connect('http://events:8080');
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mcp:connected' }),
    );

    mockPublish.mockClear();
    await driver.disconnect('http://events:8080');
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mcp:disconnected' }),
    );
  });
});

// =========================================================================
// RuntimeDriver
// =========================================================================

describe('RuntimeDriver', () => {
  let mockPublish: ReturnType<typeof vi.fn>;
  let driver: RuntimeDriver;

  beforeEach(() => {
    mockPublish = vi.fn();
    driver = new RuntimeDriver(
      { publish: mockPublish } as unknown as NeuralEventBus,
      { sampleInterval: 60000, memoryWarningThreshold: 0.9, cpuSpikeThreshold: 0.95 },
    );
  });

  afterEach(() => {
    driver.stop();
  });

  it('returns memory usage stats', () => {
    const mem = driver.getMemoryUsage();
    expect(mem.total).toBeGreaterThan(0);
    expect(mem.free).toBeGreaterThan(0);
    expect(mem.used).toBeGreaterThan(0);
    expect(mem.usagePercent).toBeGreaterThan(0);
    expect(mem.heapTotal).toBeGreaterThan(0);
    expect(mem.heapUsed).toBeGreaterThan(0);
  });

  it('returns CPU usage stats', () => {
    const cpu = driver.getCPUUsage();
    expect(cpu.cores).toBeGreaterThan(0);
    expect(cpu.loadAverage).toHaveLength(3);
    expect(typeof cpu.usagePercent).toBe('number');
  });

  it('returns system and process uptime', () => {
    const uptime = driver.getUptime();
    expect(uptime.process).toBeGreaterThan(0);
    expect(uptime.system).toBeGreaterThan(0);
  });

  it('returns environment info with platform and arch', () => {
    const env = driver.getEnvironmentInfo();
    expect(env.platform).toBeTruthy();
    expect(typeof env.platform).toBe('string');
    expect(env.arch).toBeTruthy();
    expect(typeof env.arch).toBe('string');
    expect(env.hostname).toBeTruthy();
    expect(env.nodeVersion).toBeTruthy();
    expect(env.pid).toBeGreaterThan(0);
  });

  it('getStats returns null before start', () => {
    expect(driver.getStats()).toBeNull();
  });

  it('getStats returns all metrics after start', async () => {
    driver.start();
    // sampleStats sets stats synchronously before awaiting publish
    const stats = driver.getStats();
    expect(stats).not.toBeNull();

    expect(stats!.memory.total).toBeGreaterThan(0);
    expect(stats!.memory.free).toBeGreaterThan(0);
    expect(stats!.memory.used).toBeGreaterThan(0);
    expect(stats!.memory.usagePercent).toBeGreaterThan(0);
    expect(stats!.memory.heapTotal).toBeGreaterThan(0);
    expect(stats!.memory.heapUsed).toBeGreaterThan(0);

    expect(stats!.cpu.cores).toBeGreaterThan(0);
    expect(stats!.cpu.loadAverage).toHaveLength(3);

    expect(stats!.uptime.process).toBeGreaterThan(0);
    expect(stats!.uptime.system).toBeGreaterThan(0);

    expect(stats!.environment.platform).toBeTruthy();
    expect(stats!.environment.arch).toBeTruthy();
    expect(stats!.environment.hostname).toBeTruthy();
    expect(stats!.environment.nodeVersion).toBeTruthy();
    expect(stats!.environment.pid).toBeGreaterThan(0);
  });

  it('publishes health check event on sample', async () => {
    driver.start();
    // After start, the first sampleStats() runs and publishes
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'runtime:health_check' }),
    );
  });
});
