export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  openedAt: Date | null;
  halfOpenAttempts: number;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
  totalTimeouts: number;
  totalShortCircuits: number;
}

export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private openedAt: Date | null = null;
  private halfOpenAttempts = 0;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private totalTimeouts = 0;
  private totalShortCircuits = 0;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      successThreshold: config?.successThreshold ?? 2,
      resetTimeoutMs: config?.resetTimeoutMs ?? 30000,
      halfOpenMaxCalls: config?.halfOpenMaxCalls ?? 1,
    };
  }

  async call<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    this.totalCalls++;

    if (this.state === 'open') {
      const elapsed = Date.now() - (this.openedAt?.getTime() ?? Date.now());
      if (elapsed >= this.config.resetTimeoutMs) {
        this.transitionTo('half-open');
      } else {
        this.totalShortCircuits++;
        throw new CircuitBreakerOpenError(
          `Circuit breaker is open (opened ${this.openedAt?.toISOString()})`,
        );
      }
    }

    if (this.state === 'half-open' && this.halfOpenAttempts >= this.config.halfOpenMaxCalls) {
      this.totalShortCircuits++;
      throw new CircuitBreakerOpenError(
        'Circuit breaker is half-open and at max probe capacity',
      );
    }

    if (this.state === 'half-open') {
      this.halfOpenAttempts++;
    }

    try {
      let result: T;
      if (timeoutMs !== undefined) {
        result = await this.executeWithTimeout(fn, timeoutMs);
      } else {
        result = await fn();
      }
      this.onSuccess();
      return result;
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) throw err;
      this.onFailure();
      throw err;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.totalTimeouts++;
        reject(new CircuitBreakerTimeoutError(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn().then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccess = new Date();
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  private onFailure(): void {
    this.totalFailures++;
    this.lastFailure = new Date();

    if (this.state === 'half-open') {
      this.transitionTo('open');
      return;
    }

    this.failureCount++;
    if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    if (newState === 'open') {
      this.openedAt = new Date();
      this.failureCount = this.config.failureThreshold;
      this.halfOpenAttempts = 0;
    } else if (newState === 'half-open') {
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    } else if (newState === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
      this.openedAt = null;
      this.halfOpenAttempts = 0;
    }
  }

  forceOpen(): void {
    this.transitionTo('open');
  }

  forceClose(): void {
    this.transitionTo('closed');
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
      halfOpenAttempts: this.halfOpenAttempts,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      totalTimeouts: this.totalTimeouts,
      totalShortCircuits: this.totalShortCircuits,
    };
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreakerTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerTimeoutError';
  }
}
