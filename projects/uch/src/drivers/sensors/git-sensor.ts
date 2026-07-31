// ─── Git Sensor ──────────────────────────────────────────────────────────────
// Shared observation surface: workspace git state. Written once, composed
// into every driver whose host exposes a git working tree (IDE, terminal,
// agent runtimes...).

import type { Sensor, SensorObservation } from './sensor.js';
import { GitDriver, type GitDriverConfig, type GitStatusEntry } from '../git/git-driver.js';

export class GitSensor implements Sensor {
  readonly id = 'git-sensor';
  readonly surfaces = ['git'];

  private git: GitDriver;

  constructor(config?: GitDriverConfig) {
    this.git = new GitDriver(undefined as never, config);
  }

  observe(): SensorObservation[] {
    const status = this.git.getStatus();
    return [
      {
        source: 'git-sensor',
        type: 'git.state',
        payload: {
          branch: this.git.getBranch(),
          hash: this.git.getCurrentHash(),
          changes: status.map((entry: GitStatusEntry) => `${entry.status}:${entry.path}`),
          change_count: status.length,
        },
        timestamp: new Date(),
      },
    ];
  }
}
