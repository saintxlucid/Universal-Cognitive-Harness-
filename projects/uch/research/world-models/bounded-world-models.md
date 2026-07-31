# Bounded World Models

## Status

**Research specification v0.1.** A world model is a versioned, scoped, and evidence-linked predictive representation. It is not a universal truth store, a personality, or authority to act. This note defines a testable research target; it does not select a runtime, database, or learning algorithm.

## Why the model must be bounded

An agent needs more than retrieved text to make a useful prediction. It needs an explicit account of which variables, relationships, assumptions, and constraints are in scope. That account must remain revisable when the world changes or new evidence contradicts it.

**Inference.** A durable system should distinguish three different things:

| Object | Meaning | Example |
| --- | --- | --- |
| Descriptive claim | What an evidence source asserts | "The test failed at commit X." |
| Predictive belief | A calibrated expectation about a future or unknown state | "This dependency upgrade is likely to break API Y." |
| Normative preference | A user or project value | "Avoid breaking changes during the release freeze." |

No conversion between these classes is automatic. Repeated preferences do not become facts, and a plausible prediction does not become a historical observation.

## Minimum model declaration

Every model version should declare:

- domain, scope, owner, and access policy;
- state variables with types, units, and temporal validity;
- accepted observation and evidence types;
- assumptions, unknowns, and horizon of validity;
- permitted prediction types and calibration measurement;
- evidence and derivation references; and
- update, evaluator, retention, and supersession policy.

This prevents an attractive but untestable narrative from masquerading as a model. A model with no declared scope is not eligible for high-impact use.

## Update lifecycle

```text
observation -> candidate claim -> validation -> model proposal
             -> shadow prediction -> measured outcome
             -> revise | retain | reject | supersede
```

A proposal runs in shadow mode until its predictions can be compared with an outcome. Revision preserves the prior version and a reason for the transition. Deletion, redaction, and access revocation are first-class events that may invalidate downstream derivations.

## Prediction taxonomy

The early evaluator should separately score state predictions, outcome predictions, risk predictions, scoped preference predictions, and counterfactuals. Counterfactuals need especially strong causal assumptions. Accuracy alone is inadequate: calibration, freshness, coverage, abstention, and harm from an incorrect prediction are independent metrics.

## Research hypotheses

| ID | Hypothesis | Falsification test |
| --- | --- | --- |
| WM-H1 | Explicit scope and assumptions reduce cross-project retrieval errors relative to undifferentiated memory. | Compare leakage and task accuracy on partitioned multi-workspace benchmarks. |
| WM-H2 | Shadow-mode promotion improves calibration over immediate consolidation. | Compare calibration and rollback rate under identical observation streams. |
| WM-H3 | Temporal validity and supersession links improve correction handling. | Measure stale-answer rate after source corrections and deletions. |

## Evidence connections

The motivation aligns with continual, structured-memory research and temporal knowledge-graph approaches. The COS declaration and lifecycle are **hypotheses**. They must be tested using the evidence register and evaluation track before becoming an architecture decision.

Relevant sources: [Mem0](https://arxiv.org/abs/2504.19413), [Zep / Graphiti](https://arxiv.org/abs/2501.13956), and [LongMemEval](https://proceedings.iclr.cc/paper_files/paper/2025/file/d813d324dbf0598bbdc9c8e79740ed01-Paper-Conference.pdf).
