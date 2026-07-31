export interface WebhookConfig {
  url: string;
  secret?: string;
  events: string[];
  retryCount?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  enabled?: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhookUrl: string;
  event: string;
  payload: unknown;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastAttempt: number | null;
  error: string | null;
}

export class WebhookDispatcher {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveries: WebhookDelivery[] = [];
  private maxDeliveries = 10000;

  register(id: string, config: WebhookConfig): void {
    this.webhooks.set(id, {
      ...config,
      enabled: config.enabled ?? true,
      retryCount: config.retryCount ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      timeoutMs: config.timeoutMs ?? 5000,
    });
  }

  unregister(id: string): void {
    this.webhooks.delete(id);
  }

  getWebhooks(): WebhookConfig[] {
    return [...this.webhooks.values()];
  }

  getStats(): { webhooks: number; totalDeliveries: number; successRate: number } {
    const total = this.deliveries.length;
    const succeeded = this.deliveries.filter((d) => d.status === 'delivered').length;
    return {
      webhooks: this.webhooks.size,
      totalDeliveries: total,
      successRate: total > 0 ? succeeded / total : 1,
    };
  }

  async dispatch(event: string, payload: unknown): Promise<WebhookDelivery[]> {
    const results: WebhookDelivery[] = [];
    const matching = [...this.webhooks.values()].filter(
      (w) => w.enabled !== false && (w.events.includes('*') || w.events.includes(event)),
    );

    for (const wh of matching) {
      const delivery = await this.sendWithRetry(wh, event, payload);
      results.push(delivery);
      this.deliveries.push(delivery);
    }

    if (this.deliveries.length > this.maxDeliveries) {
      this.deliveries = this.deliveries.slice(-this.maxDeliveries);
    }

    return results;
  }

  private async sendWithRetry(wh: WebhookConfig, event: string, payload: unknown): Promise<WebhookDelivery> {
    const delivery: WebhookDelivery = {
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      webhookUrl: wh.url, event, payload,
      status: 'pending', attempts: 0, lastAttempt: null, error: null,
    };

    for (let attempt = 0; attempt < wh.retryCount!; attempt++) {
      delivery.attempts++;
      delivery.lastAttempt = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), wh.timeoutMs);
        const body = wh.secret
          ? { event, payload, signature: await this.sign(payload, wh.secret) }
          : { event, payload };

        const response = await fetch(wh.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'UCH-Webhook/1.0' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          delivery.status = 'delivered';
          return delivery;
        }
        delivery.error = `HTTP ${response.status}`;
      } catch (err) {
        delivery.error = err instanceof Error ? err.message : String(err);
      }

      if (attempt < wh.retryCount! - 1) {
        await new Promise(r => setTimeout(r, wh.retryDelayMs! * Math.pow(2, attempt)));
      }
    }

    delivery.status = 'failed';
    return delivery;
  }

  private async sign(payload: unknown, secret: string): Promise<string> {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  getDeliveries(event?: string): WebhookDelivery[] {
    if (event) return this.deliveries.filter(d => d.event === event);
    return [...this.deliveries];
  }

  getFailedDeliveries(): WebhookDelivery[] {
    return this.deliveries.filter(d => d.status === 'failed');
  }

  storeNames(): string[] {
    return [...this.webhooks.keys()];
  }

  async persist(filePath: string): Promise<void> {
    const { writeSnapshot } = await import('../../cognitive-plane/persistence/persistence-engine.js');
    writeSnapshot(filePath, {
      webhooks: Object.fromEntries(this.webhooks),
      deliveries: this.deliveries,
      maxDeliveries: this.maxDeliveries,
    });
  }

  async load(filePath: string): Promise<number> {
    const { readSnapshot } = await import('../../cognitive-plane/persistence/persistence-engine.js');
    const data = readSnapshot<{ webhooks: Record<string, WebhookConfig>; deliveries: WebhookDelivery[]; maxDeliveries: number }>(filePath);
    if (!data) return 0;
    this.webhooks = new Map(Object.entries(data.webhooks));
    this.deliveries = data.deliveries;
    this.maxDeliveries = data.maxDeliveries;
    return this.webhooks.size;
  }
}
