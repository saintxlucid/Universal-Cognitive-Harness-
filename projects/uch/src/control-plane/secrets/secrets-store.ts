import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export interface SecretEntry {
  key: string;
  encryptedValue: string;
  iv: string;
  tag: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, string>;
}

export class SecretsStore {
  private secrets: Map<string, SecretEntry> = new Map();
  private encryptionKey: Buffer;
  private filePath: string | null = null;
  private loaded = false;

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey
      ? Buffer.from(encryptionKey.padEnd(KEY_LENGTH * 2, '0').slice(0, KEY_LENGTH * 2), 'hex')
      : crypto.randomBytes(KEY_LENGTH);
  }

  set(key: string, value: string, metadata?: Record<string, string>): void {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const now = new Date();
    const existing = this.secrets.get(key);

    this.secrets.set(key, {
      key,
      encryptedValue: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      metadata: metadata ?? {},
    });
  }

  get(key: string): string | null {
    const entry = this.secrets.get(key);
    if (!entry) return null;

    try {
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        this.encryptionKey,
        Buffer.from(entry.iv, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(entry.encryptedValue, 'hex')),
        decipher.final(),
      ]);
      return decrypted.toString('utf-8');
    } catch {
      return null;
    }
  }

  delete(key: string): boolean {
    return this.secrets.delete(key);
  }

  listKeys(): string[] {
    return [...this.secrets.keys()];
  }

  getMetadata(key: string): Record<string, string> | null {
    return this.secrets.get(key)?.metadata ?? null;
  }

  has(key: string): boolean {
    return this.secrets.has(key);
  }

  count(): number {
    return this.secrets.size;
  }

  async persist(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const data = {
      key: this.encryptionKey.toString('hex'),
      secrets: [...this.secrets.entries()].map(([, entry]) => entry),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    this.filePath = filePath;
  }

  async load(filePath: string): Promise<number> {
    if (!fs.existsSync(filePath)) return 0;

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (data.key) {
      this.encryptionKey = Buffer.from(data.key, 'hex');
    }

    let count = 0;
    if (data.secrets) {
      for (const entry of data.secrets as SecretEntry[]) {
        entry.createdAt = new Date(entry.createdAt);
        entry.updatedAt = new Date(entry.updatedAt);
        this.secrets.set(entry.key, entry);
        count++;
      }
    }

    this.filePath = filePath;
    return count;
  }

  clear(): void {
    this.secrets.clear();
  }
}
