#!/usr/bin/env node
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { LLMClient } from '../llm/provider.js';
import { Embedder } from '../embeddings/embedder.js';
import { SessionManager } from '../session/manager.js';
import { GitIngester } from '../git/ingester.js';
import { ScientificMemory } from '../cognitive-plane/memory/scientific-memory.js';
import { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';
import { MCPStdioServer } from '../mcp/stdio-server.js';

function printHelp(): void {
  console.log(`UCH — Universal Cognitive Harness v0.2.0

USAGE:
  uch                          Start MCP STDIO server (for AI tool integration)
  uch serve                    Start HTTP/Sse server (legacy mode)
  uch status                   Show cognitive system status
  uch ingest                   Ingest git history into memory
  uch session list             List saved sessions
  uch session export <id>      Export session as handoff document
  uch remember <text>          Store something in memory
  uch recall <query>           Search memory
  uch help                     Show this help

ENVIRONMENT:
  OPENAI_API_KEY               For LLM completions and embeddings
  ANTHROPIC_API_KEY            Alternative LLM provider
  OPENAI_BASE_URL              Custom API endpoint (optional)

EXAMPLES:
  OPENAI_API_KEY=sk-... uch            Start MCP server with AI
  OPENAI_API_KEY=sk-... uch ingest     Ingest git history
  uch session list                      List saved sessions
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? '';

  const workspaceRoot = process.cwd();
  const workspaceId = `ws-${Date.now()}`;

  const eventBus = new NeuralEventBus();
  const kernel = new CognitiveKernel({
    agent_id: 'uch',
    user_id: 'system',
    project_id: workspaceId,
    persistence_path: '.uccp/persist',
  });
  await kernel.init();

  const workspace = new WorkspaceBrain({
    workspace_id: workspaceId, name: 'UCH', root_path: workspaceRoot, eventBus,
  });
  const executive = new ExecutiveBrain({ eventBus });
  const bio = new BiologicalFunctions(kernel, workspace, executive);
  const llm = new LLMClient();
  const embedder = new Embedder({ provider: llm });
  const sessionManager = new SessionManager({ kernel });
  const gitIngester = new GitIngester({ kernel, llm, repoPath: workspaceRoot });
  const scientificMemory = new ScientificMemory();
  const constitution = new CognitiveConstitution();

  sessionManager.startSession('uch-cli', workspaceId);

  switch (command) {
    case '':
    case 'mcp': {
      if (llm.isAvailable) {
        console.error('UCH MCP Server v0.2.0 — LLM: enabled');
      } else {
        console.error('UCH MCP Server v0.2.0 — LLM: disabled (set OPENAI_API_KEY)');
      }
      console.error('Connect via STDIO transport');
      const server = new MCPStdioServer({
        kernel, bio, executive, workspace,
        llm, embedder, sessionManager, gitIngester, scientificMemory, constitution,
      });
      server.start();
      break;
    }

    case 'serve': {
      console.error('Starting UCH HTTP server...');
      const { UCCPServer } = await import('./uccp.js');
      const server = new UCCPServer({
        workspaceId, workspaceName: 'UCH', workspaceRoot,
      });
      await server.start();
      break;
    }

    case 'status': {
      const stats = kernel.getStats();
      console.log(JSON.stringify({
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
      }, null, 2));
      break;
    }

    case 'ingest': {
      console.error('Ingesting git history...');
      const result = await gitIngester.ingestRecent(100);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'session': {
      const sub = args[1] ?? '';
      if (sub === 'list') {
        const sessions = sessionManager.listSessions();
        if (sessions.length === 0) { console.log('No saved sessions'); break; }
        for (const s of sessions) {
          console.log(`${s.id.padEnd(36)} ${s.timestamp.slice(0, 19)}  ${s.toolName}`);
        }
      } else if (sub === 'export') {
        const sessionId = args[2];
        if (!sessionId) { console.error('Usage: uch session export <id>'); break; }
        await sessionManager.loadSession(sessionId);
        const handoff = sessionManager.exportSessionHandoff();
        console.log(handoff);
      } else {
        printHelp();
      }
      break;
    }

    case 'remember': {
      const text = args.slice(1).join(' ');
      if (!text) { console.error('Usage: uch remember <text>'); break; }
      sessionManager.addMemory({ value: text, type: 'observation', importance: 0.7 });
      const result = await bio.remember({ content: text, importance: 0.7 });
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'recall': {
      const query = args.slice(1).join(' ');
      if (!query) { console.error('Usage: uch recall <query>'); break; }
      const episodes = kernel.getRecentEpisodes(50);
      const items = episodes.map((e) => ({
        id: e.id,
        text: typeof e.content === 'object' && e.content !== null ? JSON.stringify(e.content) : String(e.content),
      }));
      if (embedder.available) {
        const results = await embedder.search(query, items, 5);
        for (const r of results) {
          console.log(`[${r.score.toFixed(3)}] ${(r.item as { text: string }).text.slice(0, 200)}`);
        }
      } else {
        const results = kernel.recallFormatted({ text: query });
        console.log(results);
      }
      break;
    }

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
