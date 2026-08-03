/**
 * Shared CLI infrastructure: the per-command context object, the command
 * handler signature, and the flag-parsing helpers used by the framework and
 * CIR command families.
 *
 * Everything here is type-only or pure — no command implementations live in
 * this module (decomposition target W-04).
 */

import type { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import type { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import type { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import type { BiologicalFunctions } from '../harness-api/biological-functions.js';
import type { LLMClient } from '../llm/provider.js';
import type { Embedder } from '../embeddings/embedder.js';
import type { SessionManager } from '../session/manager.js';
import type { GitIngester } from '../git/ingester.js';
import type { ScientificMemory } from '../cognitive-plane/memory/scientific-memory.js';
import type { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';

/** Shared dependencies handed to every command handler. */
export interface CliContext {
  args: string[];
  workspaceRoot: string;
  workspaceId: string;
  eventBus: NeuralEventBus;
  kernel: CognitiveKernel;
  workspace: WorkspaceBrain;
  executive: ExecutiveBrain;
  bio: BiologicalFunctions;
  llm: LLMClient;
  embedder: Embedder;
  sessionManager: SessionManager;
  gitIngester: GitIngester;
  scientificMemory: ScientificMemory;
  constitution: CognitiveConstitution;
}

export type CommandHandler = (ctx: CliContext) => Promise<void> | void;

// --- flag helpers (shared by frameworks select / solve / cir) ---

export function numFlagAt(args: string[], name: string): number | undefined {
  const i = args.indexOf(name);
  const value = i >= 0 ? args[i + 1] : undefined;
  return value === undefined ? undefined : Number.parseFloat(value);
}

export function boolFlagAt(args: string[], name: string): boolean | undefined {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] !== 'false' : undefined;
}

export function strFlagAt(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export function listFlagAt(args: string[], name: string, sep: string): string[] | undefined {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  return (args[i + 1] ?? '')
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function numListFlagAt(args: string[], name: string): number[] | undefined {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  return (args[i + 1] ?? '')
    .split(',')
    .map((s) => Number.parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n));
}

export function scoresFlagAt(args: string[]): number[][] | undefined {
  const i = args.indexOf('--scores');
  if (i < 0) return undefined;
  return (args[i + 1] ?? '')
    .split(';')
    .map((row) =>
      row
        .split(',')
        .map((s) => Number.parseFloat(s.trim()))
        .filter((n) => Number.isFinite(n)),
    )
    .filter((row) => row.length > 0);
}
