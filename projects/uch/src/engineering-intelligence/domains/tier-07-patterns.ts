/**
 * Tier VII — Architectural Patterns.
 *
 * Not names to memorize: trade-off models. Every pattern entry carries
 * when-it-fits signals and strong when-NOT-to-use guidance, because the
 * senior skill is knowing when a pattern hurts.
 */

import type { EngineeringConcept, TierId } from '../types.js';

const TIER: TierId = 'tier-07-patterns';

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
  id: `arch.${id}`,
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

const PEEA = ['Patterns of Enterprise Application Architecture — Fowler'] as const;
const CLEAN = ['Clean Architecture — Martin'] as const;
const DDIA = ['Designing Data-Intensive Applications — Kleppmann'] as const;

export const TIER_07_PATTERNS_CONCEPTS: EngineeringConcept[] = [
  C(
    'layered',
    'Layered Architecture',
    'architecture',
    'Horizontal tiers (presentation → business → data) with downward-only dependencies; simple, familiar, easily over-layered.',
    ['layered', 'tiers', 'n-tier'],
    ['layers', 'tier', 'mvc'],
    ['Use layers when the dependency direction is simple and stable; keep each layer thin and honest.'],
    ['N+1 layers of pass-through; business logic in the presentation tier; layers that depend upward.'],
    [PEEA[0]],
  ),
  C(
    'hexagonal',
    'Hexagonal Architecture',
    'architecture',
    'Ports and adapters: the domain core is isolated behind interfaces; everything external is an adapter.',
    ['hexagonal', 'ports and adapters', 'adapter'],
    ['ports', 'adapters', 'external'],
    ['Use hexagonal when the domain must survive external churn (DB, UI, third parties); keep adapters thin.'],
    ['Hexagonal ceremony for CRUD with no domain; adapters that grow business logic.'],
    ['Cockburn, Hexagonal Architecture'],
  ),
  C(
    'onion',
    'Onion Architecture',
    'architecture',
    'Dependency inversion rings around the domain core; concentric layers with inward-pointing dependencies.',
    ['onion', 'rings', 'domain core'],
    ['domain', 'core', 'layers'],
    ['Apply when domain logic is the investment and infrastructure is replaceable; enforce ring boundaries mechanically.'],
    ['Onion wrapping around anemic domains; infrastructure leaking into the core.'],
    ['Palermo, Onion Architecture'],
  ),
  C(
    'clean',
    'Clean Architecture',
    'architecture',
    'Use-case-centered dependency rule: inner circles know nothing of outer circles; frameworks are details.',
    ['clean architecture', 'use case', 'dependency rule'],
    ['use case', 'entity', 'dependency rule'],
    ['Use when use cases are the product and the team can sustain the discipline; test the dependency rule.'],
    ['Clean architecture diagrams with no enforcement; framework types flowing into entities.'],
    [CLEAN[0]],
  ),
  C(
    'ddd',
    'Domain-Driven Design',
    'architecture',
    'Modeling with the business: ubiquitous language, bounded contexts, aggregates, and repositories as the model\u2019s seams.',
    ['ddd', 'bounded context', 'aggregate', 'ubiquitous language'],
    ['domain', 'aggregate', 'bounded context'],
    ['Use DDD where the business rules are complex enough to deserve a model; agree the ubiquitous language first.'],
    ['DDD for CRUD shells; aggregates modeled as anemic getters; contexts with no defined boundaries.'],
    ['Evans, Domain-Driven Design'],
  ),
  C(
    'event-driven',
    'Event-Driven Architecture',
    'architecture',
    'Components communicate through events on a bus: decoupled in time and space, with delivery semantics as the tax.',
    ['event driven', 'event bus', 'publish subscribe'],
    ['event', 'pubsub', 'async', 'webhook'],
    ['Use events where decoupling and scalability justify exactly-once/ordering complexity; own delivery semantics explicitly.'],
    ['Event-driven for request/response flows; fire-and-forget events with no failure handling.'],
    [DDIA[0]],
  ),
  C(
    'microservices',
    'Microservices',
    'architecture',
    'Independently deployable services owning their data; the operational cost is the real price, not the code.',
    ['microservice', 'service boundary', 'deploy'],
    ['service', 'team', 'deploy'],
    ['Choose microservices for independent scaling/deployment/teams — not for modularity; each service must own its data.'],
    ['Distributed monolith: services sharing a DB; services too small to own their problems.'],
    ['Lewis & Fowler, Microservices; DDIA'],
  ),
  C(
    'modular-monolith',
    'Modular Monolith',
    'architecture',
    'One deployment unit with hard module boundaries — the default for most teams: modularity without distributed cost.',
    ['modular monolith', 'monolith'],
    ['monolith', 'module', 'boundary'],
    ['Start modular-monolith: enforce module boundaries in code, keep the option to split services later.'],
    ['Monolith without boundaries (a "big ball of mud"); premature microservice split of a small team.'],
    ['Fowler, MonolithFirst; Modular Monolith pattern canon'],
  ),
  C(
    'cqrs',
    'CQRS',
    'architecture',
    'Separate read and write models so each is optimized independently (see also cs.dist.cqrs for the distributed view).',
    ['cqrs', 'command query'],
    ['read model', 'write model', 'denormalize'],
    ['Apply when read/write shapes diverge; own read-model lag semantics.'],
    ['CQRS where one model suffices; ignoring lag in read models.'],
    ['Fowler, CQRS; DDIA'],
  ),
  C(
    'actor-model',
    'Actor Model',
    'architecture',
    'Isolated actors communicating by asynchronous messages; concurrency without shared state.',
    ['actor model', 'actor', 'mailbox'],
    ['actor', 'mailbox', 'message passing'],
    ['Use actors where state isolation and message-driven concurrency fit (services, UIs, telemetry); mind mailbox backpressure.'],
    ['Actors for CPU-bound compute; unbounded mailboxes as hidden queues.'],
    ['Hewitt, Actor Model; Erlang/OTP design principles'],
  ),
  C(
    'pipes-filters',
    'Pipes and Filters',
    'architecture',
    'Processing as a chain of independent stages connected by streams; composable, parallelizable, debuggable.',
    ['pipes', 'filters', 'pipeline'],
    ['pipeline', 'stream', 'transform'],
    ['Use pipelines where data flows through well-defined transforms; keep stages pure and independently testable.'],
    ['Pipeline stages with hidden side effects; filter chains that serialize everything.'],
    [PEEA[0]],
  ),
  C(
    'blackboard',
    'Blackboard',
    'architecture',
    'Shared knowledge source solved collaboratively by specialists — for problems with no deterministic decomposition.',
    ['blackboard', 'expert system'],
    ['heuristic', 'ai', 'unstructured problem'],
    ['Use blackboard for ill-structured problems (speech, vision, planning) where specialists compete/cooperate; expect control complexity.'],
    ['Blackboard where a deterministic pipeline exists.'],
    ['Engelmore & Morgan, Blackboard Systems'],
  ),
  C(
    'plugin',
    'Plugin Architecture',
    'architecture',
    'A stable core with hot-swappable extension modules — extensibility without touching the core.',
    ['plugin', 'extension point', 'host'],
    ['plugin', 'extension', 'marketplace'],
    ['Use plugins when third-party or configurable extension is a real requirement; freeze the core contract first.'],
    ['Plugin framework before the core is stable; plugins that fork the core.'],
    ['Meyer, open-closed principle; plugin pattern canon'],
  ),
];

export function tier07PatternsConcepts(): EngineeringConcept[] {
  return TIER_07_PATTERNS_CONCEPTS.map((c) => ({ ...c }));
}
