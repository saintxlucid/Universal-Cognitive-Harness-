# IDEA-0065 — Cognitive Consensus Layer

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 infrastructure intake (round 10) — "If Claude,
  GPT, Gemini disagree — who wins? Consensus algorithms. Voting.
  Confidence fusion. Evidence weighting. Expert routing. Inspired by
  distributed systems."
- **Related:** epistemology `consensusScore` (0.10 weight in
  assessTruth), `multiAgentConsensus` orchestration tool (rStar-style
  self-play), frameworks registry (delphi / nominal-group /
  stepladder / multi-voting), provenance method `'consensus'`, EI
  decision-law risk term (RFC-0005 instability), IDEA-0027 (sociology
  — reputation from conformance evidence), IDEA-0022 (review board),
  IDEA-0064 (networking — quorum when peers disagree)

## Motivation

UCH can already ask multiple models and average answers, but there is
no *algorithmic* consensus layer: voting schemes, confidence fusion
from calibrated probabilities, evidence weighting, and expert routing
all exist only as ad-hoc weights (a hardcoded 0.10 in assessTruth) or
as tool-level orchestration. Distributed systems made consensus a
discipline (Paxos/Raft/Byzantine tolerance); multi-model cognition has
the same structure — disagreeing, fallible, possibly compromised
advisors — and no discipline. The claim: a consensus subsystem that
decides *who wins* by evidence and calibration, not by call order.

## The corpus cannot cover it because

`multiAgentConsensus` returns agreement statistics without calibrated
fusion; provenance records `method: 'consensus'` without the algorithm
behind it; the frameworks catalog *names* delphi/nominal-group but
implements none of the voting math; calibration exists (calibration
profiles, decision journal) but is not consumed by any fusion step;
nothing implements evidence weighting (evidence-mass accounting exists
only in the instability veto, RFC-0005); expert routing is
`routeToExpert` heuristics, not probability-based selection.

## Proposal sketch

- Algorithms: weighted voting (weights = calibrated model reliability
  from the calibration profile), confidence fusion (probability
  pooling — logarithmic opinion pools over calibrated scores),
  evidence weighting (belief update proportional to evidence mass and
  independence), Byzantine-aware aggregation (median-of-confidence as
  the injection-resistant default per IDEA-0062).
- Expert routing: selection by posterior P(correct | model, task)
  from the calibration profile + EI tier knowledge, replacing
  keyword routing.
- Outputs: fused verdict + uncertainty + per-source contribution,
  all ledgered as provenance `method: 'consensus'` with the actual
  algorithm name — closing the provenance gap.

## Risk assessment

- Consensus math on uncalibrated scores is garbage-in; calibration
  profiles are mandatory input, never optional; a single overconfident
  source must not dominate (log-opinion pooling handles this, naive
  averaging does not).

## Where it lands

- `src/kernel/consensus/` beside epistemology; design doc
  `design/COGNITIVE-CONSENSUS.md`; consumed by multiAgentConsensus and
  the review board (IDEA-0022).

## Code impact

- New module; `assessTruth` consensus term re-pointed at it;
  `multiAgentConsensus` becomes a transport over it.

## Next stage

- Calibration-profile → weight mapping; log-opinion pooling prototype
  on the EI benchmark corpus (multi-model runs).
