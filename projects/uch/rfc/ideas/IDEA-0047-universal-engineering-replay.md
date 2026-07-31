# IDEA-0047 — Universal Engineering Replay (UER)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "the one feature that could
  define UCH: every interaction across VS Code, Claude Code, Codex,
  OpenCode, JetBrains, Copilot, terminal, git, browser, and MCPs is
  captured as a causal engineering graph, not just logs. Queries:
  'every decision that eventually led to this bug', 'replay the exact
  reasoning that produced this architecture', 'when did our
  authentication philosophy change', 'every conversation, benchmark,
  experiment, and commit that influenced this API'"
- **Related:** ADR-002 (OTel trace engine + W3C traceparent — the
  causal spine), cognitive replay + time machine, CIC (episode
  envelopes), src/drivers (per-host adapters), trace recorder
  (remote-parent continuation), Law 12 (Reversibility)

## Motivation

Every host today preserves its own chats, edits, and tasks in separate
silos. The claim: one cross-environment causal engineering graph —
every host becomes a driver emitting normalized episode events into
the shared trace ledger with traceparent continuity, so influence
paths ("which decisions led to this bug"), reasoning ancestry ("why
this API"), and philosophy change-points ("when did our auth thinking
shift") become queryable. ADR-002 already supplies the causal spine;
the delta is cross-host capture breadth and the query layer.

## The corpus cannot cover it because

The ledger captures organism-internal events with trace continuity;
per-host drivers exist but the unified causal graph across IDE,
terminal, browser, git, and MCP sessions — plus influence-path and
change-point queries — does not. Current tools keep host-local
history; the delta is one causal graph.

## Proposal sketch

- Drivers emit normalized episode events (CIC envelopes) into the
  shared ledger with traceparent, linking host sessions into one
  trace tree.
- Causal graph: influence edges from trace context + provenance;
  queries: influence-path(target) for bug causality, ancestry(subject)
  for API/architecture lineage, change-point(philosophy) via belief
  diffs over the time machine.
- Causality hygiene: edges are evidence-attached (traceparent +
  provenance), never inferred; archive tiers for growth.

## Risk assessment

- Causality theater: influence edges without evidence are noise;
  every edge must trace to a recorded parent span or provenance ref.
- Storage growth: tiered retention (vmem Archive pattern) required.

## Where it lands

- Extends ADR-002; design doc `design/UER.md`; drivers gain episode
  emission.

## Code impact

- None until the query layer is specified over replay; prototype
  influence-path over existing trace ledger data first.

## Next stage

Prototype an influence-path query over replay with synthetic
multi-tool traces; verify change-point detection on a synthetic
auth-philosophy shift.
