# IDEA-0018 — Cognitive Silicon

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "think hardware: silicon blocks —
  planning core, reasoning core, simulation core, memory core, verification
  core, learning core — each with latency, bandwidth, throughput, energy,
  instructions, benchmarks; the runtime becomes measurable"
- **Related:** design/ADR-004 (virtual processors, 10-CPU namespace),
  src/accelerators/virtual-processors.ts, src/protocol/catalog.ts (energy
  costs)

## Motivation

Treat cognitive capabilities as silicon blocks with measured properties.
When every block has latency, bandwidth, throughput, energy, and benchmarks,
the runtime stops being an opinion and becomes a measurable, comparable
machine — you can reason about composition and cost the way hardware
engineers do.

## The corpus cannot cover it because

Virtual processors abstract *models* (tiers, affinity, provider routing);
the CP catalog attaches energy costs to instructions. There is no
block-level abstraction with bandwidth/throughput/instruction benchmarks, no
composition rules between blocks, no honest benchmark harness.

## Proposal sketch

- Silicon block catalog: per block — latency, bandwidth, throughput, energy
  per instruction, benchmark results, composition constraints.
- Block graph: how blocks compose (planning → simulation → verification)
  with measured interface costs.
- Kernel becomes describable as hardware; the observatory (IDEA-0014)
  renders utilization.

## Risk assessment

- Benchmark theater: block metrics must be reproducible (CI benchmark harness)
  or they become marketing numbers.

## Where it lands

- Design doc `design/COGNITIVE-SILICON.md`; extends the ADR-004 registry.

## Code impact

- None initially; benchmark harness over existing virtual-CPU blocks is the
  minimal prototype.

## Next stage

Benchmark harness for the existing virtual-processor blocks; publish honest
numbers before designing new blocks.
