import { createServer, IncomingMessage, Server } from 'node:http';
import { createHash } from 'node:crypto';
import type { Socket } from 'node:net';

type WSEvent = 'message' | 'close' | 'error' | 'connection';
type WSHandler = (data: unknown, ws: WebSocketConnection) => void;

interface WebSocketConnection {
  id: string;
  send(data: string): void;
  close(): void;
}

interface WSFrame {
  opcode: number;
  payload: Buffer;
}

const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** RFC 6455 §4.2.2: base64(SHA-1(sec-websocket-key + GUID)). */
function createAcceptKey(key: string): string {
  return createHash('sha1')
    .update(key + WS_MAGIC_GUID)
    .digest('base64');
}

function decodeWSFrame(buffer: Buffer): WSFrame {
  const first = buffer[0]!;
  const opcode = first & 0x0f;
  const second = buffer[1]!;
  const masked = (second & 0x80) !== 0;
  let payloadLength = second & 0x7f;
  let offset = 2;
  if (payloadLength === 126) { payloadLength = buffer.readUInt16BE(2); offset = 4; }
  else if (payloadLength === 127) { payloadLength = Number(buffer.readBigUInt64BE(2)); offset = 10; }
  const mask = masked ? buffer.subarray(offset, offset + 4) : null;
  if (mask) offset += 4;
  let payload = buffer.subarray(offset, offset + payloadLength);
  if (mask) {
    payload = Buffer.from(payload.map((byte, i) => byte ^ mask[i % 4]!));
  }
  return { opcode, payload };
}

export class WebSocketServer {
  private server: Server;
  private connections: Map<string, WebSocketConnection> = new Map();
  private handlers: Map<string, WSHandler[]> = new Map();
  private connCounter = 0;

  constructor(port: number) {
    this.server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ service: 'uch-websocket', connections: this.connections.size }));
    });

    this.server.on('upgrade', (req: IncomingMessage, socket: Socket) => {
      const key = req.headers['sec-websocket-key'] as string | undefined;
      if (!key) { socket.destroy(); return; }

      const acceptKey = createAcceptKey(key);
      const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        '',
      ].join('\r\n');
      socket.write(responseHeaders);

      this.attachConnection(req, socket);
    });

    this.server.listen(port, () => {
      console.log(`WebSocket server listening on port ${port}`);
    });
  }

  private attachConnection(_req: IncomingMessage, socket: Socket): void {
    const connId = `ws-${++this.connCounter}-${Date.now()}`;
    const conn: WebSocketConnection = {
      id: connId,
      send(data: string) {
        const payload = Buffer.from(data, 'utf-8');
        const frame = Buffer.alloc(2 + payload.length);
        frame[0] = 0x81;
        frame[1] = payload.length;
        payload.copy(frame, 2);
        socket.write(frame);
      },
      close() {
        const frame = Buffer.alloc(2);
        frame[0] = 0x88;
        frame[1] = 0x00;
        socket.write(frame);
        socket.end();
      },
    };

    this.connections.set(connId, conn);
    this.emit('connection', { id: connId }, conn);

    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const second = buffer[1]!;
        const maskLen = (second & 0x80) ? 4 : 0;
        let payloadLen = second & 0x7f;
        let headerLen = 2;
        if (payloadLen === 126) { headerLen = 4; if (buffer.length < 4) break; payloadLen = buffer.readUInt16BE(2); }
        else if (payloadLen === 127) { headerLen = 10; if (buffer.length < 10) break; payloadLen = Number(buffer.readBigUInt64BE(2)); }
        const totalLen = headerLen + maskLen + payloadLen;
        if (buffer.length < totalLen) break;

        const frame = decodeWSFrame(buffer.subarray(0, totalLen));
        buffer = buffer.subarray(totalLen);

        if (frame.opcode === 0x08) {
          this.connections.delete(connId);
          this.emit('close', { id: connId, code: payloadLen }, conn);
        } else if (frame.opcode === 0x01) {
          const text = frame.payload.toString('utf-8');
          try {
            this.emit('message', JSON.parse(text), conn);
          } catch {
            this.emit('message', text, conn);
          }
        }
      }
    });

    socket.on('error', (err: Error) => {
      this.emit('error', err, conn);
      this.connections.delete(connId);
    });

    socket.on('close', () => {
      this.connections.delete(connId);
    });
  }

  on(event: WSEvent, handler: WSHandler): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  private emit(event: WSEvent, data: unknown, conn: WebSocketConnection): void {
    const handlers = this.handlers.get(event) ?? [];
    for (const h of handlers) h(data, conn);
  }

  broadcast(data: unknown): void {
    const msg = JSON.stringify(data);
    for (const conn of this.connections.values()) {
      try { conn.send(msg); } catch { /* skip dead conns */ }
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      for (const conn of this.connections.values()) conn.close();
      this.connections.clear();
      this.server.close(() => resolve());
    });
  }
}
