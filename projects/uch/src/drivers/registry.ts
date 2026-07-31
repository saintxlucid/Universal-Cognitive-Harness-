// ── Driver Registry ───────────────────────────────────────────────────
// The Cognitive OS never knows what "Cursor", "Claude Code", or "GPT-5.5"
// are — everything external enters through drivers. The registry is the
// plug-in point: new IDE, new model, new protocol → write a driver.
// ──────────────────────────────────────────────────────────────────────

export interface DriverEvent {
  type: string;
  source: string;
  payload?: Record<string, unknown>;
}

export interface Driver {
  readonly id: string;
  readonly name: string;
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
  handleEvent?(event: DriverEvent): Promise<void> | void;
}

export interface DriverRegistration {
  driver: Driver;
  started: boolean;
}

export class DriverRegistry {
  private drivers = new Map<string, DriverRegistration>();

  register(driver: Driver): void {
    if (this.drivers.has(driver.id)) {
      throw new Error(`Driver already registered: ${driver.id}`);
    }
    this.drivers.set(driver.id, { driver, started: false });
  }

  async unregister(id: string): Promise<boolean> {
    const registration = this.drivers.get(id);
    if (!registration) return false;
    if (registration.started) {
      await registration.driver.stop();
    }
    this.drivers.delete(id);
    return true;
  }

  get(id: string): Driver | undefined {
    return this.drivers.get(id)?.driver;
  }

  has(id: string): boolean {
    return this.drivers.has(id);
  }

  list(): Driver[] {
    return Array.from(this.drivers.values()).map((r) => r.driver);
  }

  count(): number {
    return this.drivers.size;
  }

  isStarted(id: string): boolean {
    return this.drivers.get(id)?.started ?? false;
  }

  async start(id: string): Promise<boolean> {
    const registration = this.drivers.get(id);
    if (!registration || registration.started) return false;
    await registration.driver.start();
    registration.started = true;
    return true;
  }

  async stop(id: string): Promise<boolean> {
    const registration = this.drivers.get(id);
    if (!registration || !registration.started) return false;
    await registration.driver.stop();
    registration.started = false;
    return true;
  }

  /** Starts every registered driver. Returns the ids started. */
  async startAll(): Promise<string[]> {
    const started: string[] = [];
    for (const [id, registration] of this.drivers) {
      if (registration.started) continue;
      await registration.driver.start();
      registration.started = true;
      started.push(id);
    }
    return started;
  }

  async stopAll(): Promise<void> {
    for (const registration of this.drivers.values()) {
      if (!registration.started) continue;
      await registration.driver.stop();
      registration.started = false;
    }
  }

  /** Fan an event out to every driver with a handleEvent implementation. */
  async dispatch(event: DriverEvent): Promise<Array<{ id: string; error?: string }>> {
    const failures: Array<{ id: string; error?: string }> = [];
    for (const [id, registration] of this.drivers) {
      if (!registration.driver.handleEvent) continue;
      try {
        await registration.driver.handleEvent(event);
      } catch (err) {
        failures.push({ id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return failures;
  }
}
