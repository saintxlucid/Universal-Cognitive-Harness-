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
import { printHelp } from './help.js';
import { PROFILE_DEFAULT_SOURCE, formatProfile, loadTraces } from './profile-command.js';
import {
  handleAttach,
  handleIngest,
  handleManifest,
  handleMcp,
  handleServe,
  handleStatus,
  handleThinkChat,
} from './server-commands.js';
import {
  handleGapAnalysis,
  handleMemGet,
  handleMemSearch,
  handleMemTimeline,
  handleRecall,
  handleRemember,
  handleSession,
  handleSynthesize,
} from './memory-commands.js';
import { handleSkill, handleSkills } from './skill-commands.js';
import {
  handleCalibration,
  handleEngineeringBenchmark,
  handleEngineeringReview,
  handleGovernance,
  handleOrganicScore,
  handlePrinciplesCheck,
  handleTakes,
} from './governance-commands.js';
import { handleFrameworks, handleSolve } from './framework-commands.js';
import { handlePackage } from './package-command.js';
import { handleCir } from './cir-command.js';
import { handleFusion, handleProductivity } from './productivity-commands.js';
import type { CliContext, CommandHandler } from './context.js';

// --- command handlers local to the dispatch shell ---

async function handleProfile(ctx: CliContext): Promise<void> {
  const { args } = ctx;
  const verbose = args.includes('--verbose');
  const fileArg = args.slice(1).find((a) => !a.startsWith('--'));
  const source = fileArg ?? PROFILE_DEFAULT_SOURCE;
  try {
    const traces = loadTraces(source);
    console.log(formatProfile(traces, verbose));
  } catch (err) {
    console.error(`uch profile: ${String(err)}`);
    console.error('Usage: uch profile [<ledger-file>] [--verbose]');
    process.exit(1);
  }
}

function handleHelp(): void {
  printHelp();
}

function handleDefault(ctx: CliContext): void {
  const { args } = ctx;
  console.error(`Unknown command: ${args[0] ?? ''}`);
  printHelp();
}

// --- dispatch table ---

const COMMANDS: Record<string, CommandHandler> = {
  '': handleMcp,
  mcp: handleMcp,
  serve: handleServe,
  attach: handleAttach,
  manifest: handleManifest,
  status: handleStatus,
  ingest: handleIngest,
  session: handleSession,
  remember: handleRemember,
  recall: handleRecall,
  think: handleThinkChat,
  chat: handleThinkChat,
  skills: handleSkills,
  skill: handleSkill,
  'mem-search': handleMemSearch,
  'mem-timeline': handleMemTimeline,
  'mem-get': handleMemGet,
  'gap-analysis': handleGapAnalysis,
  synthesize: handleSynthesize,
  takes: handleTakes,
  calibration: handleCalibration,
  'principles-check': handlePrinciplesCheck,
  'organic-score': handleOrganicScore,
  'engineering-review': handleEngineeringReview,
  'engineering-benchmark': handleEngineeringBenchmark,
  frameworks: handleFrameworks,
  solve: handleSolve,
  productivity: handleProductivity,
  fusion: handleFusion,
  governance: handleGovernance,
  package: handlePackage,
  cir: handleCir,
  profile: handleProfile,
  help: handleHelp,
  '--help': handleHelp,
  '-h': handleHelp,
};

async function createCliContext(): Promise<CliContext> {
  const args = process.argv.slice(2);

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
    workspace_id: workspaceId,
    name: 'UCH',
    root_path: workspaceRoot,
    eventBus,
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

  return {
    args,
    workspaceRoot,
    workspaceId,
    eventBus,
    kernel,
    workspace,
    executive,
    bio,
    llm,
    embedder,
    sessionManager,
    gitIngester,
    scientificMemory,
    constitution,
  };
}

async function main(): Promise<void> {
  const ctx = await createCliContext();
  const command = ctx.args[0] ?? '';
  const handler = COMMANDS[command] ?? handleDefault;
  await handler(ctx);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
