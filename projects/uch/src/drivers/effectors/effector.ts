// ─── Effector contract ───────────────────────────────────────────────────────
// Effectors act. An effector reacts to a declared set of event types and may
// emit follow-up events (the "motor neuron" side of the observe/augment triad,
// ADR-005). Effectors never mutate other effectors' state; composition happens
// in the driver.

import type { DriverEvent } from '../registry.js';

export interface Effector {
  readonly id: string;
  readonly reactsTo: string[];
  apply(event: DriverEvent): DriverEvent[] | Promise<DriverEvent[]>;
}
