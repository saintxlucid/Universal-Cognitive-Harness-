import * as http from 'node:http';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { TraceRecorder } from '../cognitive-plane/trace-engine/trace-recorder.js';
import { CognitiveReplay } from '../cognitive-plane/replay/cognitive-replay.js';
import { TracePersistence } from '../cognitive-plane/persistence/trace-persistence.js';
import { SignalStore } from '../cognitive-plane/signals/signal-store.js';
import { Auth } from '../control-plane/auth/auth.js';
import { SecretsStore } from '../control-plane/secrets/secrets-store.js';
import { PolicyEngine } from '../control-plane/policies.js';
import { BudgetTracker } from '../control-plane/budgets/budgets.js';
import { OTLPExporter, traceToSpan } from '../control-plane/telemetry/otlp-exporter.js';
import { Lifecycle } from '../control-plane/lifecycle.js';
import { MCPSSETransport } from '../control-plane/transport/mcp-sse.js';
import { PluginLoader } from '../control-plane/plugins/plugin-loader.js';
import { ConfigLoader } from '../control-plane/config/config-loader.js';
import { FileSystemDriver } from '../drivers/filesystem/filesystem-driver.js';
import { GitDriver } from '../drivers/git/git-driver.js';
import { UniversalCognitiveHarness } from '../harness-api/universal-harness.js';
import { CodeScorer, type FileProfile } from '../suit/litmus/code-scorer.js';
import { ReflexEngine, type ReflexContext } from '../suit/instinct/reflex-engine.js';
import { AetherCore } from '../aether/aether-core.js';
import type { ConsciousnessLayer } from '../aether/consciousness.js';
import { PersistentStore } from '../kernel/storage/persistent-store.js';
import { A2ATransport } from '../interface/a2a-transport.js';
import { IPCTransport } from '../interface/ipc-transport.js';
import { CLITransport } from '../interface/cli-transport.js';
import { CircuitBreaker } from '../kernel/cic/circuit-breaker.js';
import { ThreatMitigationEngine } from '../kernel/cic/threat-mitigations.js';
import { ImmuneSystem } from '../exoskeleton/immune.js';
import { CortexKernel } from '../cortex_kernel/integrator.js';
import { AttentionCortex } from '../cortex_kernel/attention-cortex.js';
import { UnderstandingCortex } from '../cortex_kernel/understanding-cortex.js';
import { ExecutiveCortex } from '../cortex_kernel/executive-cortex.js';
import { MetaBrain } from '../cortex_kernel/meta-brain.js';
import { CPServer, createDefaultCPServer, handleCPHTTP, cpRouteInfo } from '../protocol/index.js';

export interface UCCPOptions {
  workspaceId: string;
  workspaceName: string;
  workspaceRoot: string;
  httpPort?: number;
  configPath?: string;
  traceFile?: string;
  apiKey?: string;
}

export class UCCPServer {
  private options: Required<UCCPOptions>;
  private eventBus: NeuralEventBus;
  private kernel: CognitiveKernel;
  private workspace: WorkspaceBrain;
  private executive: ExecutiveBrain;
  private bio: BiologicalFunctions;
  private harness: UniversalCognitiveHarness;
  private traceRecorder: TraceRecorder;
  private replay: CognitiveReplay;
  private signals: SignalStore;
  private auth: Auth;
  private secrets: SecretsStore;
  private policies: PolicyEngine;
  private budgets: BudgetTracker;
  private otlp: OTLPExporter;
  private mcpSse: MCPSSETransport;
  private persistence: TracePersistence;
  private lifecycle: Lifecycle;
  private plugins: PluginLoader;
  private codeScorer: CodeScorer;
  private reflexEngine: ReflexEngine;
  private aether: AetherCore;
  private httpServer: http.Server | null = null;
  private fsDriver: FileSystemDriver;
  private gitDriver: GitDriver;
  private persistentStore: PersistentStore;
  private circuitBreaker: CircuitBreaker;
  private threatEngine: ThreatMitigationEngine;
  private a2aTransport: A2ATransport;
  private ipcTransport: IPCTransport;
  private cliTransport: CLITransport;
  private immuneSystem: ImmuneSystem;
  private cortexKernel: CortexKernel;
  private attentionCortex: AttentionCortex;
  private understandingCortex: UnderstandingCortex;
  private executiveCortex: ExecutiveCortex;
  private metaBrain: MetaBrain;
  private protocol: CPServer;

  constructor(options: UCCPOptions) {
    this.options = {
      workspaceId: options.workspaceId,
      workspaceName: options.workspaceName,
      workspaceRoot: options.workspaceRoot,
      httpPort: options.httpPort ?? 3100,
      configPath: options.configPath ?? 'uccp.config.json',
      traceFile: options.traceFile ?? '.uccp/traces.jsonl',
      apiKey: options.apiKey ?? 'dev-key',
    };

    this.eventBus = new NeuralEventBus();
    this.aether = new AetherCore(this.eventBus, { tickIntervalMs: 5000 });
    this.kernel = new CognitiveKernel({
      agent_id: 'uccp',
      user_id: 'system',
      project_id: this.options.workspaceId,
      persistence_path: `.uccp/persist`,
    });
    this.workspace = new WorkspaceBrain({
      workspace_id: this.options.workspaceId,
      name: this.options.workspaceName,
      root_path: this.options.workspaceRoot,
      eventBus: this.eventBus,
    });
    this.executive = new ExecutiveBrain({ eventBus: this.eventBus });
    this.bio = new BiologicalFunctions(this.kernel, this.workspace, this.executive);
    this.harness = new UniversalCognitiveHarness({
      workspace_id: this.options.workspaceId,
      workspace_name: this.options.workspaceName,
      workspace_root: this.options.workspaceRoot,
    });

    this.traceRecorder = new TraceRecorder(this.eventBus);
    this.replay = new CognitiveReplay(this.traceRecorder.ledger);
    this.signals = new SignalStore(this.traceRecorder.ledger);
    this.auth = new Auth();
    this.secrets = new SecretsStore();
    this.policies = new PolicyEngine();
    this.budgets = new BudgetTracker();
    this.otlp = new OTLPExporter();
    this.mcpSse = new MCPSSETransport(this.bio, this.kernel, this.eventBus);
    this.persistence = new TracePersistence(this.options.traceFile);
    this.lifecycle = new Lifecycle();
    this.plugins = new PluginLoader();
    this.codeScorer = new CodeScorer();
    this.reflexEngine = new ReflexEngine();
    this.fsDriver = new FileSystemDriver(this.eventBus, { rootPath: this.options.workspaceRoot });
    this.gitDriver = new GitDriver(this.eventBus, { repoPath: this.options.workspaceRoot });

    this.persistentStore = new PersistentStore(
      { basePath: `.uccp/persist` },
      this.kernel.getEpisodicStore(),
      this.kernel.getSemanticGraph(),
    );
    this.immuneSystem = new ImmuneSystem(this.policies, this.auth, this.reflexEngine);
    this.circuitBreaker = new CircuitBreaker();
    this.threatEngine = new ThreatMitigationEngine(this.immuneSystem, this.policies);
    this.a2aTransport = new A2ATransport({ agentId: 'uccp-server' });
    this.ipcTransport = new IPCTransport();
    this.cliTransport = new CLITransport();
    this.cortexKernel = new CortexKernel(
      this.aether.cons,
      this.kernel,
      this.executive,
      this.eventBus,
    );
    this.attentionCortex = this.cortexKernel.attention;
    this.understandingCortex = this.cortexKernel.understanding;
    this.executiveCortex = this.cortexKernel.executive;
    this.metaBrain = this.cortexKernel.metaBrain;
    this.protocol = createDefaultCPServer(this.kernel);

    this.registerServices();
    this.setupPolicies();
    this.registerAgent();
  }

  private registerServices(): void {
    this.lifecycle.register({
      name: 'trace-persistence',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        this.persistence.open();
        await this.persistence.loadInto(this.traceRecorder.ledger);
      },
      stop: async () => {
        this.persistence.close();
      },
    });
    this.lifecycle.register({
      name: 'otlp-exporter',
      version: '0.1.0',
      dependencies: ['trace-persistence'],
      start: async () => {
        this.otlp.start();
      },
      stop: async () => {
        this.otlp.stop();
      },
    });
    this.lifecycle.register({
      name: 'plugins',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        await this.plugins.loadAll();
        await this.plugins.initializeAll();
      },
      stop: async () => {
        await this.plugins.shutdownAll();
      },
    });
    this.lifecycle.register({
      name: 'filesystem-driver',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        this.fsDriver.start();
      },
      stop: async () => {
        this.fsDriver.stop();
      },
    });
    this.lifecycle.register({
      name: 'aether',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        this.aether.start();
      },
      stop: async () => {
        this.aether.stop();
      },
    });
    this.lifecycle.register({
      name: 'persistent-store',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        await this.kernel.init();
      },
      stop: async () => {
        await this.kernel.shutdown();
      },
    });
    this.lifecycle.register({
      name: 'threat-engine',
      version: '0.1.0',
      dependencies: ['aether'],
      start: async () => {
        this.threatEngine.start();
      },
      stop: async () => {
        this.threatEngine.stop();
      },
    });
    this.lifecycle.register({
      name: 'cortex-services',
      version: '0.1.0',
      dependencies: ['aether'],
      start: async () => {
        this.cortexKernel.startCortexServices();
      },
      stop: async () => {
        this.cortexKernel.stopCortexServices();
      },
    });
    this.lifecycle.register({
      name: 'a2a-transport',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        this.a2aTransport.start();
      },
      stop: async () => {
        this.a2aTransport.stop();
      },
    });
    this.lifecycle.register({
      name: 'ipc-transport',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        this.ipcTransport.start();
      },
      stop: async () => {
        this.ipcTransport.stop();
      },
    });
    this.lifecycle.register({
      name: 'cli-transport',
      version: '0.1.0',
      dependencies: [],
      start: async () => {
        this.cliTransport.start();
      },
      stop: async () => {
        this.cliTransport.stop();
      },
    });
  }

  private setupPolicies(): void {
    this.policies.addRule({
      id: 'allow-all',
      effect: 'allow',
      principals: ['*'],
      actions: ['*'],
      resources: ['*'],
      priority: 1,
    });
    this.policies.addRule({
      id: 'admin-only-secrets',
      effect: 'deny',
      principals: ['*'],
      actions: ['secrets:read'],
      resources: ['*'],
      priority: 10,
    });
    this.policies.addRule({
      id: 'admin-secrets-access',
      effect: 'allow',
      principals: ['admin'],
      actions: ['secrets:read'],
      resources: ['*'],
      priority: 20,
    });
  }

  private registerAgent(): void {
    this.auth.registerAgent('uccp-server', 'server', 'UCCP Server', ['*']);
    this.auth.registerAgent('dev-agent', 'agent', 'Development Agent', [
      'observe',
      'remember',
      'retrieve',
      'plan',
      'reflect',
      'learn',
      'critique',
    ]);
    // Register the configured apiKey so it can be used with POST /api/token
    this.auth.registerApiKey(this.options.apiKey, {
      agentId: 'admin',
      agentType: 'cli',
      name: 'CLI Admin',
      permissions: ['*'],
    });
  }

  async start(): Promise<void> {
    await this.harness.start();
    await this.lifecycle.startAll();
    this.startHttpServer();
    const recent = this.traceRecorder.ledger.getRecent(50);
    for (const trace of recent) {
      if (trace.end_timestamp) this.otlp.record(traceToSpan(trace));
    }

    this.eventBus.publish({
      type: 'session:started',
      source: 'uccp-server',
      payload: { workspace_id: this.options.workspaceId },
    });
    this.signals.record(
      'session:started',
      'uccp-server',
      { workspaceId: this.options.workspaceId },
      0.9,
    );

    console.log(`UCCP Server started on port ${this.options.httpPort}`);
    console.log(`  Workspace: ${this.options.workspaceName} (${this.options.workspaceId})`);
    console.log(`  Trace file: ${this.options.traceFile}`);
    console.log(`  API Key: ${this.options.apiKey}`);
  }

  getSuitStatus(): Record<string, unknown> {
    return {
      aether: {
        running: this.aether.getState().running,
        phase: this.aether.phase,
        ticksCompleted: this.aether.getState().ticksCompleted,
        consciousness: this.aether.getStats().consciousness,
        subsystems: this.aether.getState().subsystems,
      },
      litmus: {
        threshold: this.codeScorer['config'].threshold,
        weights: this.codeScorer['config'].weights,
        history: this.codeScorer.getHistory(5),
      },
      instinct: {
        reflex_count: this.reflexEngine.getReflexes().length,
        stats: this.reflexEngine.getStats(),
      },
    };
  }

  async stop(): Promise<void> {
    this.signals.record(
      'session:ended',
      'uccp-server',
      { workspaceId: this.options.workspaceId },
      0.9,
    );
    this.traceRecorder.closeSession();
    this.otlp.flush();

    if (this.httpServer) {
      await new Promise<void>((resolve) => this.httpServer?.close(() => resolve()));
      this.httpServer = null;
    }

    await this.lifecycle.stopAll();
    await this.harness.stop();
    console.log('UCCP Server stopped');
  }

  private startHttpServer(): void {
    this.httpServer = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;

      const readJsonBody = async (): Promise<Record<string, unknown> | null> => {
        return new Promise((resolve) => {
          let body = '';
          req.on('data', (chunk: string) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              resolve(body ? JSON.parse(body) : null);
            } catch {
              resolve(null);
            }
          });
        });
      };

      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            uptime: process.uptime(),
            traces: this.traceRecorder.ledger.count(),
          }),
        );
        return;
      }

      // OpenCode and other current MCP clients use Streamable HTTP. Keep the
      // legacy SSE endpoint below for backward compatibility, while exposing
      // the same UCH capabilities through a single JSON-RPC endpoint.
      if (pathname === '/mcp') {
        if (req.method !== 'POST') {
          res.writeHead(405, { Allow: 'POST' });
          res.end();
          return;
        }

        let body = '';
        req.on('data', (chunk: string) => {
          body += chunk;
        });
        req.on('end', async () => {
          let isNotification = false;
          try {
            const message = JSON.parse(body) as { id?: string | number };
            isNotification = !Object.prototype.hasOwnProperty.call(message, 'id');
          } catch {
            // The transport returns the MCP parse-error response.
          }

          const result = await this.mcpSse.handleMessage('streamable-http', body);
          if (isNotification) {
            res.writeHead(202);
            res.end();
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(result);
        });
        return;
      }

      if (pathname === '/sse' && req.method === 'GET') {
        const clientId = url.searchParams.get('clientId') ?? crypto.randomUUID();
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write('\n');

        this.mcpSse.handleSSEConnection(clientId, (data: string) => {
          res.write(data);
        });

        req.on('close', () => {
          this.mcpSse.closeConnection(clientId);
        });
        return;
      }

      if (pathname === '/messages' && req.method === 'POST') {
        const clientId = url.searchParams.get('clientId');
        if (!clientId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing clientId' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: string) => {
          body += chunk;
        });
        req.on('end', async () => {
          const result = await this.mcpSse.handleMessage(clientId, body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(result);
        });
        return;
      }

      if (pathname === '/cp/v1') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cpRouteInfo(this.protocol)));
        return;
      }

      if (pathname.startsWith('/cp/v1/')) {
        if (req.method !== 'POST') {
          res.writeHead(405, { Allow: 'POST' });
          res.end();
          return;
        }
        const op = pathname.slice('/cp/v1/'.length);
        const body = await readJsonBody();
        const response = await handleCPHTTP(this.protocol, { ...(body ?? {}), op });
        res.writeHead(response.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        return;
      }

      if (pathname === '/api/status') {
        const authHeader = req.headers['authorization'];
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '');
          const result = this.auth.verifyToken(token);
          if (!result.valid) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: result.error }));
            return;
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            workspace: { id: this.options.workspaceId, name: this.options.workspaceName },
            cognitive: { ...this.kernel.getStats(), traces: this.traceRecorder.ledger.count() },
            control: {
              agents: this.auth.getAgents().length,
              policies: this.policies.getAllRules().length,
              secrets: this.secrets.count(),
              plugins: this.plugins.count(),
            },
            suit: this.getSuitStatus(),
            signals: this.signals.getStats(),
          }),
        );
        return;
      }

      if (pathname === '/api/token' && req.method === 'POST') {
        const apiKey = req.headers['x-api-key'] as string;
        if (!apiKey) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Missing x-api-key header' }));
          return;
        }
        const result = this.auth.createToken(apiKey);
        if (result.error) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: result.error }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: result.token?.token, expiresAt: result.token?.expiresAt }));
        return;
      }

      if (pathname === '/api/suit/litmus' && req.method === 'POST') {
        const body = await readJsonBody();
        const profile = (body?.profile ?? body) as FileProfile | undefined;
        if (!profile || typeof profile.path !== 'string') {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing profile payload' }));
          return;
        }

        try {
          const result = this.codeScorer.score(profile);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(error) }));
        }
        return;
      }

      if (pathname === '/api/suit/instinct' && req.method === 'POST') {
        const body = await readJsonBody();
        const context = (body?.context ?? body) as ReflexContext | undefined;
        if (!context || typeof context.name !== 'string') {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing context payload' }));
          return;
        }

        try {
          const results = await this.reflexEngine.evaluate(context);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ results }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(error) }));
        }
        return;
      }

      if (pathname === '/api/aether') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.aether.getStats()));
        return;
      }

      if (pathname === '/api/aether/observe' && req.method === 'POST') {
        const body = await readJsonBody();
        if (!body || typeof body.content !== 'string') {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing content in body' }));
          return;
        }
        this.aether.observeThought(
          (body.layer as ConsciousnessLayer) ?? 'working',
          body.content,
          (body.source as string) ?? 'api',
          body.tags as string[] | undefined,
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ acknowledged: true }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    this.httpServer.listen(this.options.httpPort);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const workspaceRoot = process.cwd();
  const workspaceId =
    args.find((a) => a.startsWith('--workspace-id='))?.split('=')[1] ?? `ws-${Date.now()}`;
  const workspaceName =
    args.find((a) => a.startsWith('--workspace-name='))?.split('=')[1] ?? 'Default Workspace';
  const port = args.find((a) => a.startsWith('--port='))?.split('=')[1] ?? '3100';
  const configPath =
    args.find((a) => a.startsWith('--config='))?.split('=')[1] ?? 'uccp.config.json';
  const apiKey = args.find((a) => a.startsWith('--api-key='))?.split('=')[1] ?? 'dev-key';

  const configLoader = ConfigLoader.fromFile(configPath);
  configLoader.merge(ConfigLoader.fromEnv().get());

  const server = new UCCPServer({
    workspaceId,
    workspaceName,
    workspaceRoot,
    httpPort: parseInt(port),
    configPath,
    apiKey,
  });

  server.start().catch((err) => {
    console.error('Failed to start UCCP:', err);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}

if (process.argv[1]?.endsWith('uccp.ts') || process.argv[1]?.endsWith('uccp.js')) {
  main();
}
