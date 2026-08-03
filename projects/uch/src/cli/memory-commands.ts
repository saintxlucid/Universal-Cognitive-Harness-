/**
 * Memory and retrieval commands: `session`, `remember`, `recall`,
 * `mem-search`, `mem-timeline`, `mem-get`, `gap-analysis`, `synthesize`.
 */

import { ProgressiveMemorySearch } from '../memory/index.js';
import { GapAnalysisEngine } from '../kernel/retrieval/gap-analysis.js';
import { SynthesisEngine } from '../kernel/retrieval/synthesis.js';
import { printHelp } from './help.js';
import type { CliContext } from './context.js';

export async function handleSession(ctx: CliContext): Promise<void> {
  const { args, sessionManager } = ctx;
  const sub = args[1] ?? '';
  if (sub === 'list') {
    const sessions = sessionManager.listSessions();
    if (sessions.length === 0) {
      console.log('No saved sessions');
      return;
    }
    for (const s of sessions) {
      console.log(`${s.id.padEnd(36)} ${s.timestamp.slice(0, 19)}  ${s.toolName}`);
    }
  } else if (sub === 'export') {
    const sessionId = args[2];
    if (!sessionId) {
      console.error('Usage: uch session export <id>');
      return;
    }
    await sessionManager.loadSession(sessionId);
    const handoff = sessionManager.exportSessionHandoff();
    console.log(handoff);
  } else {
    printHelp();
  }
}

export async function handleRemember(ctx: CliContext): Promise<void> {
  const { args, sessionManager, bio } = ctx;
  const text = args.slice(1).join(' ');
  if (!text) {
    console.error('Usage: uch remember <text>');
    return;
  }
  sessionManager.addMemory({ value: text, type: 'observation', importance: 0.7 });
  const result = await bio.remember({ content: text, importance: 0.7 });
  console.log(JSON.stringify(result, null, 2));
}

export async function handleRecall(ctx: CliContext): Promise<void> {
  const { args, kernel, embedder } = ctx;
  const query = args.slice(1).join(' ');
  if (!query) {
    console.error('Usage: uch recall <query>');
    return;
  }
  const episodes = kernel.getRecentEpisodes(50);
  const items = episodes.map((e) => ({
    id: e.id,
    text:
      typeof e.content === 'object' && e.content !== null
        ? JSON.stringify(e.content)
        : String(e.content),
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
}

export async function handleMemSearch(ctx: CliContext): Promise<void> {
  const { args, kernel } = ctx;
  const query = args.slice(1).join(' ');
  if (!query) {
    console.error('Usage: uch mem-search "<query>"');
    return;
  }
  const searcher = new ProgressiveMemorySearch(kernel.getEpisodicStore());
  const result = searcher.search(query, { limit: 10 });
  console.log(
    JSON.stringify(
      {
        query: result.query,
        totalMatches: result.totalMatches,
        entries: result.entries,
        tokenCostHint: result.tokenCostHint,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

export async function handleMemTimeline(ctx: CliContext): Promise<void> {
  const { args, kernel } = ctx;
  const id = args[1];
  if (!id) {
    console.error('Usage: uch mem-timeline <id>');
    return;
  }
  const searcher = new ProgressiveMemorySearch(kernel.getEpisodicStore());
  const timeline = searcher.timeline({ anchorId: id });
  console.log(JSON.stringify(timeline, null, 2));
  process.exit(0);
}

export async function handleMemGet(ctx: CliContext): Promise<void> {
  const { args, kernel } = ctx;
  const ids = args.slice(1);
  if (ids.length === 0) {
    console.error('Usage: uch mem-get <id> [id...]');
    return;
  }
  const searcher = new ProgressiveMemorySearch(kernel.getEpisodicStore());
  const observations = searcher.getObservations(ids);
  console.log(JSON.stringify(observations, null, 2));
  process.exit(0);
}

export async function handleGapAnalysis(ctx: CliContext): Promise<void> {
  const { args, kernel } = ctx;
  const query = args.slice(1).join(' ');
  if (!query) {
    console.error('Usage: uch gap-analysis "<query>"');
    return;
  }
  const episodes = kernel.getRecentEpisodes(200);
  const results = episodes.map((e) => ({
    id: e.id,
    text:
      typeof e.content === 'object' && e.content !== null
        ? JSON.stringify(e.content)
        : String(e.content),
    timestamp: e.timestamp,
    source: e.session_id,
  }));
  const engine = new GapAnalysisEngine();
  const output = engine.analyze(query, results);
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

export async function handleSynthesize(ctx: CliContext): Promise<void> {
  const { args, kernel } = ctx;
  const query = args.slice(1).join(' ');
  if (!query) {
    console.error('Usage: uch synthesize "<query>"');
    return;
  }
  const episodes = kernel.getRecentEpisodes(200);
  const sources = episodes.map((e) => ({
    id: e.id,
    text:
      typeof e.content === 'object' && e.content !== null
        ? JSON.stringify(e.content)
        : String(e.content),
    timestamp: e.timestamp,
    source: e.session_id,
    title: e.summary ?? undefined,
  }));
  const engine = new SynthesisEngine();
  const output = engine.synthesize(query, sources);
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}
