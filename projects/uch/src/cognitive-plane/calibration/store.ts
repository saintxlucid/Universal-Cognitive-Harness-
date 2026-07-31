/**
 * CalibrationStore — JSON-file persistence for the takes fence and its
 * derived calibration profile. Keeps the takes record across sessions
 * without a database dependency.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { TakeFence, type Take } from './takes.js';
import { computeCalibrationProfile, type CalibrationProfile, type CalibrationOptions } from './calibration.js';

export class CalibrationStore {
  private fence: TakeFence;

  constructor(private readonly filePath = '.uccp/calibration/takes.json') {
    this.fence = new TakeFence();
  }

  get takes(): TakeFence {
    return this.fence;
  }

  async load(): Promise<void> {
    const raw = await fs.readFile(this.filePath, 'utf-8').catch(() => null);
    if (raw === null) return;
    try {
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as { takes: Take[] };
      this.fence = new TakeFence(Array.isArray(parsed.takes) ? parsed.takes : []);
    } catch {
      // Corrupt state file: start clean rather than crash the harness.
      this.fence = new TakeFence();
    }
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify({ takes: this.fence.toJSON() }, null, 2), 'utf-8');
  }

  async addTake(input: Parameters<TakeFence['add']>[0]): Promise<Take> {
    const take = this.fence.add(input);
    await this.save();
    return take;
  }

  async resolveTake(id: string, input: Parameters<TakeFence['resolve']>[1]): Promise<Take> {
    const take = this.fence.resolve(id, input);
    await this.save();
    return take;
  }

  profile(options?: CalibrationOptions): CalibrationProfile {
    return computeCalibrationProfile(this.fence.all, options);
  }
}
