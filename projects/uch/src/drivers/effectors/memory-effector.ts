// ─── Memory Effector ─────────────────────────────────────────────────────────
// Example effector: reacts to failure signals and emits a memory suggestion
// for the organism to index — the motor side of the observe/augment triad.

import type { DriverEvent } from '../registry.js';
import type { Effector } from './effector.js';

export class MemoryEffector implements Effector {
  readonly id = 'memory-effector';
  readonly reactsTo = ['error:occurred', 'verification:failed', 'test:failed'];

  apply(event: DriverEvent): DriverEvent[] {
    const message =
      typeof event.payload?.error === 'string'
        ? event.payload.error
        : typeof event.payload?.message === 'string'
          ? event.payload.message
          : event.type;

    return [
      {
        type: 'memory.suggested',
        source: this.id,
        payload: {
          from: event.type,
          suggestion: `failure signal from ${event.source}: ${message}`,
        },
      },
    ];
  }
}
