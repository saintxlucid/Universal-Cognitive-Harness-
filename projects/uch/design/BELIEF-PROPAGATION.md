# Belief Propagation Engine — design contract (IDEA-0086)

- **Status:** Prototype design (2026-08-01)
- **Idea note:** `rfc/ideas/IDEA-0086-belief-propagation-engine.md`
- **G1 register:** `research/foundations/23-belief-propagation.md`
- **Prototype:** `src/cognitive-plane/belief/belief-engine.ts`
- **Seed anchors:** connectome edges (support/attack seeds),
  activation-field confidence (per-hop decay), scientific-memory
  'contradicted' state, UER causal graph (influence paths), decision
  law (IDEA-0034, consumes propagated confidence), RFC-0005
  instability I(b) = confidence − evidenceMass.

## 1. Purpose

The belief-semantic layer over the causal graph: nodes are
memories/concepts with (confidence, evidence mass); edges are
support / attack / trust with provenance. Confidence, trust, and
contradiction update automatically along the edges — the way a
database maintains referential integrity.

## 2. Belief graph

- **Nodes:** `{ id, confidence ∈ [0,1], evidenceMass ≥ 0, direct: boolean }`
  — `direct` marks observed nodes (Law 4: direct evidence outranks
  inference).
- **Edges:** `{ from, to, kind: 'support' | 'attack' | 'trust', weight, provenance }`.

## 3. Propagation rules

- **Confidence of a node = f(own evidence, support, attack, hop decay):**
  - support raises confidence toward the supporting node's confidence
    (scaled by edge weight and hop decay);
  - attack lowers confidence;
  - own evidence (evidenceMass) anchors the result (Law 4: a `direct`
    node's confidence is never moved by propagation).
- **Trust flows along trust edges with Law-5 decay per hop.**
- Updates are ledgered and versioned (`belief:changed` event shape
  with tick + cause), causally ordered by the tick.

## 4. Contradiction ripple

- A contradiction (a new attack edge, or an explicit `contradict(id)`
  call) computes its **affected set** via reverse support edges.
- Each affected member is re-evaluated with the belief algebra;
  RFC-0005 instability vetoes reuse I(b) = confidence − evidenceMass
  (a member whose evidence mass falls below its confidence after the
  ripple is flagged `unstable`).
- The ripple emits one `belief:changed` record per affected node,
  with `cause: 'contradiction'`.
- Bounded: hop limit (default 3) and energy per tick (max affected
  nodes per ripple).

## 5. Direct evidence outranks inference

- Propagated values never overwrite a `direct` node's confidence —
  they may *inform* it (weighted), but the node's own evidence is the
  anchor. A contradiction can never overturn a direct node's
  confidence below its evidence floor.

## 6. Prototype scope

- Pure module: reads seed edges from injected arrays (connectome/
  UER shaped), emits events as records — no bus wiring.
- In-memory, tick-versioned; no persistence (replay integration is a
  later wave).

## 7. Risk notes

- Cascades: bounded by hop limit + per-ripple energy cap; large
  affected sets are reported as counts, not processed synchronously
  beyond the cap.
- Overwrite: direct evidence outranks inference (above) — the
  binding constraint, enforced structurally.
