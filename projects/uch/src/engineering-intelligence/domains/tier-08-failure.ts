/**
 * Tier VIII — Failure Engineering.
 *
 * Before writing code, the system imagines failure. Pre-mortem framing:
 * "How can this fail?" — network disappears, DB stalls, disk full,
 * memory exhausted, clocks drift, dependencies unavailable.
 */

import type { EngineeringConcept, TierId } from '../types.js';

const TIER: TierId = 'tier-08-failure';

const C = (
  id: string,
  name: string,
  family: string,
  definition: string,
  signals: string[],
  triggers: string[],
  guidance: string[],
  antiPatterns: string[],
  provenance: string[],
): EngineeringConcept => ({
  id: `failure.${id}`,
  tier: TIER,
  name,
  family,
  definition,
  signals,
  triggers,
  guidance,
  antiPatterns,
  weight: 1,
  provenance,
});

const PREMORTEM = ['Klein, The Power of Intuition / pre-mortem technique; SRE Book'];
const SRE = ['Google SRE Book'];

export const TIER_08_FAILURE_CONCEPTS: EngineeringConcept[] = [
  C(
    'pre-mortem',
    'Pre-Mortem',
    'imagination',
    'Assume the change failed, then work backward to why — the cheapest incident investigation that exists.',
    ['pre-mortem', 'fail', 'risk'],
    ['design', 'plan', 'change', 'risk'],
    ['Before accepting any non-trivial change, write the failure story: trigger, propagation, detection, recovery.'],
    ['Ship-first-investigate-later; failure analysis only after incidents.'],
    PREMORTEM,
  ),
  C(
    'network-loss',
    'Network Disappears',
    'surfaces',
    'Networks fail silently and partially: drops, latency, asymmetry, blackholes — the most common production surprise.',
    ['network', 'timeout', 'connection'],
    ['fetch', 'socket', 'api', 'http'],
    ['Define timeout, retry, and fallback behavior for every network dependency; treat "unreachable" as a state.'],
    ['Infinite hangs on connection; assuming a request either succeeds or errors quickly.'],
    SRE,
  ),
  C(
    'db-stall',
    'Database Stall',
    'surfaces',
    'Databases stall: locks, deadlocks, vacuum/compaction, connection pool exhaustion — often for longer than timeouts.',
    ['database', 'connection pool', 'lock'],
    ['query', 'pool', 'transaction'],
    ['Bound pool size, set statement timeouts, and design for "the DB is slow/blocked" as a named state.'],
    ['Unbounded pool growth; queries without timeout; retry storms against a stalled DB.'],
    SRE,
  ),
  C(
    'disk-full',
    'Disk Full',
    'surfaces',
    'Disks fill up: logs, temp files, data growth — writes fail, then reads and even the OS degrade.',
    ['disk', 'storage', 'write'],
    ['write', 'log', 'file', 'cache'],
    ['Design for write failure; bound log/queue sizes; alert on usage before saturation.'],
    ['Writes without error handling; unbounded logs or queue files.'],
    SRE,
  ),
  C(
    'memory-exhaustion',
    'Memory Exhaustion',
    'surfaces',
    'Memory runs out: OOM-killed processes, GC thrash, swap storms — often triggered by a slow leak or a burst.',
    ['memory', 'leak', 'cache'],
    ['cache', 'buffer', 'store'],
    ['Bound caches and buffers; watch unbounded collections keyed by user/input; know the OOM behavior.'],
    ['Unbounded in-memory caches; ignoring memory growth in long-running processes.'],
    SRE,
  ),
  C(
    'clock-drift',
    'Clock Drift',
    'surfaces',
    'Wall clocks skew between machines: timestamps lie, ordering breaks, TTLs misbehave, retries race.',
    ['clock', 'timestamp', 'ttl'],
    ['expire', 'timestamp', 'order', 'ttl'],
    ['Use monotonic clocks for durations and logical clocks for ordering; never trust wall-clock across hosts.'],
    ['Ordering events by client timestamp; TTLs computed on the client clock.'],
    ['DDIA; Lamport'],
  ),
  C(
    'dependency-absence',
    'Dependency Unavailability',
    'surfaces',
    'Dependencies disappear: packages, services, credentials, license servers — absent at the worst moment.',
    ['dependency', 'unavailable', 'missing'],
    ['dependency', 'package', 'credential'],
    ['Plan for cold-start dependency absence (offline installs, cached artifacts, local fallbacks).'],
    ['Runtime fetches of critical dependencies; no cache of build artifacts.'],
    SRE,
  ),
  C(
    'partial-failure',
    'Partial Failure',
    'surfaces',
    'In a batch, some calls succeed and some fail; handling the mixed outcome is the actual contract.',
    ['partial failure', 'some succeed'],
    ['batch', 'parallel', 'all'],
    ['Define the semantics for partial success: retry the failed subset, record both outcomes, never assume all-or-nothing.'],
    ['Promise.all that aborts everything on one failure; ignoring partial results.'],
    ['DDIA'],
  ),
  C(
    'rollback',
    'Recovery Path',
    'imagination',
    'Every change needs a way out: rollback, revert, or forward-fix — defined before the change, not during the incident.',
    ['rollback', 'revert', 'recovery'],
    ['deploy', 'migration', 'schema'],
    ['Define the exit path before shipping: can this change be undone, and how fast?'],
    ['Irreversible migrations without backup; deploy processes with no revert step.'],
    SRE,
  ),
];

export function tier08FailureConcepts(): EngineeringConcept[] {
  return TIER_08_FAILURE_CONCEPTS.map((c) => ({ ...c }));
}
