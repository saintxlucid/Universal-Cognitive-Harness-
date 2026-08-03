import type { InferenceFabric, CognitiveScheduler } from '../../accelerators/index.js';
import type { ScientificMemory } from '../../cognitive-plane/memory/scientific-memory.js';
import type { CognitiveConstitution } from '../../cognitive-plane/constitution/constitution.js';
import type { FrameworkTraceRecorder } from '../../cognitive-plane/frameworks/tracing/trace-recorder.js';
import type { FrameworkDecisionJournal } from '../../cognitive-plane/frameworks/journal/decision-journal.js';
import type { PackageStore } from '../../control-plane/packages/index.js';
import type { Embedder } from '../../embeddings/embedder.js';
import type { BiologicalFunctions } from '../../harness-api/biological-functions.js';
import type { CognitiveKernel } from '../../kernel/cognitive-kernel.js';
import type { LLMClient } from '../../llm/provider.js';
import type { CPServer } from '../../protocol/index.js';
import type { SessionManager } from '../../session/manager.js';
import type { GitIngester } from '../../git/ingester.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export type ToolRegistrar = (
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  handler: (args: Record<string, unknown>) => Promise<unknown>,
) => void;

/** Dependencies shared by every MCP tool registration block. */
export interface MCPToolContext {
  kernel: CognitiveKernel;
  bio: BiologicalFunctions;
  embedder: Embedder;
  sessionManager: SessionManager;
  gitIngester: GitIngester;
  scientificMemory: ScientificMemory;
  constitution: CognitiveConstitution;
  fabric: InferenceFabric;
  scheduler: CognitiveScheduler;
  llm: LLMClient;
  protocol: CPServer;
  frameworkTracer: FrameworkTraceRecorder;
  frameworkJournal: FrameworkDecisionJournal;
  getPackageStore: () => Promise<PackageStore>;
  persistPackageStore: (store: PackageStore) => Promise<void>;
}
