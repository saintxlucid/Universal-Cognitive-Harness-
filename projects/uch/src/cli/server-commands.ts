/**
 * Server, workspace, and agentic-turn commands:
 * `mcp` / (default), `serve`, `attach`, `manifest`, `status`, `ingest`,
 * `think`, `chat`.
 */

import * as path from 'node:path';
import { MCPStdioServer } from '../mcp/stdio-server.js';
import { CognitiveExoskeleton } from '../exoskeleton/exoskeleton.js';
import type { CliContext } from './context.js';

export async function handleMcp(ctx: CliContext): Promise<void> {
  const {
    llm,
    kernel,
    bio,
    executive,
    workspace,
    embedder,
    sessionManager,
    gitIngester,
    scientificMemory,
    constitution,
  } = ctx;
  if (llm.isAvailable) {
    console.error('UCH MCP Server v0.2.0 — LLM: enabled');
  } else {
    console.error('UCH MCP Server v0.2.0 — LLM: disabled (set OPENAI_API_KEY)');
  }
  console.error('Connect via STDIO transport');
  const server = new MCPStdioServer({
    kernel,
    bio,
    executive,
    workspace,
    llm,
    embedder,
    sessionManager,
    gitIngester,
    scientificMemory,
    constitution,
  });
  server.start();
}

export async function handleServe(ctx: CliContext): Promise<void> {
  const { workspaceRoot } = ctx;
  console.error('Starting UCH HTTP server...');
  const { UCCPServer } = await import('./uccp.js');
  const server = new UCCPServer({
    workspaceId: ctx.workspaceId,
    workspaceName: 'UCH',
    workspaceRoot,
  });
  await server.start();
}

export async function handleAttach(ctx: CliContext): Promise<void> {
  const { workspaceRoot } = ctx;
  const { attach } = await import('../workspace-manifest/attach.js');
  const result = await attach({
    agent_id: 'uch-cli',
    user_id: 'system',
    startDir: workspaceRoot,
  });
  console.log(
    JSON.stringify(
      {
        attached: result.attached,
        reason: result.reason,
        workspace: result.attached ? result.discovery?.workspaceRoot : undefined,
        manifest: result.attached ? result.discovery?.manifestPath : undefined,
        version: result.version,
        capabilities: result.capabilities,
        drivers: result.drivers,
        session: result.attached ? result.session_id : undefined,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

export async function handleManifest(ctx: CliContext): Promise<void> {
  const { args, workspaceRoot } = ctx;
  const sub = args[1] ?? '';
  const { discoverManifest } = await import('../workspace-manifest/discovery.js');
  const { createManifest, writeManifest } = await import('../workspace-manifest/loader.js');
  if (sub === 'init') {
    const name = args[2] ?? path.basename(workspaceRoot);
    const existing = discoverManifest({ startDir: workspaceRoot });
    if (existing) {
      console.log(`Workspace manifest already exists at ${existing.manifestPath}`);
      process.exit(0);
    }
    const manifest = createManifest({
      name,
      purpose: 'Workspace cognitive configuration',
      minUchVersion: '0.2.0',
      capabilities: [
        { name: 'memory', enabled: true },
        { name: 'knowledge', enabled: true },
        { name: 'skills', enabled: true },
        { name: 'planning', enabled: true },
        { name: 'retrieval', enabled: true },
      ],
      drivers: [
        { id: 'filesystem', enabled: true },
        { id: 'git', enabled: true },
      ],
    });
    const targetPath = writeManifest(workspaceRoot, manifest);
    console.log(`Workspace manifest created at ${targetPath}`);
    process.exit(0);
  }
  if (sub === 'show') {
    const found = discoverManifest({ startDir: workspaceRoot });
    if (!found) {
      console.log('No workspace manifest found (create one with: uch manifest init)');
      process.exit(0);
    }
    console.log(
      JSON.stringify(
        {
          workspaceRoot: found.workspaceRoot,
          manifestPath: found.manifestPath,
          manifest: found.manifest,
          warnings: found.warnings,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
  console.error('Usage: uch manifest init | show');
}

export async function handleStatus(ctx: CliContext): Promise<void> {
  const { kernel, llm, embedder, sessionManager } = ctx;
  const stats = kernel.getStats();
  console.log(
    JSON.stringify(
      {
        version: '0.2.0',
        llm: llm.isAvailable ? `${llm.provider}:${llm.modelName}` : 'none',
        embedder: embedder.available ? 'enabled' : 'local-fallback',
        memory: {
          episodes: stats.episodes,
          concepts: stats.concepts,
          relationships: stats.relationships,
          beliefs: stats.beliefs,
        },
        sleep: { cycles: stats.sleep_cycles, active: stats.sleep_active },
        sessions: sessionManager.listSessions().length,
      },
      null,
      2,
    ),
  );
}

export async function handleIngest(ctx: CliContext): Promise<void> {
  const { gitIngester } = ctx;
  console.error('Ingesting git history...');
  const result = await gitIngester.ingestRecent(100);
  console.log(JSON.stringify(result, null, 2));
}

export async function handleThinkChat(ctx: CliContext): Promise<void> {
  const { args, workspaceId, workspaceRoot, llm } = ctx;
  const prompt = args.slice(1).join(' ');
  if (!prompt) {
    console.error('Usage: uch think "<prompt>"');
    return;
  }
  if (!llm.isAvailable) {
    console.error('LLM not configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
    return;
  }
  const exoskeleton = new CognitiveExoskeleton({
    workspaceId,
    workspaceName: 'UCH',
    workspaceRoot,
    llm,
  });
  await exoskeleton.start();
  console.error('Reasoning engine started. Running turn...');
  const result = await exoskeleton.runAgentic(prompt, {
    onMessage: (m) => {
      for (const block of m.content) {
        if (block.type === 'tool_use') {
          console.error(`[tool] ${block.name} ${JSON.stringify(block.input).slice(0, 120)}`);
        }
      }
    },
  });
  await exoskeleton.stop();
  console.log(result.text || '(no text output)');
  console.error(
    JSON.stringify({
      toolCalls: result.toolCalls,
      terminal: result.terminal.state,
      turns: result.terminal.turnCount,
      tokens: result.terminal.usage.inputTokens + result.terminal.usage.outputTokens,
    }),
  );
}
