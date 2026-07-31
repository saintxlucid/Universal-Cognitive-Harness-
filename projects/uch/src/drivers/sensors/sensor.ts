// ─── Sensor contract ─────────────────────────────────────────────────────────
// Sensors read. One sensor per observation surface (git, session, terminal,
// MCP, diffs, approvals...). A driver composes the sensors its host actually
// exposes — never assumes privileged access everywhere (ADR-005 L0–L4 ladder).

export interface SensorObservation {
  source: string;
  type: string;
  payload?: Record<string, unknown>;
  timestamp: Date;
}

export interface Sensor {
  readonly id: string;
  readonly surfaces: string[];
  observe(): SensorObservation[] | Promise<SensorObservation[]>;
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
}
