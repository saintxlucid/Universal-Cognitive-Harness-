import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { CognitiveExoskeleton, ExoskeletonTransport } from '../exoskeleton/exoskeleton.js';

export interface IPCMessage {
  id: string;
  type: 'request' | 'response' | 'event' | 'notification';
  method?: string;
  payload?: unknown;
  error?: string;
  timestamp: number;
}

export interface IPCTransportConfig {
  socketPath: string;
  port: number;
  host: string;
  maxBufferSize: number;
  reconnectIntervalMs: number;
}

const isWindows = process.platform === 'win32';

export class IPCTransport extends EventEmitter implements ExoskeletonTransport {
  name = 'ipc';
  private exoskeleton: CognitiveExoskeleton | null = null;
  private config: Required<IPCTransportConfig>;
  private server: net.Server | null = null;
  private client: net.Socket | null = null;
  private connections: Set<net.Socket> = new Set();
  private buffer: Buffer[] = [];
  private bufferSize = 0;
  private reconnecting = false;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private handlers: Map<string, (msg: IPCMessage) => Promise<unknown>> = new Map();

  constructor(config?: Partial<IPCTransportConfig>) {
    super();
    this.config = {
      socketPath: config?.socketPath ?? path.join(process.cwd(), '.uccp', 'ipc.sock'),
      port: config?.port ?? 0,
      host: config?.host ?? (isWindows ? '127.0.0.1' : 'localhost'),
      maxBufferSize: config?.maxBufferSize ?? 1024 * 1024,
      reconnectIntervalMs: config?.reconnectIntervalMs ?? 2000,
    };
  }

  attach(exoskeleton: CognitiveExoskeleton): void {
    this.exoskeleton = exoskeleton;
  }

  detach(): void {
    this.stop();
    this.exoskeleton = null;
  }

  registerHandler(method: string, handler: (msg: IPCMessage) => Promise<unknown>): void {
    this.handlers.set(method, handler);
  }

  start(): void {
    if (isWindows) {
      this.startTcp();
    } else {
      this.startUnixSocket();
    }
  }

  private startUnixSocket(): void {
    const dir = path.dirname(this.config.socketPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.config.socketPath)) {
      try { fs.unlinkSync(this.config.socketPath); } catch { /* stale socket: ignore */ }
    }

    this.server = this.createServer();
    this.server.on('error', () => {});
    try {
      this.server.listen(this.config.socketPath);
    } catch { /* listen may fail; client reconnect handles it */ }
  }

  private startTcp(): void {
    this.server = this.createServer();
    this.server.on('error', () => {});
    try {
      this.server.listen(this.config.port, this.config.host);
    } catch { /* listen may fail; client reconnect handles it */ }
  }

  private createServer(): net.Server {
    return net.createServer((socket) => {
      this.connections.add(socket);
      let dataBuffer = '';

      socket.on('data', (chunk: Buffer) => {
        dataBuffer += chunk.toString();
        const messages = dataBuffer.split('\n');
        dataBuffer = messages.pop() ?? '';

        for (const raw of messages) {
          if (!raw.trim()) continue;
          try {
            const msg = JSON.parse(raw) as IPCMessage;
            this.handleMessage(socket, msg);
          } catch { /* malformed frame: skip */ }
        }
      });

      socket.on('close', () => {
        this.connections.delete(socket);
      });

      socket.on('error', () => {
        this.connections.delete(socket);
      });
    });
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    if (this.client) {
      this.client.destroy();
      this.client = null;
    }

    if (!isWindows && fs.existsSync(this.config.socketPath)) {
      try { fs.unlinkSync(this.config.socketPath); } catch { /* stale socket: ignore */ }
    }
  }

  status(): Record<string, unknown> {
    return {
      socketPath: this.config.socketPath,
      connections: this.connections.size,
      serverRunning: this.server !== null,
      clientConnected: this.client !== null && !this.client.destroyed,
      bufferBytes: this.bufferSize,
      registeredHandlers: this.handlers.size,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client && !this.client.destroyed) {
        resolve();
        return;
      }

      const client = new net.Socket();

      client.once('connect', () => {
        this.client = client;
        this.reconnecting = false;
        resolve();
      });

      client.once('error', (err) => {
        client.destroy();
        if (!this.reconnecting) {
          this.reconnecting = true;
          this.scheduleReconnect();
        }
        reject(err);
      });

      client.on('data', (chunk: Buffer) => {
        this.buffer.push(chunk);
        this.bufferSize += chunk.length;
        if (this.bufferSize > this.config.maxBufferSize) {
          const removed = this.buffer.shift();
          if (removed) this.bufferSize -= removed.length;
        }
        this.processIncoming(chunk.toString());
      });

      client.on('close', () => {
        if (!this.reconnecting) {
          this.reconnecting = true;
          this.scheduleReconnect();
        }
      });

      if (isWindows) {
        client.connect(this.config.port, this.config.host);
      } else {
        client.connect(this.config.socketPath);
      }
    });
  }

  async send(msg: IPCMessage): Promise<void> {
    const data = JSON.stringify(msg) + '\n';
    if (this.client && !this.client.destroyed) {
      this.client.write(data);
      return;
    }
    for (const socket of this.connections) {
      socket.write(data);
    }
  }

  async request(method: string, payload?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const msg: IPCMessage = {
        id,
        type: 'request',
        method,
        payload,
        timestamp: Date.now(),
      };

      const handler = (response: IPCMessage) => {
        if (response.id === id) {
          this.removeListener('response', handler);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.payload);
          }
        }
      };

      this.on('response', handler);

      setTimeout(() => {
        this.removeListener('response', handler);
        reject(new Error(`IPC request ${method} timed out`));
      }, 10000);

      this.send(msg);
    });
  }

  private async handleMessage(socket: net.Socket, msg: IPCMessage): Promise<void> {
    if (msg.type === 'request') {
      const handler = this.handlers.get(msg.method ?? '');
      try {
        const result = handler ? await handler(msg) : null;
        const response: IPCMessage = {
          id: msg.id,
          type: 'response',
          method: msg.method,
          payload: result,
          timestamp: Date.now(),
        };
        socket.write(JSON.stringify(response) + '\n');
      } catch (err) {
        const response: IPCMessage = {
          id: msg.id,
          type: 'response',
          method: msg.method,
          error: String(err),
          timestamp: Date.now(),
        };
        socket.write(JSON.stringify(response) + '\n');
      }
    }

    if (msg.type === 'response') {
      this.emit('response', msg);
    }

    if (msg.type === 'notification' || msg.type === 'event') {
      this.emit('message', msg);
    }
  }

  private processIncoming(chunk: string): void {
    const messages = chunk.split('\n');
    for (const raw of messages) {
      if (!raw.trim()) continue;
      try {
        const msg = JSON.parse(raw) as IPCMessage;
        if (msg.type === 'response') {
          this.emit('response', msg);
        } else {
          this.emit('message', msg);
        }
      } catch { /* malformed frame: skip */ }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(async () => {
      try {
        await this.connect();
        if (this.reconnectTimer) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      } catch { /* reconnect will retry */ }
    }, this.config.reconnectIntervalMs);
  }

  getStats(): Record<string, unknown> {
    return {
      socketPath: this.config.socketPath,
      connections: this.connections.size,
      bufferBytes: this.bufferSize,
      handlers: this.handlers.size,
      reconnecting: this.reconnecting,
    };
  }
}
