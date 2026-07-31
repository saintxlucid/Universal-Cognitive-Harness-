import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { UCHAgentPlugin, bootUCH } from '../agent/index.js';
import { WorkspaceContextGatherer } from '../context/gatherer.js';

describe('UCH Agent Integration — Full Lifecycle', () => {
  let plugin: UCHAgentPlugin;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(tmpdir(), 'uch-integration-'));
    plugin = new UCHAgentPlugin({
      workspaceRoot: tmpDir,
      workspaceId: 'test-' + Date.now().toString(36),
      workspaceName: 'UCH Integration Test',
      toolName: 'codex',
      persistencePath: path.join(tmpDir, '.uccp/persist'),
      autoIngestGit: false,
    });
    await plugin.boot();
  });

  afterEach(async () => {
    await plugin.shutdown();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  it('boots and reports state', () => {
    expect(plugin.isReady).toBe(true);
    expect(plugin.agentName).toBe('codex');
    expect(plugin.toolName).toBe('codex');
    expect(plugin.uptime).toBeGreaterThanOrEqual(0);
    const summary = plugin.getSummary();
    expect(summary.tool).toBe('codex');
    expect(typeof summary.episodes).toBe('number');
    expect(typeof summary.concepts).toBe('number');
  });

  it('exposes a wired CodingToolkit', async () => {
    expect(plugin.coding).toBeDefined();
    expect(plugin.coding.workspaceRoot).toBe(tmpDir);
    const file = path.join(tmpDir, 'sample.ts');
    fs.writeFileSync(file, 'export const sample = () => 1;\n');
    const result = await plugin.coding.analyzeProject(tmpDir);
    expect(result.stats.files).toBeGreaterThanOrEqual(1);
    const match = plugin.coding.suggestSkill('write tests for this');
    expect(match.skill.category).toBe('testing');
  });

  it('getContext returns relevant memory from empty state', async () => {
    const ctx = await plugin.getContext('Hello UCH', { currentFile: 'test.ts' });
    expect(ctx.message).toBe('Hello UCH');
    expect(ctx.currentFile).toBe('test.ts');
    expect(typeof ctx.sessionAge).toBe('number');
  });

  it('learnFromInteraction creates episodes', async () => {
    const before = plugin.kernel.getStats().episodes;
    await plugin.learnFromInteraction(
      'What is the architecture?',
      'The system uses a layered approach.',
    );
    const after = plugin.kernel.getStats().episodes;
    expect(after).toBeGreaterThan(before);
  });

  it('session lifecycle — start, add memory, save, load', async () => {
    plugin.recordDecision('Test Decision', 'A test decision for verification');
    plugin.recordConvention('Use TypeScript strict mode', ['typescript', 'linting']);
    plugin.sessionManager.addEntry({ role: 'user', content: 'test message' });

    const session = plugin.sessionManager.getSession();
    expect(session).not.toBeNull();
    expect(session!.memories.length).toBeGreaterThanOrEqual(2);
    expect(session!.conversation.length).toBeGreaterThanOrEqual(1);

    const { sessionPath, handoff } = await plugin.saveAndHandoff('integration-test');
    expect(sessionPath).toBeTruthy();
    expect(fs.existsSync(sessionPath)).toBe(true);
    expect(handoff).toContain('Session Handoff');
    expect(handoff).toContain('Test Decision');
    expect(handoff).toContain('Use TypeScript strict mode');
  });

  it('saveAndHandoff produces portable document', async () => {
    plugin.recordDecision('Use React', 'Frontend framework decision');
    plugin.recordConvention('Components go in src/components/');

    const { sessionPath, handoff } = await plugin.saveAndHandoff('handoff-test');
    expect(handoff).toContain('## Key Decisions');
    expect(handoff).toContain('Use React');
    expect(handoff).toContain('## Project Conventions');
    expect(handoff).toContain('Components go in src/components/');
    expect(fs.existsSync(sessionPath)).toBe(true);
  });

  it('loadSession restores previous state', async () => {
    plugin.recordDecision('Dual-session test', 'Decision for session restore test');
    await plugin.saveAndHandoff('dual-session-test');

    const newPlugin = new UCHAgentPlugin({
      workspaceRoot: tmpDir,
      workspaceId: 'test-2-' + Date.now().toString(36),
      toolName: 'codex',
      persistencePath: path.join(tmpDir, '.uccp/persist'),
      autoIngestGit: false,
    });
    await newPlugin.boot();

    const loaded = await newPlugin.loadSession('dual-session-test');
    expect(loaded).toBe(true);

    const summary = newPlugin.getSummary();
    expect(summary).toBeDefined();

    await newPlugin.shutdown();
  });

  it('detects VS Code and Copilot runtimes from the environment', () => {
    const runtimeVars = [
      'VSCODE_GIT_IPC_HANDLE',
      'TERM_PROGRAM',
      'GITHUB_COPILOT',
      'CLAUDE_CODE',
      'CODEX_API_KEY',
      'OPENCODE',
      'CURSOR',
    ] as const;
    const previous = Object.fromEntries(runtimeVars.map((key) => [key, process.env[key]]));

    const restore = () => {
      for (const key of runtimeVars) {
        const value = previous[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    };

    try {
      for (const key of runtimeVars) delete process.env[key];
      process.env.TERM_PROGRAM = 'vscode';
      const vscodePlugin = new UCHAgentPlugin({ workspaceRoot: tmpDir, autoIngestGit: false });
      expect(vscodePlugin.agentName).toBe('vscode');

      delete process.env.TERM_PROGRAM;
      process.env.GITHUB_COPILOT = '1';
      const copilotPlugin = new UCHAgentPlugin({ workspaceRoot: tmpDir, autoIngestGit: false });
      expect(copilotPlugin.agentName).toBe('copilot');
    } finally {
      restore();
    }
  });

  it('supports all configured tool names', () => {
    const tools = [
      'claude-code',
      'codex',
      'opencode',
      'cursor',
      'copilot',
      'windsurf',
      'antigravity',
    ];
    for (const tool of tools) {
      const p = new UCHAgentPlugin({
        toolName: tool,
        workspaceRoot: tmpDir,
        autoIngestGit: false,
      });
      expect(p.agentName).toBe(tool);
    }
  });

  it('sessionManager tracks conversation history', async () => {
    plugin.sessionManager.addEntry({ role: 'user', content: 'First message' });
    plugin.sessionManager.addEntry({ role: 'assistant', content: 'First response' });
    plugin.sessionManager.addEntry({ role: 'user', content: 'Second message' });

    const session = plugin.sessionManager.getSession();
    expect(session!.conversation.length).toBe(3);
    expect(session!.conversation[0]!.role).toBe('user');
    expect(session!.conversation[0]!.content).toBe('First message');
    expect(session!.conversation[2]!.role).toBe('user');
    expect(session!.conversation[2]!.content).toBe('Second message');
  });

  it('distinguishes memory types', () => {
    plugin.recordDecision('Decision One', 'First decision');
    plugin.recordConvention('Convention One');
    plugin.sessionManager.addMemory({ value: 'Task One', type: 'task', importance: 0.6 });

    const session = plugin.sessionManager.getSession();
    const decisions = session!.memories.filter((m) => m.type === 'decision');
    const conventions = session!.memories.filter((m) => m.type === 'convention');
    const tasks = session!.memories.filter((m) => m.type === 'task');

    expect(decisions.length).toBeGreaterThanOrEqual(1);
    expect(conventions.length).toBeGreaterThanOrEqual(1);
    expect(tasks.length).toBeGreaterThanOrEqual(1);
  });

  it('getSummary returns correct snapshot', () => {
    plugin.recordDecision('Arch Decision', 'Architecture choice');
    const summary = plugin.getSummary();
    expect(summary.tool).toBe('codex');
    expect(typeof summary.uptime).toBe('number');
    expect(typeof summary.decisions).toBe('number');
    expect(summary.decisions).toBeGreaterThanOrEqual(1);
  });
});

describe('WorkspaceContextGatherer', () => {
  let gatherer: WorkspaceContextGatherer;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(tmpdir(), 'uch-context-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'KEY=value');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Project\nThis is a test.');
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'export const x = 1;');
    gatherer = new WorkspaceContextGatherer(tmpDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  it('gathers project structure', async () => {
    const ctx = await gatherer.gather();
    expect(ctx.projectStructure.root).toBe(tmpDir);
    expect(ctx.projectStructure.packageManager).toBeTruthy();
    expect(ctx.projectStructure.hasTypeScript).toBe(true);
    expect(ctx.projectStructure.entryPoints).toContain('src/index.ts');
    expect(ctx.projectStructure.readme).toBeDefined();
  });

  it('detects config files', async () => {
    const ctx = await gatherer.gather();
    expect(ctx.configFiles['package.json']).toBeDefined();
    expect(ctx.configFiles['tsconfig.json']).toBeDefined();
    expect(ctx.configFiles['.env.example']).toBeDefined();
  });

  it('generates summary', async () => {
    const summary = await gatherer.summary();
    expect(summary).toContain('Workspace:');
    expect(summary).toContain('TypeScript');
    expect(summary).toContain('npm');
  });

  it('file system stats are reasonable', async () => {
    const ctx = await gatherer.gather();
    expect(ctx.fileSystem.totalFiles).toBeGreaterThanOrEqual(3);
    expect(ctx.fileSystem.totalDirs).toBeGreaterThanOrEqual(1);
  });
});

describe('bootUCH singleton', () => {
  it('bootUCH returns instance on first call', async () => {
    const tmpDir = fs.mkdtempSync(path.join(tmpdir(), 'uch-boot-'));
    const instance = await bootUCH({
      workspaceRoot: tmpDir,
      toolName: 'codex',
      autoIngestGit: false,
    });
    expect(instance).toBeDefined();
    expect(instance.isReady).toBe(true);
    expect(instance.agentName).toBe('codex');

    const same = await bootUCH({
      workspaceRoot: tmpDir,
      toolName: 'codex',
      autoIngestGit: false,
    });
    expect(same).toBe(instance);
    await instance.shutdown();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });
});
