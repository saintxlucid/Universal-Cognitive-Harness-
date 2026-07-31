#!/usr/bin/env node
import * as path from 'node:path';
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
import { CognitiveExoskeleton } from '../exoskeleton/exoskeleton.js';
import { SkillRegistry } from '../cognitive-memory/skill-registry.js';
import { SkillPackInstaller, SkillCreator, SkillOptimizer } from '../skills/index.js';
import { ProgressiveMemorySearch } from '../memory/index.js';
import { GapAnalysisEngine } from '../kernel/retrieval/gap-analysis.js';
import { SynthesisEngine } from '../kernel/retrieval/synthesis.js';
import { CalibrationStore } from '../cognitive-plane/calibration/store.js';
import { CodingPrinciplesEngine } from '../kernel/constitution/coding-principles.js';
import { OrganicScoreEngine } from '../kernel/constitution/organic-score.js';

function printHelp(): void {
  console.log(`UCH — Universal Cognitive Harness v0.2.0

USAGE:
  uch                          Start MCP STDIO server (for AI tool integration)
  uch serve                    Start HTTP/Sse server (legacy mode)
  uch status                   Show cognitive system status
  uch attach                   Attach to workspace (discover manifest, negotiate, start drivers)
  uch manifest init            Create a workspace manifest (.uch/uch.manifest.json)
  uch manifest show            Show the discovered workspace manifest
  uch ingest                   Ingest git history into memory
  uch session list             List saved sessions
  uch session export <id>      Export session as handoff document
  uch remember <text>          Store something in memory
  uch recall <query>           Search memory
  uch think "<prompt>"         Internal reasoning turn (cognitive tools only)
  uch chat "<prompt>"          Alias for think
  uch skills                   List loaded skills
  uch skill scan <dir>         Scan an external skill pack (SKILL.md format)
  uch skill catalog <dir>      Catalog an external skill repo
  uch skill import <dir> <n>   Install skill(s) from external repo into ./skills [--force]
  uch skill create <name>      Create a new skill from a template
  uch skill optimize           Analyze skill invocations and suggest improvements
  uch skill provenance         Show which skills were imported and from where
  uch mem-search "<query>"     Progressive memory search (layer 1: index)
  uch mem-timeline <id>        Chronological context around a memory (layer 2)
  uch mem-get <id> [id...]     Full details for specific memory IDs (layer 3)
  uch gap-analysis "<query>"     Synthesis with citations and gap analysis
  uch synthesize "<query>"       Grounded synthesis: claims with [source] citations
  uch takes add "<claim>" <cv>   Record a gradeable claim (conviction 0-1)
  uch takes resolve <id> <q>     Grade a take: correct|incorrect|partial|unresolvable
  uch takes list                 List takes (--open / --resolved)
  uch calibration                Show calibration profile (Brier, scorecards, bias tags)
  uch principles-check         Evaluate a change against the 4 coding principles
  uch organic-score            Score a change against the 15-metric Organic Score rubric (>=90 pass)
  uch help                     Show this help

ENVIRONMENT:
  OPENAI_API_KEY               For LLM completions and embeddings
  ANTHROPIC_API_KEY            Alternative LLM provider
  OPENAI_BASE_URL              Custom API endpoint (optional)

EXAMPLES:
  OPENAI_API_KEY=<your-key> uch            Start MCP server with AI
  OPENAI_API_KEY=<your-key> uch ingest     Ingest git history
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

    case 'attach': {
      const { attach } = await import('../workspace-manifest/attach.js');
      const result = await attach({
        agent_id: 'uch-cli',
        user_id: 'system',
        startDir: workspaceRoot,
      });
      console.log(JSON.stringify({
        attached: result.attached,
        reason: result.reason,
        workspace: result.attached ? result.discovery?.workspaceRoot : undefined,
        manifest: result.attached ? result.discovery?.manifestPath : undefined,
        version: result.version,
        capabilities: result.capabilities,
        drivers: result.drivers,
        session: result.attached ? result.session_id : undefined,
      }, null, 2));
      process.exit(0);
      break;
    }

    case 'manifest': {
      const sub = args[1] ?? '';
      const { discoverManifest } = await import('../workspace-manifest/discovery.js');
      const { createManifest, writeManifest } = await import('../workspace-manifest/loader.js');
      if (sub === 'init') {
        const name = args[2] ?? path.basename(workspaceRoot);
        const existing = discoverManifest({ startDir: workspaceRoot });
        if (existing) {
          console.log(`Workspace manifest already exists at ${existing.manifestPath}`);
          process.exit(0);
          break;
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
        break;
      }
      if (sub === 'show') {
        const found = discoverManifest({ startDir: workspaceRoot });
        if (!found) {
          console.log('No workspace manifest found (create one with: uch manifest init)');
          process.exit(0);
          break;
        }
        console.log(JSON.stringify({
          workspaceRoot: found.workspaceRoot,
          manifestPath: found.manifestPath,
          manifest: found.manifest,
          warnings: found.warnings,
        }, null, 2));
        process.exit(0);
        break;
      }
      console.error('Usage: uch manifest init | show');
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

    case 'think':
    case 'chat': {
      const prompt = args.slice(1).join(' ');
      if (!prompt) { console.error('Usage: uch think "<prompt>"'); break; }
      if (!llm.isAvailable) {
        console.error('LLM not configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
        break;
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
      console.error(JSON.stringify({
        toolCalls: result.toolCalls,
        terminal: result.terminal.state,
        turns: result.terminal.turnCount,
        tokens: result.terminal.usage.inputTokens + result.terminal.usage.outputTokens,
      }));
      break;
    }

    case 'skills': {
      const { BUNDLED_SKILLS, renderSkillCatalog, loadSkillsDir } = await import('../agentic/skills/skills.js');
      const disk = await loadSkillsDir('.agents/skills');
      const skills = [...disk, ...BUNDLED_SKILLS];
      console.log(renderSkillCatalog(skills));
      break;
    }

    case 'skill': {
      const sub = args[1] ?? '';
      if (sub === 'scan') {
        const dir = args[2];
        if (!dir) { console.error('Usage: uch skill scan <dir>'); break; }
        const registry = new SkillRegistry();
        const installer = new SkillPackInstaller(registry);
        const result = await installer.installFromDir(dir, { sourcePrefix: 'external' });
        console.log(JSON.stringify({
          installed: result.installed,
          skipped: result.skipped,
          totalRegistered: registry.count(),
        }, null, 2));
      } else if (sub === 'catalog') {
        const dir = args[2];
        if (!dir) { console.error('Usage: uch skill catalog <dir>'); break; }
        const { SkillCatalogScanner, renderSkillCatalogTable } = await import('../skills/skill-catalog.js');
        const scanner = new SkillCatalogScanner();
        const summary = await scanner.scanDir(dir);
        console.log(renderSkillCatalogTable(summary));
      } else if (sub === 'import') {
        const dir = args[2];
        const names = args.slice(3).filter((a) => a !== '--force');
        const force = args.includes('--force');
        if (!dir || names.length === 0) { console.error('Usage: uch skill import <dir> <name1> [name2...] [--force]'); break; }
        const { SkillImporter } = await import('../skills/skill-catalog.js');
        const importer = new SkillImporter();
        const result = await importer.importFromDir(dir, './skills', names, { force });
        console.log(JSON.stringify({
          installed: result.installed,
          skipped: result.skipped,
          failed: result.failed,
          totalBytes: result.totalBytes,
        }, null, 2));
      } else if (sub === 'provenance') {
        const { loadImportIndex } = await import('../skills/skill-catalog.js');
        const index = await loadImportIndex('./skills');
        if (!index || Object.keys(index.skills).length === 0) {
          console.log('No imported skills recorded (index file not found).');
        } else {
          for (const [name, entry] of Object.entries(index.skills)) {
            console.log(`  ${name} <- ${entry.sourceRepo} (${entry.installedAt}, ${entry.files.length} files)`);
          }
        }
      } else if (sub === 'create') {
        const name = args[2];
        const description = args.slice(3).join(' ');
        if (!name || !description) { console.error('Usage: uch skill create <name> "<description>"'); break; }
        const creator = new SkillCreator();
        const result = await creator.writeToDir('./skills', { name, description });
        console.log(JSON.stringify({ created: result.filePath }, null, 2));
      } else if (sub === 'optimize') {
        const registry = new SkillRegistry();
        const optimizer = new SkillOptimizer();
        const reports = optimizer.analyzeAll(registry.getRecentInvocations(1000));
        console.log(JSON.stringify(reports, null, 2));
      } else {
        console.error('Usage: uch skill scan <dir> | catalog <dir> | import <dir> <name...> | create <name> "<desc>" | optimize');
      }
      process.exit(0);
      break;
    }

    case 'mem-search': {
      const query = args.slice(1).join(' ');
      if (!query) { console.error('Usage: uch mem-search "<query>"'); break; }
      const searcher = new ProgressiveMemorySearch(kernel.getEpisodicStore());
      const result = searcher.search(query, { limit: 10 });
      console.log(JSON.stringify({
        query: result.query,
        totalMatches: result.totalMatches,
        entries: result.entries,
        tokenCostHint: result.tokenCostHint,
      }, null, 2));
      process.exit(0);
      break;
    }

    case 'mem-timeline': {
      const id = args[1];
      if (!id) { console.error('Usage: uch mem-timeline <id>'); break; }
      const searcher = new ProgressiveMemorySearch(kernel.getEpisodicStore());
      const timeline = searcher.timeline({ anchorId: id });
      console.log(JSON.stringify(timeline, null, 2));
      process.exit(0);
      break;
    }

    case 'mem-get': {
      const ids = args.slice(1);
      if (ids.length === 0) { console.error('Usage: uch mem-get <id> [id...]'); break; }
      const searcher = new ProgressiveMemorySearch(kernel.getEpisodicStore());
      const observations = searcher.getObservations(ids);
      console.log(JSON.stringify(observations, null, 2));
      process.exit(0);
      break;
    }

    case 'gap-analysis': {
      const query = args.slice(1).join(' ');
      if (!query) { console.error('Usage: uch gap-analysis "<query>"'); break; }
      const episodes = kernel.getRecentEpisodes(200);
      const results = episodes.map((e) => ({
        id: e.id,
        text: typeof e.content === 'object' && e.content !== null ? JSON.stringify(e.content) : String(e.content),
        timestamp: e.timestamp,
        source: e.session_id,
      }));
      const engine = new GapAnalysisEngine();
      const output = engine.analyze(query, results);
      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
      break;
    }

    case 'synthesize': {
      const query = args.slice(1).join(' ');
      if (!query) { console.error('Usage: uch synthesize "<query>"'); break; }
      const episodes = kernel.getRecentEpisodes(200);
      const sources = episodes.map((e) => ({
        id: e.id,
        text: typeof e.content === 'object' && e.content !== null ? JSON.stringify(e.content) : String(e.content),
        timestamp: e.timestamp,
        source: e.session_id,
        title: e.summary ?? undefined,
      }));
      const engine = new SynthesisEngine();
      const output = engine.synthesize(query, sources);
      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
      break;
    }

    case 'takes': {
      const sub = args[1] ?? '';
      const store = new CalibrationStore();
      await store.load();
      if (sub === 'add') {
        const claim = args.slice(2, -1).join(' ');
        const convictionRaw = args[args.length - 1];
        const conviction = Number.parseFloat(convictionRaw ?? '');
        if (!claim || !Number.isFinite(conviction) || conviction < 0 || conviction > 1) {
          console.error('Usage: uch takes add "<claim>" <conviction 0-1>');
          break;
        }
        const take = await store.addTake({ claim, conviction });
        console.log(JSON.stringify(take, null, 2));
      } else if (sub === 'resolve') {
        const id = args[2];
        const quality = args[3] as 'correct' | 'incorrect' | 'partial' | 'unresolvable';
        if (!id || !['correct', 'incorrect', 'partial', 'unresolvable'].includes(quality)) {
          console.error('Usage: uch takes resolve <id> <correct|incorrect|partial|unresolvable>');
          break;
        }
        const take = await store.resolveTake(id, { quality, resolvedBy: 'uch-cli' });
        console.log(JSON.stringify(take, null, 2));
      } else if (sub === 'list') {
        const filter = args[2] === '--open' ? store.takes.open : args[2] === '--resolved' ? store.takes.resolved : store.takes.all;
        for (const t of filter) {
          console.log(`${t.status === 'resolved' ? '✓' : '·'} ${t.id.slice(0, 8)} ${t.conviction.toFixed(2)} ${t.domain.padEnd(12)} ${t.quality ?? 'open'.padEnd(11)} ${t.claim.slice(0, 90)}`);
        }
        console.log(`\n${store.takes.count()} takes (${store.takes.open.length} open, ${store.takes.resolved.length} resolved)`);
      } else {
        console.error('Usage: uch takes add "<claim>" <cv> | resolve <id> <quality> | list [--open|--resolved]');
      }
      process.exit(0);
      break;
    }

    case 'calibration': {
      const store = new CalibrationStore();
      await store.load();
      const profile = store.profile();
      const out: Record<string, unknown> = {
        resolvedCount: profile.resolvedCount,
        openCount: profile.openCount,
        coldStart: profile.coldStart,
        brier: profile.brier,
        accuracy: profile.accuracy,
        unresolvableRate: profile.unresolvableRate,
        biasTags: profile.biasTags,
      };
      if (!profile.coldStart) {
        out.scorecards = profile.scorecards;
        out.convictionBuckets = profile.buckets;
        out.narrative = profile.narratives.join('\n');
      } else {
        out.narrative = profile.narratives[0] ?? '';
      }
      console.log(JSON.stringify(out, null, 2));
      process.exit(0);
      break;
    }

    case 'principles-check': {
      const intent = args.slice(1).join(' ');
      if (!intent) { console.error('Usage: uch principles-check "<intent> [:: proposed change]"'); break; }
      const [intentPart, changePart] = intent.split('::');
      const engine = new CodingPrinciplesEngine();
      const output = engine.evaluate({
        intent: (intentPart ?? '').trim(),
        proposedChange: (changePart ?? '').trim(),
      });
      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
      break;
    }

    case 'organic-score': {
      const change = args.slice(1).join(' ');
      if (!change) { console.error('Usage: uch organic-score "<change description> [:: intent] [:: files: a.ts,b.ts] [:: tests: npm test]"'); break; }
      const [changePart, intentPart, filesPart, testsPart] = change.split('::');
      const engine = new OrganicScoreEngine();
      const output = engine.evaluate({
        change: (changePart ?? '').trim(),
        intent: (intentPart ?? '').trim() || undefined,
        context: {
          filesTouched: (filesPart ?? '').split(',').map((f) => f.trim()).filter(Boolean),
          testsRun: (testsPart ?? '').split(',').map((t) => t.trim()).filter(Boolean),
        },
      });
      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
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
