// ─── Session Sensor ──────────────────────────────────────────────────────────
// Shared observation surface: session lifecycle. Host-agnostic — the driver
// supplies a provider that reports the host's native session status, and the
// sensor normalizes it into the Episode-shaped lifecycle events of the
// Universal Cognitive Protocol (ADR-005 §2).

import type { Sensor, SensorObservation } from './sensor.js';

export interface SessionSnapshot {
  status: 'active' | 'idle' | 'ended';
  session_id?: string;
  host?: string;
}

export class SessionSensor implements Sensor {
  readonly id = 'session-sensor';
  readonly surfaces = ['session'];

  private provider: () => SessionSnapshot;
  private lastSeen: SessionSnapshot | null = null;

  constructor(provider: () => SessionSnapshot) {
    this.provider = provider;
  }

  observe(): SensorObservation[] {
    const current = this.provider();
    if (this.lastSeen && this.lastSeen.status === current.status) return [];

    const previous = this.lastSeen;
    this.lastSeen = current;

    return [
      {
        source: 'session-sensor',
        type: 'session.lifecycle',
        payload: {
          status: current.status,
          session_id: current.session_id ?? null,
          host: current.host ?? null,
          transitioned_from: previous?.status ?? null,
        },
        timestamp: new Date(),
      },
    ];
  }
}
