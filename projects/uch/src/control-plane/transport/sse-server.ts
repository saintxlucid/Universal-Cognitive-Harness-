import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { MCPSSETransport } from './mcp-sse.js';

export interface SSESession {
  id: string;
  clientId: string;
  createdAt: Date;
  lastActivity: Date;
  metadata: Record<string, unknown>;
  status: 'active' | 'idle' | 'closed';
  messageQueue: string[];
}

export interface SSEServerOptions {
  heartbeatIntervalMs?: number;
  sessionTimeoutMs?: number;
  maxMessageQueue?: number;
}

export class SSEServer {
  private sessions = new Map<string, SSESession>();
  private mcpSse: MCPSSETransport;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private httpServer: http.Server | null = null;
  private options: Required<SSEServerOptions>;

  constructor(mcpSse: MCPSSETransport, options?: SSEServerOptions) {
    this.mcpSse = mcpSse;
    this.options = {
      heartbeatIntervalMs: options?.heartbeatIntervalMs ?? 15000,
      sessionTimeoutMs: options?.sessionTimeoutMs ?? 300000,
      maxMessageQueue: options?.maxMessageQueue ?? 100,
    };
  }

  attach(server: http.Server): void {
    this.httpServer = server;
    this.startTimers();
  }

  handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
    const rawId = `${req.socket.remoteAddress ?? 'unknown'}-${Date.now()}-${crypto.randomUUID()}`;
    const clientId = crypto.createHash('sha256').update(rawId).digest('hex').slice(0, 16);
    const session: SSESession = {
      id: crypto.randomUUID(), clientId,
      createdAt: new Date(), lastActivity: new Date(),
      metadata: { remoteAddress: req.socket.remoteAddress, userAgent: req.headers['user-agent'] },
      status: 'active', messageQueue: [],
    };
    this.sessions.set(session.id, session);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`event: endpoint\ndata: /messages?clientId=${clientId}\n\n`);
    res.write(`event: session-created\ndata: ${JSON.stringify({ sessionId: session.id, clientId })}\n\n`);

    this.mcpSse.handleSSEConnection(clientId, (data: string) => {
      if (session.status !== 'closed') {
        res.write(data);
      }
    });

    const heartbeat = setInterval(() => {
      if (session.status === 'closed') { clearInterval(heartbeat); return; }
      res.write(': heartbeat\n\n');
      session.lastActivity = new Date();
    }, this.options.heartbeatIntervalMs);

    req.on('close', () => {
      session.status = 'closed';
      clearInterval(heartbeat);
      this.mcpSse.closeConnection(clientId);
      setTimeout(() => this.sessions.delete(session.id), 5000);
    });
  }

  async handleMessage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const clientId = url.searchParams.get('clientId');
    if (!clientId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing clientId query parameter' }));
      return;
    }

    const session = [...this.sessions.values()].find((s) => s.clientId === clientId);
    if (session) {
      session.lastActivity = new Date();
      session.status = 'active';
    }

    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });

    try {
      await new Promise<void>((resolve, reject) => {
        req.on('end', resolve);
        req.on('error', reject);
      });
    } catch {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Request error' }));
      return;
    }

    if (!body) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Empty request body' }));
      return;
    }

    const result = await this.mcpSse.handleMessage(clientId, body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(result);
  }

  getSession(sessionId: string): SSESession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByClientId(clientId: string): SSESession | undefined {
    return [...this.sessions.values()].find((s) => s.clientId === clientId);
  }

  listSessions(): SSESession[] {
    return [...this.sessions.values()];
  }

  getActiveCount(): number {
    return [...this.sessions.values()].filter((s) => s.status === 'active').length;
  }

  getTotalSessions(): number {
    return this.sessions.size;
  }

  startTimers(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      for (const session of this.sessions.values()) {
        if (session.status === 'closed') continue;
        const elapsed = Date.now() - session.lastActivity.getTime();
        if (elapsed > this.options.sessionTimeoutMs) {
          session.status = 'idle';
        }
      }
    }, this.options.heartbeatIntervalMs);

    this.cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - this.options.sessionTimeoutMs * 2;
      for (const [id, session] of this.sessions) {
        if (session.createdAt.getTime() < cutoff && session.status === 'closed') {
          this.sessions.delete(id);
        }
      }
    }, 60000);
  }

  stopTimers(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.cleanupTimer) { clearInterval(this.cleanupTimer); this.cleanupTimer = null; }
  }

  getStats(): Record<string, unknown> {
    return {
      totalSessions: this.sessions.size,
      activeSessions: this.getActiveCount(),
      sessions: [...this.sessions.values()].map((s) => ({
        id: s.id, clientId: s.clientId, status: s.status,
        createdAt: s.createdAt, lastActivity: s.lastActivity,
        messageQueueLength: s.messageQueue.length,
      })),
    };
  }
}
