import { writeSnapshot, readSnapshot, mapToRecord, recordToMap } from '../../cognitive-plane/persistence/persistence-engine.js';
import type { CognitiveSignal, SignalType } from '../../cognitive-plane/signals/signal-store.js';

export interface WebhookConfig {
  id: string;
  url: string;
  signalTypes: SignalType[];
  headers?: Record<string, string>;
  retryCount?: number;
  retryDelayMs?: number;
  enabled: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  signalId: string;
  url: string;
  status: 'pending' | 'success' | 'failed';
  statusCode?: number;
  attempts: number;
  error?: string;
  timestamp: Date;
}

export class WebhookDispatcher {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveries: WebhookDelivery[] = [];
  private maxDeliveries: number;

  constructor(maxDeliveries = 1000) {
    this.maxDeliveries = maxDeliveries;
  }

  register(config: WebhookConfig): void {
    this.webhooks.set(config.id, config);
  }

  unregister(id: string): boolean {
    return this.webhooks.delete(id);
  }

  getWebhooks(): WebhookConfig[] {
    return [...this.webhooks.values()];
  }

  async dispatch(signal: CognitiveSignal): Promise<WebhookDelivery[]> {
    const results: WebhookDelivery[] = [];
    const matching = [...this.webhooks.values()].filter(
      (w) => w.enabled && w.signalTypes.includes(signal.type),
    );

    for (const webhook of matching) {
      const delivery = await this.deliver(webhook, signal);
      results.push(delivery);
    }

    return results;
  }

  getDeliveries(limit = 50): WebhookDelivery[] {
    return this.deliveries.slice(-limit);
  }

  getStats(): { webhooks: number; totalDeliveries: number; successRate: number } {
    const total = this.deliveries.length;
    const succeeded = this.deliveries.filter((d) => d.status === 'success').length;
    return {
      webhooks: this.webhooks.size,
      totalDeliveries: total,
      successRate: total > 0 ? succeeded / total : 1,
    };
  }

  private async deliver(webhook: WebhookConfig, signal: CognitiveSignal): Promise<WebhookDelivery> {
    const id = crypto.randomUUID();
    const maxRetries = webhook.retryCount ?? 3;
    const delayMs = webhook.retryDelayMs ?? 1000;

    let lastError: string | undefined;
    let statusCode: number | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...webhook.headers,
          },
          body: JSON.stringify({
            event: 'cognitive_signal',
            id: signal.id,
            type: signal.type,
            source: signal.source,
            timestamp: signal.timestamp.toISOString(),
            importance: signal.importance,
            payload: signal.payload,
          }),
        });

        statusCode = response.status;

        const delivery: WebhookDelivery = {
          id,
          webhookId: webhook.id,
          signalId: signal.id,
          url: webhook.url,
          status: 'success',
          statusCode,
          attempts: attempt,
          timestamp: new Date(),
        };

        this.recordDelivery(delivery);
        return delivery;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        }
      }
    }

    const delivery: WebhookDelivery = {
      id,
      webhookId: webhook.id,
      signalId: signal.id,
      url: webhook.url,
      status: 'failed',
      statusCode,
      attempts: maxRetries,
      error: lastError,
      timestamp: new Date(),
    };

    this.recordDelivery(delivery);
    return delivery;
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      webhooks: mapToRecord(this.webhooks),
      deliveries: this.deliveries,
      maxDeliveries: this.maxDeliveries,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      webhooks: Record<string, WebhookConfig>;
      deliveries: WebhookDelivery[];
      maxDeliveries: number;
    }>(filePath);
    if (!data) return 0;

    if (data.maxDeliveries !== undefined) this.maxDeliveries = data.maxDeliveries;
    this.webhooks = recordToMap(data.webhooks ?? {});
    this.deliveries = data.deliveries ?? [];
    return this.webhooks.size;
  }

  private recordDelivery(delivery: WebhookDelivery): void {
    this.deliveries.push(delivery);
    if (this.deliveries.length > this.maxDeliveries) {
      this.deliveries.shift();
    }
  }
}
