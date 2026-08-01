# IDEA-0063 — Cognitive Resource Allocator

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 infrastructure intake (round 10) — "Operating
  systems allocate RAM. UCH allocates attention, tokens, memory,
  reasoning, confidence, bandwidth. Every subsystem requests resources."
- **Related:** control-plane budgets (energy economics), vmem score
  (recency × salience × energy), ADR-004 fabric energy costs +
  `protocol/catalog.ts` per-op energy, decision-law λe·E (energy
  term), IDEA-0037 (thermodynamics — load → heat → degradation),
  IDEA-0016 (economics — utility-weighted scheduling), IDEA-0011
  (physiology — homeostasis)

## Motivation

UCH meters *energy* (budgets, per-op costs, thermodynamic load) but
does not *allocate* the scarce cognitive resources that energy pays
for: attention, token budget, reasoning depth, memory slots,
confidence. Every organ today competes for these implicitly — whoever
calls first wins. OSes did not survive with ad-hoc memory; they
centralized allocation with explicit request/acquire/release. The
claim: a unified allocator where every subsystem *requests* resources
against policy instead of grabbing them.

## The corpus cannot cover it because

Budgets are a cap, not an allocator: they bound spend but don't decide
who gets attention when two organs both want it; vmem scores decide
page temperature but not token grants to a reasoning request;
scheduler priorities (IG over EU per decision law) decide execution
order but not resource share; nothing tracks attention or token
entitlements across organs, and no subsystem can express "I need
reasoning depth 3 for this" as a resource request.

## Proposal sketch

- Resource classes: attention, tokens, memory (slots), reasoning
  depth, confidence (allowance to raise confidence without new
  evidence), bandwidth (per fabric dispatch).
- One request interface: `allocate(class, amount, priority, deadline)`
  → grant (or stall/deny) with policy from budgets + physiology
  (thermo state caps total load, IDEA-0037) + economics (ROI,
  IDEA-0016); denials are advisory signals, never silent.
- Accounting: every grant ledgered (energy already is — join on the
  same ledger); starvation detection per organ (profiler input,
  IDEA-0066).

## Risk assessment

- Over-centralization is the failure mode — the allocator must stay a
  thin policy layer over the existing budget/vmem/fabric primitives,
  never re-implement them; granting must stay local-latency
  (no cross-organ RPC on the hot path).

## Where it lands

- `src/control-plane/allocator/` beside budgets; design doc
  `design/RESOURCE-ALLOCATION.md`.

## Code impact

- New module + adapters on budgets and fabric; organs opt in
  incrementally; decision-law λe·E becomes the priority input.

## Next stage

- Resource-class inventory against budgets/catalog; request contract
  draft; one pilot organ (retrieval depth vs token budget).
