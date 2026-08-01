/**
 * Belief Propagation Engine — prototype (IDEA-0086).
 *
 * The belief-semantic layer over the causal graph: nodes are
 * memories/concepts with (confidence, evidence mass); edges are
 * support / attack / trust with provenance. Confidence, trust, and
 * contradiction update automatically along the edges — the way a
 * database maintains referential integrity. UER provides the causal
 * graph; this is its belief layer.
 *
 * Belief algebra (deterministic, this prototype's contract):
 *   - evidenceAnchor = evidenceMass / (1 + evidenceMass) ∈ [0,1) —
 *     the RFC-0005 evidenceMass normalized so the shared instability
 *     formula keeps its units.
 *   - non-direct node: confidence' = clamp(anchor + Σ support(from.c
 *     × w × decay) − Σ attack(from.c × w × decay), 0, 1)
 *   - direct node (Law 4: direct evidence outranks inference):
 *     confidence' = clamp(c + informFactor × net, evidenceFloor, 1)
 *     — propagated values may INFORM, never overwrite; a
 *     contradiction can never overturn a direct node below its own
 *     evidence floor.
 *   - trust (Law 5: no component asserts its own trust): direct
 *     nodes seed trust from their own evidence (Law 31 verification
 *     record); trust flows along trust edges with decay per hop.
 *   - instability reuses RFC-0005: I(b) = confidence − evidenceAnchor;
 *     a node is `unstable` iff I(b) > INSTABILITY_THRESHOLD.
 *
 * Contradiction ripple: a new attack edge (or explicit
 * `contradict()`) computes its affected set via reverse support
 * edges (bounded by hop limit and a per-ripple energy cap), re-
 * evaluates each member, and emits one `belief:changed` record per
 * member with cause 'contradiction'. Large affected sets are
 * reported as counts, not processed beyond the cap.
 *
 * This is a PROTOTYPE (SOP-08 Prototype stage): a new module, not
 * wired into any gate. Every update is ledgered and versioned by
 * tick — nothing is silent.
 *
 * G1 evidence: research/foundations/23-belief-propagation.md
 * (Pearl 1988 belief propagation; Murphy-Weiss-Jordan 1999 loopy
 * BP; Shafer 1976 evidence theory; Doyle 1979 TMS — affected-set
 * computation; de Kleer 1986 ATMS; Crosby & Wallach 2009 trust
 * propagation; Golbeck & Hendler 2003 TidalTrust).
 */

export type BeliefEdgeKind = 'support' | 'attack' | 'trust';

export type BeliefChangeCause = 'propagation' | 'contradiction';

export interface BeliefNodeInput {
  readonly confidence?: number;
  /** Accumulated evidence for this node, ≥ 0 (unbounded raw). */
  readonly evidenceMass?: number;
  /** Direct evidence (Law 4): never overwritten by propagation. */
  readonly direct?: boolean;
}

export interface BeliefNode {
  readonly id: string;
  readonly confidence: number;
  readonly evidenceMass: number;
  readonly direct: boolean;
}

export interface BeliefEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: BeliefEdgeKind;
  /** Edge strength, 0..1 (default 1). */
  readonly weight: number;
  /** Who/why this edge exists (lineage anchor). */
  readonly provenance?: string;
}

/** One ledgered belief update — the `belief:changed` event shape,
 * causally ordered by the tick. */
export interface BeliefChange {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly evidenceMass: number;
  readonly instability: number;
  readonly unstable: boolean;
  readonly cause: BeliefChangeCause;
  readonly tick: number;
  /** Ripple only: the full affected-set size (may exceed processed). */
  readonly affectedCount?: number;
}

export interface BeliefEngineConfig {
  /** Per-hop decay of propagated influence (Law 5), default 0.9 —
   * matches the activation field's per-hop factor. */
  readonly decayPerHop: number;
  /** Maximum ripple depth over reverse support edges. */
  readonly hopLimit: number;
  /** Energy cap: max affected nodes processed per ripple. */
  readonly maxAffectedPerRipple: number;
  /** How much propagated influence may move a direct node. */
  readonly directInformFactor: number;
  /** Sweep cap for the propagation fixpoint (graph diameter bound). */
  readonly maxPasses: number;
  /** RFC-0005 instability veto threshold (mirrors VETO_THRESHOLD). */
  readonly instabilityThreshold: number;
}

export interface RippleResult {
  /** Full affected-set size (reverse-support BFS, hop-bounded). */
  readonly affectedCount: number;
  /** Nodes actually re-evaluated (≤ maxAffectedPerRipple). */
  readonly processed: number;
  /** True when the affected set exceeded the per-ripple energy cap. */
  readonly truncated: boolean;
  readonly changes: readonly BeliefChange[];
  /** Members flagged unstable after the ripple. */
  readonly unstable: readonly string[];
}

export interface BeliefNodeState {
  readonly id: string;
  readonly confidence: number;
  readonly evidenceMass: number;
  readonly evidenceAnchor: number;
  readonly direct: boolean;
  /** Derived trust (Law 5: computed by others, never self-asserted). */
  readonly trust: number;
  /** RFC-0005 instability I(b) = confidence − evidenceAnchor. */
  readonly instability: number;
  readonly unstable: boolean;
}

const DEFAULT_CONFIG: BeliefEngineConfig = {
  decayPerHop: 0.9,
  hopLimit: 3,
  maxAffectedPerRipple: 100,
  directInformFactor: 0.3,
  maxPasses: 16,
  instabilityThreshold: 0.5,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/* ------------------------------------------------------------------ */
/* Pure algebra — exported for direct use and testing.                 */
/* ------------------------------------------------------------------ */

/** Normalize raw evidence mass to [0,1): monotonic saturation. This
 * keeps the RFC-0005 instability formula's units when raw mass is
 * unbounded. */
export function evidenceAnchorOf(evidenceMass: number): number {
  const mass = Math.max(0, evidenceMass);
  return mass / (1 + mass);
}

/** RFC-0005 instability: I(b) = confidence − evidenceAnchor. */
export function instabilityOf(confidence: number, evidenceMass: number): number {
  return confidence - evidenceAnchorOf(evidenceMass);
}

/** RFC-0005 veto condition: I(b) above the threshold. */
export function isUnstable(confidence: number, evidenceMass: number, threshold = DEFAULT_CONFIG.instabilityThreshold): boolean {
  return instabilityOf(confidence, evidenceMass) > threshold;
}

export class BeliefEngine {
  private readonly config: BeliefEngineConfig;
  private readonly nodes = new Map<string, BeliefNode>();
  private readonly edges: BeliefEdge[] = [];
  private readonly trust = new Map<string, number>();
  private readonly changes: BeliefChange[] = [];
  private readonly order: string[] = [];
  private contradictionSeq = 0;

  constructor(config?: Partial<BeliefEngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /* ------------------------------------------------------------------ */
  /* Graph construction                                                  */
  /* ------------------------------------------------------------------ */

  /** Register a node. Confidence defaults to the evidence anchor;
   * direct nodes default to direct:false. Duplicate ids are
   * rejected — the graph is keyed by identity. Note: for NON-direct
   * nodes the declared confidence is only the initial snapshot value
   * — propagation recomputes confidence from evidence mass + edge
   * influence (the graph maintains belief, callers do not). Direct
   * nodes keep their declared confidence (Law 4). */
  addNode(id: string, input: BeliefNodeInput = {}): BeliefNode {
    if (this.nodes.has(id)) throw new Error(`belief engine: duplicate node '${id}'`);
    const evidenceMass = Math.max(0, input.evidenceMass ?? 0);
    const direct = input.direct ?? false;
    const anchor = evidenceAnchorOf(evidenceMass);
    const confidence = clamp(input.confidence ?? anchor, 0, 1);
    const node: BeliefNode = { id, confidence, evidenceMass, direct };
    this.nodes.set(id, node);
    this.order.push(id);
    // Law 5/31: a direct node's trust is seeded by its own evidence;
    // nobody asserts their own trust.
    this.trust.set(id, direct ? anchor : 0);
    return Object.freeze({ ...node });
  }

  /** Register an edge. Attack edges trigger the contradiction ripple
   * immediately (a new attack edge is a contradiction by definition)
   * and return its result; support/trust edges return undefined. */
  addEdge(input: { from: string; to: string; kind: BeliefEdgeKind; weight?: number; provenance?: string }): RippleResult | undefined {
    const edge = this.pushEdge(input);
    if (edge.kind === 'attack') return this.rippleFrom(edge.to);
    return undefined;
  }

  /** Explicit contradiction: a full-strength attack from a synthetic
   * observation node (confidence 1.0). Ripples once through the
   * reverse support set. */
  contradict(id: string, tick: number, reason?: string): RippleResult {
    if (!this.nodes.has(id)) throw new Error(`belief engine: unknown contradicted node '${id}'`);
    const source = `contradiction:${tick}:${id}:${this.contradictionSeq}`;
    this.contradictionSeq++;
    this.addNode(source, { confidence: 1, evidenceMass: 1, direct: true });
    this.pushEdge({
      from: source,
      to: id,
      kind: 'attack',
      weight: 1,
      provenance: reason ?? 'explicit contradiction',
    });
    return this.rippleFrom(id, tick);
  }

  /* ------------------------------------------------------------------ */
  /* Propagation                                                         */
  /* ------------------------------------------------------------------ */

  /** One belief pass to fixpoint: recompute every non-direct node's
   * confidence from its incoming edges and every node's trust along
   * trust edges. Emits one `belief:changed` record per moved node
   * (cause 'propagation'), with the final value. Deterministic:
   * simultaneous updates off the previous sweep's snapshot. */
  propagate(tick: number): BeliefChange[] {
    let snapshot = this.snapshot();
    let trustSnapshot = new Map(this.trust);
    const prePass = new Map(snapshot);
    for (let pass = 0; pass < this.config.maxPasses; pass++) {
      const next = new Map(snapshot);
      const nextTrust = new Map(trustSnapshot);
      let moved = false;
      for (const id of this.order) {
        const node = this.requireNode(id);
        const net = this.netInfluence(id, snapshot);
        const confidence = this.recompute(node, net);
        const trust = this.recomputeTrust(node, trustSnapshot);
        if (Math.abs(confidence - (snapshot.get(id) ?? 0)) > 1e-9 || Math.abs(trust - (this.trust.get(id) ?? 0)) > 1e-9) {
          next.set(id, confidence);
          nextTrust.set(id, trust);
          moved = true;
        }
      }
      snapshot = next;
      trustSnapshot = nextTrust;
      if (!moved) break;
    }
    const records: BeliefChange[] = [];
    for (const id of this.order) {
      const node = this.requireNode(id);
      const from = prePass.get(id) ?? 0;
      const to = snapshot.get(id) ?? 0;
      if (Math.abs(to - from) > 1e-9) {
        this.nodes.set(id, { ...node, confidence: to });
        records.push(this.record(id, from, to, 'propagation', tick));
      }
    }
    this.trust.clear();
    for (const [id, value] of trustSnapshot) this.trust.set(id, value);
    return records;
  }

  /** A node's current confidence, or undefined. */
  confidenceOf(id: string): number | undefined {
    return this.nodes.get(id)?.confidence;
  }

  /** A node's derived trust (Law 5: always computed from others'
   * evidence paths, never self-asserted). */
  trustOf(id: string): number | undefined {
    return this.trust.get(id);
  }

  /* ------------------------------------------------------------------ */
  /* Contradiction ripple                                                */
  /* ------------------------------------------------------------------ */

  /** Compute the affected set of a contradiction: reverse support
   * edges from the contradicted node, bounded by the hop limit. */
  private affectedSet(id: string): string[] {
    const seen = new Set<string>([id]);
    let frontier = [id];
    for (let hop = 0; hop < this.config.hopLimit && frontier.length > 0; hop++) {
      const next: string[] = [];
      for (const current of frontier) {
        for (const edge of this.edges) {
          if (edge.kind !== 'support' || edge.from !== current) continue;
          if (!seen.has(edge.to)) {
            seen.add(edge.to);
            next.push(edge.to);
          }
        }
      }
      frontier = next;
    }
    return [...seen];
  }

  /** Re-evaluate the affected set after a contradiction. Members are
   * processed in BFS order (contradicted node first, then its
   * dependents), each reading the live values of its predecessors —
   * the degradation ripples through the set in one deterministic
   * pass. Bounded by the per-ripple energy cap; large affected sets
   * are reported as counts, not processed. */
  private rippleFrom(id: string, tick = 0): RippleResult {
    const affected = this.affectedSet(id);
    const processed = Math.min(affected.length, this.config.maxAffectedPerRipple);
    const live = this.snapshot();
    const changes: BeliefChange[] = [];
    const unstable: string[] = [];
    for (let i = 0; i < processed; i++) {
      const member = affected[i];
      if (!member) continue;
      const node = this.requireNode(member);
      const net = this.netInfluence(member, live);
      const to = this.recompute(node, net);
      live.set(member, to);
      this.nodes.set(member, { ...node, confidence: to });
      if (isUnstable(to, node.evidenceMass, this.config.instabilityThreshold)) unstable.push(member);
      changes.push(this.record(member, node.confidence, to, 'contradiction', tick, affected.length));
    }
    return Object.freeze({
      affectedCount: affected.length,
      processed,
      truncated: affected.length > processed,
      changes: Object.freeze(changes),
      unstable: Object.freeze(unstable),
    });
  }

  /* ------------------------------------------------------------------ */
  /* Observability                                                       */
  /* ------------------------------------------------------------------ */

  /** The ledger of `belief:changed` records — replay-complete, in
   * call order (tick fields give causal order). */
  changesFor(tick?: number): BeliefChange[] {
    return tick === undefined ? [...this.changes] : this.changes.filter((c) => c.tick === tick);
  }

  fullLedger(): BeliefChange[] {
    return [...this.changes];
  }

  /** Current state view of a node (confidence + derived trust +
   * instability), or undefined. */
  stateOf(id: string): BeliefNodeState | undefined {
    const node = this.nodes.get(id);
    if (!node) return undefined;
    const anchor = evidenceAnchorOf(node.evidenceMass);
    return Object.freeze({
      id,
      confidence: node.confidence,
      evidenceMass: node.evidenceMass,
      evidenceAnchor: anchor,
      direct: node.direct,
      trust: this.trust.get(id) ?? 0,
      instability: instabilityOf(node.confidence, node.evidenceMass),
      unstable: isUnstable(node.confidence, node.evidenceMass, this.config.instabilityThreshold),
    });
  }

  nodeCount(): number {
    return this.nodes.size;
  }

  edgeCount(): number {
    return this.edges.length;
  }

  /** Node ids in insertion order (deterministic iteration). */
  nodeIds(): string[] {
    return [...this.order];
  }

  clear(): void {
    this.nodes.clear();
    this.edges.length = 0;
    this.trust.clear();
    this.changes.length = 0;
    this.order.length = 0;
    this.contradictionSeq = 0;
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                           */
  /* ------------------------------------------------------------------ */

  /** Net propagated influence on a node: support raises, attack
   * lowers, each scaled by edge weight and per-hop decay. */
  private netInfluence(id: string, snapshot: Map<string, number>): number {
    let net = 0;
    for (const edge of this.edges) {
      if (edge.to !== id || edge.kind === 'trust') continue;
      const sourceConfidence = snapshot.get(edge.from) ?? 0;
      net += (edge.kind === 'support' ? 1 : -1) * sourceConfidence * edge.weight * this.config.decayPerHop;
    }
    return net;
  }

  /** The belief algebra: direct nodes anchor on their own evidence
   * (informed, never overwritten); others are anchored on the
   * evidence anchor plus net influence. */
  private recompute(node: BeliefNode, net: number): number {
    const anchor = evidenceAnchorOf(node.evidenceMass);
    if (node.direct) {
      return clamp(node.confidence + this.config.directInformFactor * clamp(net, -1, 1), anchor, 1);
    }
    return clamp(anchor + net, 0, 1);
  }

  /** Trust relaxation: direct nodes hold their evidence-seeded trust;
   * trust flows along trust edges with per-hop decay. */
  private recomputeTrust(node: BeliefNode, trustSnapshot: Map<string, number>): number {
    if (node.direct) return evidenceAnchorOf(node.evidenceMass);
    let trust = 0;
    for (const edge of this.edges) {
      if (edge.kind !== 'trust' || edge.to !== node.id) continue;
      trust += (trustSnapshot.get(edge.from) ?? 0) * edge.weight * this.config.decayPerHop;
    }
    return clamp(trust, 0, 1);
  }

  /** Register an edge without triggering the contradiction ripple —
   * the caller decides when the ripple runs. */
  private pushEdge(input: { from: string; to: string; kind: BeliefEdgeKind; weight?: number; provenance?: string }): BeliefEdge {
    const { from, to, kind } = input;
    if (!this.nodes.has(from)) throw new Error(`belief engine: unknown edge source '${from}'`);
    if (!this.nodes.has(to)) throw new Error(`belief engine: unknown edge target '${to}'`);
    if (kind === 'trust' && from === to) throw new Error('belief engine: a node cannot trust itself');
    const edge: BeliefEdge = {
      from,
      to,
      kind,
      weight: clamp(input.weight ?? 1, 0, 1),
      ...(input.provenance !== undefined ? { provenance: input.provenance } : {}),
    };
    this.edges.push(edge);
    return edge;
  }

  private snapshot(): Map<string, number> {
    const snapshot = new Map<string, number>();
    for (const [id, node] of this.nodes) snapshot.set(id, node.confidence);
    return snapshot;
  }

  private requireNode(id: string): BeliefNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`belief engine: unknown node '${id}'`);
    return node;
  }

  private record(
    id: string,
    from: number,
    to: number,
    cause: BeliefChangeCause,
    tick: number,
    affectedCount?: number,
  ): BeliefChange {
    const node = this.requireNode(id);
    const record: BeliefChange = {
      id,
      from,
      to,
      evidenceMass: node.evidenceMass,
      instability: instabilityOf(to, node.evidenceMass),
      unstable: isUnstable(to, node.evidenceMass, this.config.instabilityThreshold),
      cause,
      tick,
      ...(affectedCount !== undefined ? { affectedCount } : {}),
    };
    this.changes.push(record);
    return Object.freeze(record);
  }
}

/* ------------------------------------------------------------------ */
/* Derived helpers — consumable by the corpus                          */
/* ------------------------------------------------------------------ */

export interface BeliefReport {
  readonly nodes: number;
  readonly edges: number;
  readonly changes: number;
  readonly unstableCount: number;
  readonly meanConfidence: number;
  readonly maxInstability: number;
}

/** Aggregate the belief graph into a report — the shape an
 * epistemology SLO or the observatory would consume. Pure
 * derivation. */
export function beliefReport(engine: BeliefEngine, tick?: number): BeliefReport {
  const ids = engine.nodeIds();
  const states = ids.map((id) => engine.stateOf(id)).filter((s): s is BeliefNodeState => s !== undefined);
  const changes = engine.changesFor(tick);
  const unstableCount = states.filter((s) => s.unstable).length;
  const meanConfidence = states.length > 0 ? states.reduce((sum, s) => sum + s.confidence, 0) / states.length : 0;
  const maxInstability = states.reduce((max, s) => Math.max(max, s.instability), -Infinity);
  return {
    nodes: states.length,
    edges: engine.edgeCount(),
    changes: changes.length,
    unstableCount,
    meanConfidence,
    maxInstability: Number.isFinite(maxInstability) ? maxInstability : 0,
  };
}
