import type { VersionedStore } from './versioned-store.js';

export type RestoreTarget = 'identity' | 'genome' | 'beliefs' | 'policies' | 'skills';

export interface OrganismRestoreReport {
  target: RestoreTarget;
  from: number;
  to: number;
  verified: boolean;
  reasons: string[];
  restoredAt: Date;
}

export interface RestoreOptions<T> {
  store: VersionedStore<T>;
  target: RestoreTarget;
  toVersion: number;
  validator?: (value: T) => string[];
  now?: () => Date;
}

export function restoreOrganism<T>(options: RestoreOptions<T>): OrganismRestoreReport {
  const { store, target, toVersion, validator } = options;
  const restoredAt = (options.now ?? (() => new Date()))();
  let from = 0;
  try {
    from = store.current().version;
  } catch {
    // empty store — nothing to restore from
  }

  const value = store.at(toVersion);
  if (value === undefined) {
    return { target, from, to: toVersion, verified: false, reasons: [`unknown version ${toVersion}`], restoredAt };
  }

  if (validator) {
    const reasons = validator(value);
    if (reasons.length > 0) {
      return { target, from, to: toVersion, verified: false, reasons, restoredAt };
    }
  }

  if (!store.rollbackTo(toVersion)) {
    return { target, from, to: toVersion, verified: false, reasons: [`rollback to version ${toVersion} failed`], restoredAt };
  }

  return { target, from, to: toVersion, verified: true, reasons: [], restoredAt };
}
