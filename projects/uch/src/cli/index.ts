#!/usr/bin/env node
import * as fs from 'node:fs';
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
import {
  autoTarget,
  coerceFindings,
  createEngineeringJudgment,
  engineeringFindingsFor,
  runEngineeringBenchmark,
} from '../engineering-intelligence/index.js';
import type { EngineeringFinding } from '../engineering-intelligence/index.js';
import { createFrameworkRegistry, FRAMEWORK_CATALOG_VERSION } from '../cognitive-plane/frameworks/registry.js';
import { checkRepresentationInvariance } from '../cognitive-plane/frameworks/knowledge/dikw.js';
import { FrameworkDecisionJournal, syncTakesWithJournal } from '../cognitive-plane/frameworks/journal/decision-journal.js';
import { FrameworkComposer } from '../cognitive-plane/frameworks/composer/composer.js';
import { computeCalibrationProfile } from '../cognitive-plane/calibration/calibration.js';
import { ProductivityKernel } from '../productivity-kernel/productivity-kernel.js';
import { SignalFusionEngine } from '../cortex_kernel/signal-fusion-engine.js';
import { CodeGovernanceGate } from '../kernel/constitution/code-governance-gate.js';

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
  uch organic-score            Score a change against the 15-metric Organic Score rubric (>=90 pass); [--kind code|design|plan|architecture] runs the engineering gates (vetoes hard-reject), [--findings <json>] adds explicit findings
  uch engineering-review       Run the deterministic engineering gates over a diff or prose (complexity, coupling, SPOF, failure surfaces, laws); [--kind], [--paths]
  uch engineering-benchmark    Run the labeled benchmark corpus and report contract status (veto recall, latency, negative controls)
  uch frameworks               List the Cognitive Frameworks Library (10 families)
  uch frameworks show <id>     Show a framework's stages and selection metadata
  uch frameworks select "<problem>" --data 0.8 --time 0.2 --stakeholders 0.5 --risk 0.7 [--family decisions]
  uch frameworks stats            Show framework usage analytics (decision journal)
  uch solve "<problem>"           Full pipeline: select → understand → diagnose → decide → risk gate → plan
  uch productivity             Show Productivity Kernel status (inbox, MIT, plan-execution rate)
  uch fusion                   Show Signal Fusion Engine status (runs, bands, risk-flag rate)
  uch governance "<change>"    Review a change against the Clean Code Covenant (allow/review/block)
  uch package install <dir>    Gate and install a cognitive package from a directory (manifest.json + payload)
  uch package update <dir>     Gate and update a cognitive package to a new version
  uch package revoke <name>    Revoke an installed package (stops new execution, drains sessions)
  uch package list             List installed cognitive packages
  uch package audit            Show the package audit ledger (install/update/revoke, in order)
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
      const local = await loadSkillsDir('./skills');
      const skills = [...disk, ...local, ...BUNDLED_SKILLS];
      console.log(renderSkillCatalog(skills));
      process.exit(0);
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
      // Frameworks section (blueprint §5.4): the decision journal's verdicts
      // are gradeable claims — merged into the takes fence as a 'framework'
      // domain so the profile shows which reasoning models hold up.
      const journal = new FrameworkDecisionJournal();
      await journal.load('.uccp/persist/framework-journal.json');
      const mergedTakes = syncTakesWithJournal(store.takes.all, journal);
      const profile = computeCalibrationProfile(mergedTakes);
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
      const journalStats = journal.getStats();
      if (journalStats.total > 0) {
        out.frameworks = {
          total: journalStats.total,
          open: journalStats.open,
          resolved: journalStats.resolved,
          usageByModel: journalStats.usageByModel,
          accuracyByModel: journalStats.accuracyByModel,
          dominantPerProblemType: journalStats.dominantPerProblemType,
          reversed: journalStats.reversed,
          drift: journalStats.drift,
        };
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
      if (!change) { console.error('Usage: uch organic-score "<change description> [:: intent] [:: files: a.ts,b.ts] [:: tests: npm test]" [--kind code|design|plan|architecture] [--findings <json array>]'); break; }
      const [changePart, intentPart, filesPart, testsPart] = change.split('::');
      const engine = new OrganicScoreEngine();

      const kindIdx = args.indexOf('--kind');
      const kind = kindIdx >= 0 ? args[kindIdx + 1] as 'code' | 'design' | 'plan' | 'architecture' : undefined;
      const findingsIdx = args.indexOf('--findings');

      let engineeringFindings: EngineeringFinding[] | undefined;

      const targetText = (changePart ?? '').trim();
      if (kind) {
        engineeringFindings = engineeringFindingsFor(targetText, kind);
      } else if (findingsIdx >= 0) {
        try {
          engineeringFindings = coerceFindings(JSON.parse(args[findingsIdx + 1] ?? '[]'));
        } catch {
          console.error('--findings must be a valid JSON array of EngineeringFinding objects');
          process.exit(1);
        }
      }

      const output = engine.evaluate({
        change: targetText,
        intent: (intentPart ?? '').trim() || undefined,
        context: {
          filesTouched: (filesPart ?? '').split(',').map((f) => f.trim()).filter(Boolean),
          testsRun: (testsPart ?? '').split(',').map((t) => t.trim()).filter(Boolean),
        },
        ...(engineeringFindings && engineeringFindings.length > 0 ? { engineeringFindings } : {}),
      });
      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
      break;
    }

    case 'engineering-review': {
      const text = args.slice(1).join(' ').trim();
      if (!text) { console.error("Usage: uch engineering-review \"<diff or prose>\" [--kind code|design|plan|architecture] [--paths a.ts,b.ts]"); process.exit(1); }
      const kindIdx = args.indexOf('--kind');
      const kind = kindIdx >= 0 ? args[kindIdx + 1] as 'code' | 'design' | 'plan' | 'architecture' : undefined;
      const pathsIdx = args.indexOf('--paths');
      const paths = pathsIdx >= 0
        ? (args[pathsIdx + 1] ?? '').split(',').map((p) => p.trim()).filter(Boolean)
        : [];
      const target = autoTarget(text, kind);
      if (target.kind === 'code' && paths.length > 0) target.paths = paths;
      const review = createEngineeringJudgment().evaluator.evaluate(target);
      console.log(JSON.stringify(review, null, 2));
      process.exit(0);
      break;
    }

    case 'engineering-benchmark': {
      const report = runEngineeringBenchmark();
      console.log(JSON.stringify({
        totalCases: report.totalCases,
        passedCases: report.passedCases,
        recall: report.recall,
        vetoRecall: report.vetoRecall,
        negativeControlPassRate: report.negativeControlPassRate,
        avgLatencyMs: report.avgLatencyMs,
        p95LatencyMs: report.p95LatencyMs,
        maxLatencyMs: report.maxLatencyMs,
        contract: {
          vetoRecallMet: report.vetoRecall >= 0.8,
          latencyMet: report.maxLatencyMs < 1000,
          negativeControlsClean: report.negativeControlPassRate === 1,
        },
      }, null, 2));
      process.exit(0);
      break;
    }

    case 'frameworks': {
      const registry = createFrameworkRegistry();
      const sub = args[1] ?? 'list';
      if (sub === 'show') {
        const id = args[2];
        const def = id ? registry.get(id) : null;
        if (!def) { console.error(`Unknown framework: ${id} — use 'uch frameworks' to list`); process.exit(1); }
        console.log(JSON.stringify({
          id: def.id, family: def.family, name: def.name, purpose: def.purpose,
          bestFor: def.bestFor, whenNotToUse: def.whenNotToUse,
          stages: def.stages, selection: def.selection, source: def.source,
        }, null, 2));
      } else if (sub === 'select') {
        const problem = args.slice(2).filter((a) => !a.startsWith('--')).join(' ');
        const flag = (name: string): number | undefined => {
          const i = args.indexOf(name);
          const value = i >= 0 ? args[i + 1] : undefined;
          return value === undefined ? undefined : Number.parseFloat(value);
        };
        const boolFlag = (name: string): boolean | undefined => {
          const i = args.indexOf(name);
          return i >= 0 && i + 1 < args.length ? args[i + 1] !== 'false' : undefined;
        };
        const familyIdx = args.indexOf('--family');
        if (!problem) { console.error('Usage: uch frameworks select "<problem>" [--data 0.8] [--time 0.2] [--stakeholders 0.5] [--risk 0.7] [--complexity 0.5] [--family decisions] [--root-cause] [--human-centered] [--continuous-improvement] [--speed]'); process.exit(1); }
        const result = registry.select({
          problem,
          family: familyIdx >= 0 ? args[familyIdx + 1] as never : undefined,
          dataAvailability: flag('--data'),
          timePressure: flag('--time'),
          stakeholderInvolvement: flag('--stakeholders'),
          risk: flag('--risk'),
          complexity: flag('--complexity'),
          rootCauseNeeded: boolFlag('--root-cause'),
          humanCentered: boolFlag('--human-centered'),
          continuousImprovement: boolFlag('--continuous-improvement'),
          speedAdaptability: boolFlag('--speed'),
        });
        console.log(JSON.stringify({
          selected: { id: result.selected.id, name: result.selected.name, family: result.selected.family },
          runnerUp: result.runnerUp ? { id: result.runnerUp.id, name: result.runnerUp.name } : null,
          rationale: result.rationale,
          alternatives: result.alternatives,
        }, null, 2));
      } else if (sub === 'invariance') {
        const claim = args[2];
        const representations = args.slice(3);
        if (!claim || representations.length < 2) {
          console.error('Usage: uch frameworks invariance "<claim>" "<representation 1>" "<representation 2>" [...]');
          process.exit(1);
        }
        const result = checkRepresentationInvariance(
          claim,
          representations.map((content, i) => ({ label: `representation ${i + 1}`, content })),
        );
        console.log(JSON.stringify({
          claim: result.claim,
          representations: result.representations,
          agreementPct: result.agreementPct,
          consistent: result.consistent,
          insight: result.insight,
        }, null, 2));
      } else if (sub === 'stats') {
        const journal = new FrameworkDecisionJournal();
        await journal.load('.uccp/persist/framework-journal.json');
        console.log(JSON.stringify(journal.getStats(), null, 2));
      } else {
        const family = args.indexOf('--family') >= 0 ? args[args.indexOf('--family') + 1] as never : undefined;
        const frameworks = registry.list(family);
        console.log(`Cognitive Frameworks Library (catalog v${FRAMEWORK_CATALOG_VERSION})`);
        for (const f of registry.families()) {
          console.log(`\n${f.label} (${f.count})`);
          for (const def of frameworks.filter((x) => x.family === f.family)) {
            console.log(`  ${def.id.padEnd(18)} ${def.name}`);
          }
        }
        console.log(`\n${frameworks.length} frameworks — use 'uch frameworks show <id>', 'uch frameworks select "<problem>"', 'uch frameworks invariance "<claim>" "<repr1>" "<repr2>"', or 'uch frameworks stats'`);
      }
      process.exit(0);
      break;
    }

    case 'solve': {
      const argsPos = args.findIndex((a, i) => i >= 1 && !a.startsWith('--'));
      if (argsPos < 0) {
        console.error('Usage: uch solve "<problem>" [--data 0.8] [--time 0.2] [--stakeholders 0.5] [--risk 0.7] [--complexity 0.5] [--family decisions] [--root-cause] [--human-centered] [--continuous-improvement] [--speed] [--options a,b,c] [--criteria cost,risk] [--weights 0.3,0.7] [--scores "8,4;9,5"] [--pros "x;y"] [--cons "x;y"] [--risk-causes "x;y"] [--risk-likelihood 0.7,0.5] [--risk-impact 0.8,0.6] [--evidence "x;y"]');
        process.exit(1);
      }
      const problem = args[argsPos]!;
      const flag = (name: string): number | undefined => {
        const i = args.indexOf(name);
        const value = i >= 0 ? args[i + 1] : undefined;
        return value === undefined ? undefined : Number.parseFloat(value);
      };
      const boolFlag = (name: string): boolean | undefined => {
        const i = args.indexOf(name);
        return i >= 0 && i + 1 < args.length ? args[i + 1] !== 'false' : undefined;
      };
      const listFlag = (name: string, sep: string): string[] | undefined => {
        const i = args.indexOf(name);
        if (i < 0) return undefined;
        return (args[i + 1] ?? '').split(sep).map((s) => s.trim()).filter(Boolean);
      };
      const numListFlag = (name: string): number[] | undefined => {
        const i = args.indexOf(name);
        if (i < 0) return undefined;
        return (args[i + 1] ?? '').split(',').map((s) => Number.parseFloat(s.trim())).filter((n) => Number.isFinite(n));
      };
      const scoresFlag = (): number[][] | undefined => {
        const i = args.indexOf('--scores');
        if (i < 0) return undefined;
        return (args[i + 1] ?? '').split(';').map((row) => row.split(',').map((s) => Number.parseFloat(s.trim())).filter((n) => Number.isFinite(n))).filter((row) => row.length > 0);
      };
      const familyIdx = args.indexOf('--family');
      const composer = new FrameworkComposer();
      const result = composer.solve(problem, {
        family: familyIdx >= 0 ? args[familyIdx + 1] as never : undefined,
        dataAvailability: flag('--data'),
        timePressure: flag('--time'),
        stakeholderInvolvement: flag('--stakeholders'),
        risk: flag('--risk'),
        complexity: flag('--complexity'),
        rootCauseNeeded: boolFlag('--root-cause'),
        humanCentered: boolFlag('--human-centered'),
        continuousImprovement: boolFlag('--continuous-improvement'),
        speedAdaptability: boolFlag('--speed'),
        options: listFlag('--options', ','),
        criteria: listFlag('--criteria', ','),
        weights: numListFlag('--weights'),
        scores: scoresFlag(),
        pros: listFlag('--pros', ';'),
        cons: listFlag('--cons', ';'),
        riskCauses: listFlag('--risk-causes', ';'),
        riskLikelihood: numListFlag('--risk-likelihood'),
        riskImpact: numListFlag('--risk-impact'),
        evidenceFacts: listFlag('--evidence', ';'),
      });
      const journal = new FrameworkDecisionJournal();
      await journal.load('.uccp/persist/framework-journal.json');
      for (const stage of result.stages) {
        journal.record({
          engine: stage.engine,
          family: stage.family,
          problem: result.problem,
          profile: result.profile,
          verdict: stage.verdict,
          mode: 'deterministic',
        });
      }
      await journal.persist('.uccp/persist/framework-journal.json');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
      break;
    }

    case 'productivity': {
      const kernel = new ProductivityKernel();
      kernel.capture('sample capture', 5);
      kernel.initializeDay([
        { name: 'sample MIT', urgency: 'urgent', importance: 'important', durationMin: 60 },
      ]);
      console.log(JSON.stringify(kernel.getStatus(), null, 2));
      process.exit(0);
      break;
    }

    case 'fusion': {
      const engine = new SignalFusionEngine();
      console.log(JSON.stringify(engine.getStatus(), null, 2));
      console.log('Use the MCP compose-signals tool to fuse candidate sets.');
      process.exit(0);
      break;
    }

    case 'governance': {
      const change = args.slice(1).join(' ').trim();
      if (!change) {
        console.error("Usage: uch governance \"<change description or diff snippet>\" [--intent <why>]");
        process.exit(1);
      }
      const intentIdx = args.indexOf('--intent');
      const intent = intentIdx >= 0 ? args[intentIdx + 1] : undefined;
      const gate = new CodeGovernanceGate();
      const record = gate.review({ change, intent, target: 'cli' });
      console.log(JSON.stringify({ verdict: record.verdict, score: record.score, evidence: record.evidence }, null, 2));
      process.exit(0);
      break;
    }

    case 'package': {
      const sub = args[1] ?? '';
      const {
        PackageGate,
        PackageStore,
        defaultGrantedCapabilities,
        validatePackageManifest,
      } = await import('../control-plane/packages/index.js');
      const { UCH_RUNTIME_VERSION } = await import('../workspace-manifest/attach.js');
      const storePath = path.join(workspaceRoot, '.uccp', 'persist', 'packages.json');
      const store = new PackageStore(eventBus);
      await store.load(storePath);

      const grantedCapabilities = defaultGrantedCapabilities();
      const installedPackages = new Map(
        store.list().filter((p) => !p.revoked).map((p) => [p.manifest.name, p.manifest.version]),
      );
      const gate = new PackageGate({
        grantedCapabilities,
        installedPackages,
        substrateVersion: UCH_RUNTIME_VERSION,
        eventBus,
      });

      if (sub === 'list') {
        console.log(JSON.stringify({
          count: store.list().length,
          packages: store.list().map((p) => ({
            name: p.manifest.name, version: p.manifest.version, kind: p.manifest.kind,
            active: p.active, revoked: p.revoked, activeSessions: p.activeSessions,
            installedAt: p.installedAt.toISOString(),
          })),
        }, null, 2));
        process.exit(0);
        break;
      }

      if (sub === 'audit') {
        console.log(JSON.stringify({
          count: store.audit().length,
          audit: store.audit().map((e) => ({ ...e, at: e.at.toISOString() })),
        }, null, 2));
        process.exit(0);
        break;
      }

      if (sub === 'install' || sub === 'update') {
        const dir = args[2];
        if (!dir) {
          console.error(`Usage: uch package ${sub} <dir>`);
          process.exit(1);
        }
        const manifestPath = path.join(dir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
          console.error(`No manifest.json found at ${manifestPath}`);
          process.exit(1);
        }
        const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const validated = validatePackageManifest(raw);
        if (!validated.ok) {
          console.error(`Malformed package manifest: ${validated.errors.join('; ')}`);
          process.exit(1);
        }
        const decision = await gate.evaluate(validated.manifest);
        if (!decision.admitted) {
          console.error(`Package gate denied: ${decision.reason ?? 'violations'}`);
          console.error(JSON.stringify({ violations: decision.violations }, null, 2));
          process.exit(1);
        }
        const applied = sub === 'install'
          ? store.install(validated.manifest)
          : store.update(validated.manifest);
        if (!applied) {
          console.error(`Package ${sub} failed (duplicate version or unknown package)`);
          process.exit(1);
        }
        await store.persist(storePath);
        console.log(JSON.stringify({
          action: sub,
          name: validated.manifest.name,
          version: validated.manifest.version,
          kind: validated.manifest.kind,
          gate: decision,
          audit: store.audit().slice(-1)[0] ? { ...store.audit().slice(-1)[0], at: store.audit().slice(-1)[0]!.at.toISOString() } : null,
        }, null, 2));
        process.exit(0);
        break;
      }

      if (sub === 'revoke') {
        const name = args[2];
        if (!name) {
          console.error('Usage: uch package revoke <name>');
          process.exit(1);
        }
        const revoked = store.revoke(name);
        if (!revoked) {
          console.error(`Package ${name} is not installed`);
          process.exit(1);
        }
        await store.persist(storePath);
        const entry = store.audit().slice(-1)[0];
        console.log(JSON.stringify({
          action: 'revoke', name, revoked: true,
          audit: entry ? { ...entry, at: entry.at.toISOString() } : null,
        }, null, 2));
        process.exit(0);
        break;
      }

      console.error('Usage: uch package <install|update|revoke|list|audit>');
      process.exit(1);
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
