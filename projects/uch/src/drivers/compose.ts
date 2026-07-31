// ─── Driver composition ──────────────────────────────────────────────────────
// Sensors read, effectors act, the composed driver wires them into the
// registry contract. Drivers become small; sensors and effectors become
// reusable across hosts (a git sensor is written once and composed into every
// driver whose host exposes git).

import type { Driver, DriverEvent } from './registry.js';
import type { Sensor, SensorObservation } from './sensors/sensor.js';
import type { Effector } from './effectors/effector.js';

export interface ComposeDriverConfig {
  id: string;
  name: string;
  sensors?: Sensor[];
  effectors?: Effector[];
  onObservation?: (observation: SensorObservation) => void | Promise<void>;
}

export function composeDriver(config: ComposeDriverConfig): Driver {
  const { id, name, sensors = [], effectors = [], onObservation } = config;

  const start = async (): Promise<void> => {
    for (const sensor of sensors) {
      await sensor.start?.();
    }
    if (!onObservation) return;
    for (const sensor of sensors) {
      const observations = await sensor.observe();
      for (const observation of observations) {
        await onObservation(observation);
      }
    }
  };

  const stop = async (): Promise<void> => {
    for (const sensor of [...sensors].reverse()) {
      await sensor.stop?.();
    }
  };

  const handleEvent = async (event: DriverEvent): Promise<void> => {
    for (const effector of effectors) {
      if (!effector.reactsTo.includes(event.type)) continue;
      try {
        const followUps = await effector.apply(event);
        if (!onObservation || followUps.length === 0) continue;
        for (const followUp of followUps) {
          await onObservation({
            source: effector.id,
            type: followUp.type,
            payload: followUp.payload,
            timestamp: new Date(),
          });
        }
      } catch {
        // Effector failures are isolated: one broken effector must not
        // block the event fan-out to the rest of the driver.
      }
    }
  };

  return { id, name, start, stop, handleEvent };
}
