# IDEA-0132 — Cognitive Kernel Engine Stack

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 round-21 intake — "every framework is solving
  one stage of cognition, not the whole thing... the AI never asks
  'which framework do I use?'; it asks 'what cognitive operation am I
  currently performing?'" Proposal: a 12-layer engine stack — Reality →
  Observation → Understanding → Truth → Research → Diagnosis → Decision
  → Strategy → Innovation → Execution → Learning → Meta-Cognition, over
  Memory / Knowledge Graph / Reality Graph.
- **Related:** ADR-006 (cognitive microkernel — the service topology the
  engines run in), `src/cognitive-plane/frameworks/` (10 families / 34
  frameworks), ADR-003 (engineering intelligence), IDEA-0034 (decision
  law — the thinking scheduler), IDEA-0117 (execution graph), IDEA-0133
  (reality graph — Layer 0), IDEA-0135 (primitive library), IDEA-0136
  (framework DNA), GENESIS ch3 (five-engine framing)

## Motivation

The claim: frameworks are not a library, they are specialized cognitive
organs — Five Whys = causal discovery, SWOT = strategic analysis, PDCA =
continuous optimization, OODA = rapid adaptation, Design Thinking =
human-centered innovation, RCA = diagnosis. The substrate should
dispatch on the cognitive operation, then let the owning engine choose
its frameworks. The layer model also names one layer with no substrate
today — Innovation — and asks for engine-level arbitration ("research
wants more evidence, decision wants action — who wins?").

## The corpus cannot cover it because

Engines exist as organs, the frameworks library, and EI, but nothing
answers "what cognitive operation am I performing" and routes to the
owning engine: the CIR catalog (`src/protocol/catalog.ts`) classifies
the 17 CP ops by category for the runtime ABI, not user intent → engine.
The Innovation Engine is the one layer with zero substrate (TRIZ /
SCAMPER / morphological analysis are grep-absent; the frameworks
library has no innovation family). Arbitration between engine demands
is covered only partially by IDEA-0034's scheduler priority + ADR-004
virtual processors — no engine-level cognitive-budget protocol exists.

## Proposal sketch

- Engine dispatch table: each engine declares the operation families it
  owns (observe / understand / verify / research / diagnose / decide /
  strategize / innovate / execute / learn / reflect); a dispatcher
  classifies intent and routes to the owning engine, which then selects
  frameworks by DNA (IDEA-0136) and primitives (IDEA-0135).
- Engine registry: each engine declares its appetite — evidence-hunger,
  speed, cost — feeding the Intelligence Scheduler (IDEA-0034 +
  ADR-004): high urgency → OODA + fast heuristics; high uncertainty →
  research + truth; high risk → simulation + verification; creative
  exploration → innovation + perspective; routine → minimal analysis.
- Innovation engine: add an 11th frameworks family (TRIZ, SCAMPER,
  morphological analysis, lateral thinking, constraint relaxation,
  concept blending, analogical reasoning, evolutionary search) — the
  only layer with no substrate.

## Risk assessment

- Engine theater: re-skinning organs into a layer model without
  changing dispatch behavior. Anchor: one dispatch table over existing
  organs, never new engines; the delta is routing, not machinery.
- Duplication with CIR: CIR compiles intent into instructions; the
  dispatch table is the pre-CIR intent classifier — keep them adjacent,
  not merged.

## Where it lands

Extension of `src/cognitive-plane/frameworks/` registry + catalog.ts
routing + ADR-006 service topology; framework DNA (IDEA-0136) is the
enabling dependency.

## Code impact

None until a dispatch prototype; the frameworks inventory into the 12
engines is a documentation pass first.

## Next stage

Inventory the 34 frameworks into the 12 engines; verify the Innovation
family gap; prototype intent → engine dispatch in the FrameworkComposer.
