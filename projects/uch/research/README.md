# Cognitive Operating System Research Program

## Status

**Phase I: active research.** This repository does not yet have an approved
runtime architecture. The adjacent `../design/ARCHITECTURE.md` is a valuable
vision and hypothesis dossier, not an implementation specification or a record
of settled technical decisions.

The research target is a **Cognitive Operating System (COS)**: a portable,
model-agnostic cognitive substrate in which memory supports the ongoing
construction, testing, and revision of bounded world models. It is not a claim
to reproduce consciousness, nor a promise that software can eliminate LLM
hallucinations.

## Research outcomes

Before a production Cognitive Kernel is designed, Phase I must produce:

1. A versioned Cognitive Constitution: a shared, testable ontology for facts,
   beliefs, evidence, concepts, goals, skills, mistakes, confidence, trust,
   and uncertainty.
2. An evidence ledger and object lifecycle model that preserves source episodes,
   supports correction and deletion, and prevents cross-project or cross-user
   contamination.
3. A comparative map of biological principles, AI memory systems, knowledge
   representation, databases, operating systems, human learning, and safety.
4. A falsifiable benchmark suite for grounding, temporal updates, recall,
   planning, learning, provenance, privacy, and adversarial memory retrieval.
5. Explicit decision records for every proposed kernel mechanism, language,
   datastore, protocol, and interface.

The target is a curated research corpus of approximately 300–600 pages of
source-linked notes. Page count is a progress indicator, not a quality metric:
each adopted mechanism needs direct evidence, a failure mode, an experiment,
and a measurable success criterion.

## Research map

| Track | Directory | Core question |
| --- | --- | --- |
| T01 Biological principles | `biology/` | Which computational principles transfer without pretending to copy biology literally? |
| T02 AI memory systems | `ai-memory/` | What mechanisms improve long-horizon utility and where do they fail? |
| T03 World models and continual learning | `world-models/` | How should episodes update predictive models without fabricating facts? |
| T04 Knowledge representation | `knowledge/` | How are concepts, causality, uncertainty, hierarchy, and time represented? |
| T05 Storage and retrieval | `databases/` | Which persistence, index, transaction, and replication guarantees are needed? |
| T06 Cognitive scheduling | `os/` | How should attention, consolidation, and compute budgets be arbitrated? |
| T07 Learning and creativity | `learning/` | Which mechanisms reliably improve procedures, taste, and transfer? |
| T08 Trust, safety, and governance | `security/` | How are poisoning, privacy, consent, and autonomous mutation controlled? |
| T09 Evaluation science | `evaluation/` | What would prove that a component actually helps? |
| T10 Interoperability | `interfaces/` | What stable contracts let models, agents, IDEs, and SDKs change independently? |

## Research-note contract

Every substantive note must distinguish:

- **Evidence** — directly supported by a primary source, experiment, or
  reproducible measurement.
- **Inference** — a reasoned conclusion from evidence, marked as such.
- **Hypothesis** — a proposed COS mechanism with a falsification test.
- **Decision** — an approved choice with alternatives and consequences.

Use the template in [RESEARCH_GOVERNANCE.md](RESEARCH_GOVERNANCE.md). Never
store secrets, private chain-of-thought, or unsupported claims in research or
operational memory.

## Starting corpus

- [Cognitive Constitution v0.1](foundations/01-cognitive-constitution.md)
- [Cognitive Biology v0.1](foundations/02-cognitive-biology.md)
- [Cognitive Physics v0.1](foundations/03-cognitive-physics.md)
- [Cognitive Protocol v0.1](foundations/04-cognitive-protocol.md)
- [Bounded world models](world-models/bounded-world-models.md)
- [Knowledge compiler](knowledge/knowledge-compiler.md)
- [Universal Cognitive Harness](interfaces/universal-cognitive-harness.md)
- [AI-memory comparative note](ai-memory/2026-memory-systems.md)
- [Biological consolidation note](biology/systems-consolidation.md)
- [Universal cognitive interoperability note](interfaces/universal-cognitive-interoperability.md)
- [Evidence register](EVIDENCE_REGISTER.md)
- [Research governance and design gates](RESEARCH_GOVERNANCE.md)
- [Original broad research inventory](RESEARCH_PLAN.md)
