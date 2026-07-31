import * as http from 'node:http';
import type { CognitiveExoskeleton, ExoskeletonTransport } from '../exoskeleton/exoskeleton.js';
import { CognitiveAPI } from './cognitive-api.js';
import type { FileProfile } from '../suit/litmus/code-scorer.js';
import type { ReflexContext } from '../suit/instinct/reflex-engine.js';
import type { ConsciousnessLayer } from '../aether/consciousness.js';

export interface HTTPTransportConfig {
  port: number;
  host?: string;
}

export class HTTPTransport implements ExoskeletonTransport {
  name = 'http';
  private exoskeleton: CognitiveExoskeleton | null = null;
  private cognitiveAPI: CognitiveAPI;
  private httpServer: http.Server | null = null;
  private config: Required<HTTPTransportConfig>;

  constructor(config?: Partial<HTTPTransportConfig>) {
    this.config = {
      port: config?.port ?? 3100,
      host: config?.host ?? '0.0.0.0',
    };
    this.cognitiveAPI = new CognitiveAPI();
  }

  attach(exoskeleton: CognitiveExoskeleton): void {
    this.exoskeleton = exoskeleton;
    this.cognitiveAPI.attach(exoskeleton);
  }

  detach(): void {
    this.cognitiveAPI.detach();
    this.exoskeleton = null;
  }

  start(): void {
    if (this.httpServer) return;
    this.httpServer = http.createServer((req, res) => this.handleRequest(req, res));
    this.httpServer.listen(this.config.port, this.config.host);
  }

  stop(): void {
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
  }

  status(): Record<string, unknown> {
    return {
      running: this.httpServer !== null,
      port: this.config.port,
      host: this.config.host,
    };
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
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
    const exo = this.exoskeleton;
    if (!exo) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: 'Exoskeleton not attached' }));
      return;
    }

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
          traces: exo.traceRecorder.ledger.count(),
        }),
      );
      return;
    }

    if (pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(exo.getStats()));
      return;
    }

    if (pathname === '/api/v1/observe' && req.method === 'POST') {
      const body = await readJsonBody();
      if (!body || typeof body.content !== 'string') {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing content' }));
        return;
      }
      const result = await this.cognitiveAPI.observe(
        (body.layer as string) ?? 'working',
        body.content,
        (body.source as string) ?? 'api',
        body.tags as string[] | undefined,
      );
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/v1/recall' && req.method === 'POST') {
      const body = await readJsonBody();
      const query = (body?.query as string) ?? '';
      const limit = (body?.limit as number) ?? 10;
      const result = await this.cognitiveAPI.recall(query, limit);
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/v1/evaluate' && req.method === 'POST') {
      const body = await readJsonBody();
      const result = await this.cognitiveAPI.evaluate(body ?? {});
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/v1/plan' && req.method === 'POST') {
      const body = await readJsonBody();
      const goal = (body?.goal as string) ?? '';
      const result = await this.cognitiveAPI.plan(goal);
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/v1/reflect') {
      const result = await this.cognitiveAPI.reflect();
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
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
        const result = exo.codeScorer.score(profile);
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
        const results = await exo.reflexEngine.evaluate(context);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}
