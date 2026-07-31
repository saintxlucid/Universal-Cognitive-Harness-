# IDEA-0036 — Cognitive Topology

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "ideas are not lists, they are
  landscapes: every project as a multidimensional topology; UCH can
  calculate the distance between concept A and B, and detect holes in
  understanding"
- **Related:** src/connectome (weighted graph), src/kernel/retrieval
  (embeddings/recall), engineering-intelligence concept tiers,
  cognitive time machine (beliefs as points), IDEA-0035 (entropy as
  measurement), IDEA-0014 (observatory as visualization)

## Motivation

The connectome is a weighted graph with activation paths but no metric
structure. The claim: endow the concept space with a topology — graph
distances or an embedding — so "how far is concept A from concept B" and
"where are the holes in this organism's understanding" become
computable. Holes: concepts implied by the neighborhood (adjacent
concepts mention them) but absent from the graph — a measurable gap in
understanding.

## The corpus cannot cover it because

Connectome edges have weights and activation decay, but no distance
function, no notion of dense regions, boundaries, or absent-but-implied
concepts.

## Proposal sketch

- Define distance over the connectome (shortest-path or embedded vector
  distance with weights); validate by checking whether measured distance
  predicts transfer difficulty (how hard learning B is given A).
- Hole detection: for each concept, inspect its neighbors' expected
  associates (via the EI concept tiers' related concepts) and flag
  missing ones as candidate holes.
- Boundaries and density feed the observatory (IDEA-0014) and the
  "Knowledge X-Ray" instrument (IDEA-0043).

## Risk assessment

- Metaphor overload: distance must predict something measurable
  (learning cost, review findings) or it stays decorative.

## Where it lands

- Design doc `design/COGNITIVE-TOPOLOGY.md`; extends connectome.

## Code impact

- None until a distance function is defined; first prototype computes
  graph distances over the existing connectome.

## Next stage

Compute connectome graph distances; check whether low-density holes
correlate with repeated review findings or mistake-db entries.
