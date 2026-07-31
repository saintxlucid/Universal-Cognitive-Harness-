/**
 * Tier III — Systems Thinking.
 *
 * Senior engineers don't think in files; they think in systems.
 * Concepts for reasoning about failure propagation, degradation,
 * backpressure, capacity, observability, and operational simplicity.
 */

import type { EngineeringConcept, TierId } from '../types.js';

const TIER: TierId = 'tier-03-systems';

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
  id: `sys.${id}`,
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

const P99 = ['Designing Data-Intensive Applications — Kleppmann'];
const SRE = ['Google SRE Book'];

export const TIER_03_SYSTEMS_CONCEPTS: EngineeringConcept[] = [
  C(
    'failure-propagation',
    'Failure Propagation',
    'failure-modeling',
    'Failures flow outward along dependencies: every call graph is a failure tree, not a success tree.',
    ['failure', 'propagation', 'dependency'],
    ['call', 'dependency', 'service'],
    ['Map each dependency failure to the behavior it produces (timeout, error, fallback, retry) before wiring the call.'],
    ['Assuming dependencies never fail; treating network calls as local function calls.'],
    P99,
  ),
  C(
    'cascading-failures',
    'Cascading Failures',
    'failure-modeling',
    'A local failure that loads survivors past their limits: retries from one node become floods on the next.',
    ['cascade', 'cascading', 'collapse'],
    ['retry', 'timeout', 'hotspot'],
    ['Ask "what does this failure do to the next node?"; break the loop with timeouts, budgets, and bulkheads.'],
    ['Unbounded retry fan-out; failover to a peer with no spare capacity.'],
    ['P99; AWS Well-Architected'],
  ),
  C(
    'graceful-degradation',
    'Graceful Degradation',
    'failure-modeling',
    'When a dependency fails, serve less — cached, partial, or degraded — instead of serving nothing.',
    ['degradation', 'fallback', 'degrade'],
    ['fallback', 'cache', 'stale'],
    ['Design each feature\u2019s degraded mode explicitly: what data can be served from cache, what UX is acceptable.'],
    ['All-or-nothing availability; no degraded path for optional data.'],
    SRE,
  ),
  C(
    'backpressure',
    'Backpressure',
    'flow-control',
    'Producers must slow when consumers cannot keep up; unbounded buffering trades latency spikes for memory loss.',
    ['backpressure', 'buffer', 'flow control'],
    ['queue', 'buffer', 'stream', 'ingest'],
    ['Bound every queue explicitly; propagate slow-consumer signals to producers instead of growing buffers.'],
    ['Unbounded queues that silently accumulate; consumers that never signal capacity.'],
    ['P99; Reactive Streams spec'],
  ),
  C(
    'retry-amplification',
    'Retry Amplification',
    'flow-control',
    'Retries multiply load: N clients × M layers × R retries — the arithmetic of outage.',
    ['retry amplification', 'retry'],
    ['retry', 'backoff', 'timeout'],
    ['Cap retry depth per layer, add jittered backoff, and count total multiplied load before enabling auto-retry.'],
    ['Immediate retry on timeout under load; every layer retrying independently.'],
    ['AWS: Timeout, Retry, Jitter'],
  ),
  C(
    'bottlenecks',
    'Bottlenecks',
    'capacity',
    'Every system has one true throughput limit; optimizing elsewhere moves it, optimizing it moves the system.',
    ['bottleneck', 'throughput', 'saturation'],
    ['slow', 'queue depth', 'latency'],
    ['Measure utilization and queue depth per stage before optimizing; the bottleneck is wherever work queues.'],
    ['Optimizing non-bottleneck stages; guessing instead of measuring.'],
    ['Goldratt, The Goal; SRE'],
  ),
  C(
    'capacity-planning',
    'Capacity Planning',
    'capacity',
    'Sizing infrastructure against demand curves, not averages: peak, growth, and failure headroom.',
    ['capacity', 'scaling', 'headroom'],
    ['scale', 'replica', 'peak'],
    ['Size for peak × headroom, document the demand model, and tie scaling triggers to measured saturation.'],
    ['Average-based sizing; scaling reactively after saturation.'],
    SRE,
  ),
  C(
    'observability',
    'Observability',
    'operations',
    'Unknown unknowns are undebuggable without logs, metrics, and traces that ask new questions, not pre-defined ones.',
    ['observability', 'telemetry', 'tracing'],
    ['log', 'metric', 'trace', 'debug'],
    ['Emit structured logs with request context, metrics with labeled dimensions, and traces across service boundaries.'],
    ['Debugging by guess; log-only observability with no metrics or traces.'],
    SRE,
  ),
  C(
    'fault-isolation',
    'Fault Isolation',
    'operations',
    'Containing failures to a blast radius via bulkheads, timeouts, and separate failure domains.',
    ['fault isolation', 'bulkhead', 'isolation'],
    ['pool', 'tenant', 'timeout'],
    ['Give critical paths their own pools/timeouts so one workload cannot starve another.'],
    ['Shared pool where one tenant\u2019s surge starves all; no per-dependency timeouts.'],
    ['P99; Bulkhead pattern'],
  ),
  C(
    'blast-radius',
    'Blast Radius',
    'operations',
    'The set of users and systems harmed when a component fails — the metric to shrink before adding features.',
    ['blast radius', 'impact'],
    ['deploy', 'migration', 'feature'],
    ['Prefer changes that shrink the affected set; stages, canaries, and flags bound blast radius.'],
    ['Big-bang migrations; changes whose failure takes down unrelated features.'],
    SRE,
  ),
  C(
    'spof',
    'Single Points of Failure',
    'operations',
    'A component whose loss takes down the system; redundancy is the fix, and shared dependencies are the hidden SPOFs.',
    ['single point', 'spof'],
    ['single', 'one node', 'one instance'],
    ['Audit for single instances, single queues, single disks, single certs, single team knowledge.'],
    ['One replica "because it\u2019s just internal"; shared broker in a multi-service path.'],
    SRE,
  ),
  C(
    'operational-simplicity',
    'Operational Simplicity',
    'operations',
    'The cost of running a system dominates its lifecycle cost; every moving part is a pager rotation.',
    ['simplicity', 'operational', 'toil'],
    ['deploy', 'runbook', 'maintenance'],
    ['Ask "who pages at 3am for this?" before adding moving parts; prefer boring, well-understood technology.'],
    ['Novel infrastructure without runbooks; complexity that requires specialists to operate.'],
    SRE,
  ),
];

export function tier03SystemsConcepts(): EngineeringConcept[] {
  return TIER_03_SYSTEMS_CONCEPTS.map((c) => ({ ...c }));
}
