---
track: T03
status: consolidated
date: 2026-07-31
sources:
  - https://arxiv.org/abs/2310.08560 (MemGPT)
  - https://arxiv.org/abs/2504.13171 (Sleep-time Compute)
  - https://www.letta.com/blog/sleep-time-compute
  - https://www.letta.com/blog/memory-blocks
  - https://arxiv.org/abs/2504.19413 (Mem0)
  - https://arxiv.org/abs/2501.13956 (Zep / Graphiti)
  - https://arxiv.org/abs/2405.14831 (HippoRAG)
  - https://arxiv.org/abs/2410.10813 (LongMemEval)
  - https://arxiv.org/abs/2402.17753 (LOCOMO)
  - https://arxiv.org/abs/2404.13501 (Survey: Memory Mechanisms of LLM Agents)
  - https://arxiv.org/abs/2603.07670 (Survey: Memory for Autonomous LLM Agents, 2026)
  - https://arxiv.org/abs/2305.10250 (MemoryBank / Ebbinghaus)
  - https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
  - https://arxiv.org/abs/2503.03704 (MINJA memory injection)
  - https://arxiv.org/abs/2604.02623 (eTAMP trajectory memory poisoning)
  - https://genai.owasp.org/ (OWASP ASI06)
  - https://arxiv.org/abs/2502.12110 (A-MEM)
  - https://arxiv.org/abs/2505.05083 (ACT-R declarative memory)
  - https://wiki.opencog.org/w/OpenCogPrime:AttentionAllocation (ECAN)
  - https://benchd.ai/benchmarks (independent memory benchmark results)
---

# AI Memory Systems — The Exhaustive Landscape (2023-2026)

## 0. Executive Summary

This document consolidates deep research on every significant AI memory
framework, benchmark, failure mode, neuroscience foundation, and production
practice relevant to building a state-of-the-art persistent memory system for
autonomous agents. It is the evidence base for the MNEMOSYNE design document
(`memory-supremacy-design.md`).

**Headline findings:**

1. **No existing system is complete.** Each excels at one axis and fails at
   another. Mem0 extracts claims but creates durable falsehoods. Zep/Graphiti
   builds beautiful temporal graphs but is heavy. Letta manages context but its
   memory can be corrupted by the agent itself. HippoRAG nails associative
   recall but has no consolidation or forgetting. The best system combines
   their mechanisms — which is the point of this design.
2. **Structured memory beats raw context — decisively.** Zep scores 71.2% on
   LongMemEval with ~1.6K context tokens vs 60.2% for the 115K-token full
   conversation. More context is *not* better memory; context rot is real
   (Anthropic).
3. **Benchmarks are unreliable when self-reported.** Bench'd independently
   measured Mem0's open-source edition at 32.4% on LongMemEval vs Mem0's
   self-reported 93.4%. A plain GPT-4o-mini with NO memory layer scored 57.6% —
   higher than LangChain (59.0%... marginally below) and Mem0 OSS. A memory
   system that cannot beat the no-memory baseline is noise.
4. **Memory poisoning is the existential threat.** OWASP added Memory and
   Context Poisoning as ASI06 to the Agentic AI Top 10 (2026). MINJA attacks
   exceed 95% injection success. Session-summarization poisoning can silently
   rewire an agent's memory. Trust gates are not optional.
5. **Human memory science provides the missing algorithms.** ACT-R's
   base-level activation (power-law decay + recency + frequency) is a
   mathematically principled retrieval ranking. ECAN's STI/LTI attention
   economy is a principled retention policy. Complementary Learning Systems
   theory is the correct dual-store architecture. Schacter's seven sins show
   which "forgetting" behaviors are features, not bugs.

---

## 1. Taxonomy: What "Memory" Means for an Agent

From the canonical surveys (Zhang et al. 2024/TOIS; Du et al. 2026), agent
memory is classified along three dimensions:

- **Temporal scope**: working (in-context), short-term (session), long-term
  (cross-session, persistent)
- **Representational substrate**: raw transcripts, episodes, claims/facts,
  entities+relations (graphs), notes (Zettelkasten), procedural rules,
  summaries, embeddings
- **Control policy**: who decides what is stored/retrieved — the LLM itself
  (MemGPT self-editing), a background process (sleep-time compute), a fixed
  pipeline (Mem0's extraction), or the developer (file-based context)

The 2026 survey formalizes memory operations as: **encoding, storing,
consolidation, retrieval, forgetting, updating**.

**The deep insight from UCH's own synthesis still holds and is reinforced by
the 2026 literature: memory is not the center of cognition — the world model
is. Memory exists to feed, update, and be corrected by a predictive model of
reality.** Retrieval quality is judged by whether the agent acts better, not
by recall metrics alone (MemoryArena, Bench'd).

---

## 2. System-by-System Deep Dive

### 2.1 MemGPT / Letta — the OS-style context manager

**Mechanism.** Three-tier memory: *core memory* (always in context, typed
memory blocks — persona block, human block, custom blocks with character
limits), *recall memory* (full conversation history, searchable), *archival
memory* (external, hybrid BM25+vector). The agent calls `core_memory_replace`
/ `core_memory_append` to self-edit its own context. Letta v1+ (2025) adds
*memory blocks as first-class objects* shared between agents, and **sleep-time
compute** (arXiv 2504.13171): a background sleep-time agent with its own
context rewrites the primary agent's memory blocks asynchronously, off the
critical path, and can use a stronger model (e.g. Sonnet for the sleeper,
mini for the conversational agent).

**Evidence.** Sleep-time compute cuts test-time compute ~5x at equal accuracy
and adds up to 13-18% accuracy on Stateful GSM/AIME; 2.5x lower cost per query
with multi-query amortization.

**Weaknesses.**
- Original MemGPT bundled memory management into the agent loop: slower and
  less reliable (fixed by sleep-time agents, but then the memory writer never
  sees live interaction).
- Core memory can be stale, oversized, or agent-corrupted (self-editing is
  both feature and liability — the agent can write lies or injections into its
  own persona).
- Memory formation is incremental → messy, disorganized long-term memory.

**Transferable mechanisms.** Memory blocks as typed, labeled, budgeted context
sections; background sleep-time consolidation with a stronger model; context
"compilation" from DB state with templating.

### 2.2 Mem0 — the extraction-based memory layer

**Mechanism.** An LLM "Memory Evaluator" extracts salient facts/preferences
from each message, then a pipeline decides add/update/delete vs no-op:
detects contradictions and *updates* existing memories instead of appending
conflicting copies. Hybrid storage: vector (semantic), graph (entity
relations for multi-hop), KV (exact lookups), with a routing layer selecting
backend per query. Multi-level scoping: user_id, agent_id, run_id/session.
2025-2026 "Memory 2.0" adds hierarchical memory layers (core/working/archival)
and "single-pass hierarchical distillation"; claims are benchmarked on LoCoMo,
LongMemEval, BEAM. Claims 40-95% token reduction.

**Weaknesses.**
- **Extraction errors become durable falsehoods** — the known Mem0 critique.
  A wrong extraction is stored permanently; there is no episode-level ground
  truth to re-check.
- LLM-in-the-loop on every write: cost and latency.
- MD5 dedup misses semantic duplicates (older versions).
- **Bench'd independently measured Mem0 OSS at 32.4% on LongMemEval vs
  self-reported 93.4%** — an order-of-magnitude gap between managed and OSS
  versions; claims must be treated skeptically.
- Scoping is coarse: no cross-project context isolation for coding agents.

**Transferable mechanisms.** Update-not-append contradiction handling;
entity-centric memory with multi-hop retrieval; multi-axis scoping; hybrid
routing across vector/graph/KV.

### 2.3 Zep / Graphiti — the temporal knowledge graph

**Mechanism.** Graphiti builds a three-tier graph: **episode subgraph**
(immutable conversation segments), **semantic entity subgraph** (entities +
facts with **bi-temporal edges**: valid_at/valid_invalid on the T timeline =
event time, T' timeline = ingestion/audit time), **community subgraph**
(clusters of related entities). Retrieval: hybrid semantic (cosine) + BM25 +
BFS graph traversal, then RRF + MMR + cross-encoder reranking, then a
"constructor" that formats facts with temporal validity into a compact context
string. Automatic fact invalidation on contradiction; non-lossy history with
bidirectional episode↔semantic indexing (every derived fact is traceable to
source episodes).

**Evidence (paper, primary).** 94.8% on Deep Memory Retrieval (gpt-4-turbo);
on LongMemEval: 71.2% accuracy with ~1.6K context tokens vs 60.2% for 115K
full context, with ~90% latency reduction — the single most cited result in
the field, and the definitive proof that **structured, temporal, compact
memory beats raw long context**.

**Weaknesses.** Entity resolution is costly and fallible; graph maintenance
complexity; LLM extraction cost at ingestion; overkill for simple use cases;
temporal KG alone does not solve "sense-making" or skill/procedural memory.

**Transferable mechanisms.** Bi-temporal edges with auto-invalidation;
episode→semantic provenance chains; community clustering; the
search→rerank→construct retrieval pipeline; non-lossy design.

### 2.4 HippoRAG 1 & 2 — the hippocampal index

**Mechanism.** Maps hippocampal indexing theory (Teyler & DiScenna 1986):
neocortex = LLM + passage store; parahippocampus = retrieval encoders (entity
linking, synonymy detection); **hippocampus = schemaless knowledge graph +
Personalized PageRank**. Offline: LLM OpenIE extracts triples → KG. Online:
query entities seed PPR; probability mass spreads through graph; passages are
ranked by aggregated PPR score → **single-step multi-hop retrieval**. HippoRAG
2 adds KG-constrained decoding at query time to reduce hallucinated links.

**Evidence.** Up to +20% over SOTA RAG on multi-hop QA; 10-30x cheaper and
6-13x faster than iterative retrieval (IRCoT); combinable for further gains.

**Weaknesses.** Research framework, not a full memory system: no consolidation,
no forgetting policy, no temporal invalidation, no user scoping, no security
gate. KG construction cost. Entity resolution drift.

**Transferable mechanisms.** PPR over a concept/entity graph as the associative
retrieval primitive; index-vs-store separation (cheap index pointing into
rich store — pattern completion from partial cues).

### 2.5 A-MEM — agentic Zettelkasten

**Mechanism.** Episodes → structured notes with typed relations (caused,
influenced, references, relates) and links; notes are created, edited, and
linked dynamically as new evidence arrives; graph grows as an evolving
conceptual network.

**Weaknesses.** Unconstrained link growth → opaque self-reinforcing graphs;
no forgetting; no temporal validity; note drift and contradictory notes can
coexist silently.

**Transferable mechanism.** Notes as living, editable, linked objects with
explicit relation types — good for "concept evolution" but only with an
invalidation/consolidation layer on top.

### 2.6 MemoryBank (Ebbinghaus-inspired)

**Mechanism.** Three-part pipeline: conversation log storage, hierarchical
event summaries, evolving user personality profile. Retrieval uses the
**Ebbinghaus forgetting curve** to weight memory recency, plus a "memory
retrieval" mechanism that imitates human memory decay. SiliconFriend variant
uses ChatGPT for memory generation.

**Transferable mechanism.** Explicit forgetting-curve weighting at retrieval
time; personality profile as a persistent user model.

### 2.7 MemMachine

**Mechanism.** Keep raw episodes (non-lossy); do not destructively extract;
retrieve episodes with contextual expansion at recall time (whole-episode
context rather than extracted fragments).

**Weakness.** Raw episode retention = cost, privacy, and search challenges.

**Transferable mechanism.** The principle that **derived memories must always
be traceable to source episodes**; ground truth never destroyed.

### 2.8 MemGate

**Mechanism.** Query-conditioned trust gating between retrieval and the model:
recall requires relevance + scope + security admission, not similarity alone.

**Weakness.** Learned gates can fail silently; needs adversarial evaluation.

**Transferable mechanism.** The **admission gate** — nothing retrieved enters
context without passing scope/trust/temporal admission. (This is now a
security requirement, not a nice-to-have; see §5.)

### 2.9 GraphRAG / LazyGraphRAG / LightRAG

**Mechanism.** Full-corpus entity/relation extraction → graph → community
detection → hierarchical community summaries for global Q&A. LazyGraphRAG
(2025) defers expensive indexing for a cheap vector fallback on small queries.

**Lesson.** Graph memory is an index and reasoning aid, **never a substitute
for source evidence**; offline/global queries benefit, live memory does not.

### 2.10 Cognee (ECL)

**Mechanism.** Extract (entities/relations/events via LLM), Cognify (build
knowledge graph + embeddings + hierarchical summaries), Load (query via
graph traversal + vector). Explicit "memory is a graph + vector + summary"
pipeline with provenance.

**Transferable mechanism.** The ECL separation; layered representations of the
same source (raw → graph → summary) all kept in sync.

### 2.11 MemoryScope (Alibaba)

**Mechanism.** Memory as a *tool*: agents explicitly call memory creation,
update, reflection tools; event-driven memory management, memory recall and
forgetting with explicit instructions.

**Transferable mechanism.** Making memory operations first-class tools gives
the agent agency over its own memory — but must be gated (see MemGPT's
corruption risk).

### 2.12 G-Memory (multi-agent)

**Mechanism.** Three-tier graph hierarchy for multi-agent systems: insight
graph (high-level conclusions), query graph, interaction graph.

**Transferable mechanism.** Explicit hierarchy of abstraction levels in memory
(specific interactions → repeated patterns → insights).

### 2.13 Microsoft Agent Memory API & the "levels" view

**Mechanism.** Managed memory service (user/agent memory objects with APIs),
plus MSR's "Hitchhiker's Guide to Memory" positioning: raw text → extraction →
structured knowledge → semantic layers → world models. Agent Memory benchmark
from Microsoft evaluates memory against agentic tasks.

**Transferable mechanism.** Memory as a *platform service* with consistent API
and governance; the abstraction ladder (text → facts → semantics → models).

### 2.14 ExoMemory & others (research wave 2025)

- **ExoMemory** (ETH 2025): "externally stored memories" for LLM agents,
  retrieval-informed routing of context.
- **MAGE / LAM / Trajectory-Informed Memory** (IBM 2026): generate memories
  from agent trajectories, self-improving loop — trajectories become the
  training data of the memory system itself.
- **Memento** (2025): fine-tune-free agent memory via retrieval of past
  experiences.
- **MAPLE** (2026): sub-agent architecture for memory/learning/personalization
  using hippocampal indexing principles.

**Shared pattern.** The 2025-2026 frontier converges on: episodic trajectories
as ground truth, derived memory objects, background/sub-agent consolidation,
and retrieval that uses graph + vector + temporal together.

### 2.15 OpenCog ECAN — attention economics (the forgotten classic)

**Mechanism.** Every atom in the AtomSpace carries **STI (short-term
importance)** and **LTI (long-term importance)** as artificial currencies.
STI = CPU/attention allocation, LTI = retention (what gets swapped to disk /
deleted), VLTI = very-long-term (archive vs delete). Importance spreads through
Hebbian links; forgetting = lowest-LTI eviction; attention focus = top-STI
set. Crucially, this separates *accessibility* (STI, fast-changing) from
*retention* (LTI, slow-changing) — exactly the working/long-term split, but
formalized as an economy with conservation rules.

**Why it matters.** It is the only mature framework that treats *forgetting
and retention as a resource-allocation problem* rather than an afterthought —
and it combines naturally with ACT-R activation for the ranking side.

---

## 3. Comparison Matrix

| System | Substrate | Temporal | Retrieval | Consolidation | Forgetting | Security | Token-econ | Provenance | Readiness |
|---|---|---|---|---|---|---|---|---|---|
| MemGPT/Letta | blocks + transcript | session/context | BM25+vector | sleep-time agent | context eviction | none (agent-corruptible) | excellent (paged context) | weak | production |
| Mem0 | claims + graph + KV | recent-biased | hybrid + routing | update-on-contradiction | none explicit | scoping only | strong | weak (falsehood risk) | production |
| Zep/Graphiti | 3-tier temporal KG | bi-temporal | semantic+BM25+BFS+rerank | auto-invalidation | edge invalidation | none | strong (1.6K tokens!) | excellent | production |
| HippoRAG | schemaless KG | static | PPR | none | none | none | strong (single-step) | medium | research |
| A-MEM | note graph | none | graph+vector | dynamic note edits | none | none | medium | weak | research |
| MemoryBank | summaries+profile | recency curve | curve-weighted | hierarchical summaries | Ebbinghaus | none | medium | weak | research |
| MemMachine | raw episodes | full | contextual retrieval | none (non-lossy) | none | none | poor | excellent | research |
| MemGate | any | none | gate admission | none | none | **trust gate** | medium | medium | research |
| Cognee | graph+vector+summary | partial | hybrid | ECL pipeline | none | none | medium | good | early |
| G-Memory | 3-tier graph | session | graph | hierarchical | none | none | medium | medium | research |
| MS Agent Memory | managed objects | service-level | platform | platform | platform | platform | strong | good | platform |
| ECAN (OpenCog) | hypergraph atoms | STI/LTI/VLTI | attention-spread | Hebbian learning | **LTI eviction** | none | medium | medium | research |
| ACT-R declarative | chunks | access history | **activation = f(recency,frequency,context)** | base-level learning | power-law decay | none | n/a | n/a | cognitive arch |

**Readiness legend**: production = shipped and used by real products; early =
usable but immature; research = paper/code only; platform = vendor service;
cognitive arch = classical cognitive architecture.

---

## 4. Benchmarks and What They Actually Measure

### 4.1 LongMemEval (ICLR 2025, UCLA/Tencent/UCSD)
500 questions across 5 core abilities, embedded in scalable multi-session
chat histories:
1. **Information extraction** — find facts buried in history
2. **Multi-session reasoning** — synthesize across sessions
3. **Temporal reasoning** — order and time of events
4. **Knowledge updates** — recognize when facts changed
5. **Abstention** — say "I don't know" rather than hallucinate

Commercial assistants and long-context LLMs drop ~30% accuracy on sustained
interactions. **LongMemEval-V2 (2026) extends to agentic contexts** — memory
for agents that act, not just chat.

### 4.2 LOCOMO (Snap/UNC/USC)
1,540 questions over 300-turn, 9K-token, up-to-35-session conversations with
grounded event graphs; tasks: QA, event summarization, multimodal dialogue
generation. Mem0 (66.9-68.5%) beat OpenAI native memory (52.9%) here.

### 4.3 Independent verification — the reality check (Bench'd, May 2026)
- GPT-4o-mini, **no memory layer**: 57.6% on LongMemEval
- LangChain: 59.0%; LlamaIndex: ~59.x%
- Mem0 OSS (independent): **32.4%** — worse than no memory at all
- Mem0 managed (self-reported): 93.4%

**Design rule extracted**: a memory layer must demonstrably beat the
no-memory baseline on *agentic* tasks (MemoryArena-style), and all internal
benchmarking must be against ground truth, not self-claims.

### 4.4 Deep Memory Retrieval (Zep's)
Measures point retrieval of facts from long histories: Zep 94.8% (gpt-4-turbo).

### 4.5 Metric taxonomy for our own evaluation harness
- Retrieval: recall@k, precision@k, MRR, nDCG
- Freshness: stale-answer rate, update-latency
- Consistency: contradiction rate over time, belief-version drift
- Temporal: event-ordering accuracy, interval accuracy
- Abstention: false-positive answer rate (hallucination proxy)
- Token economy: tokens-per-query, tokens-per-memory-write, evidence-packet size
- Cost: $ per episode ingested, $ per 1K queries
- Security: injection success rate, cross-scope leak rate
- Utility: task-completion delta vs no-memory baseline (the only metric that matters)

---

## 5. Failure Modes, Pitfalls, and the Security Threat Model

### 5.1 Functional pitfalls (documented in literature + production reports)
1. **Stale facts accumulate** without invalidation → agents confidently repeat
   outdated information. (Fix: bi-temporal validity + contradiction detection.)
2. **Extraction falsehoods become durable** — a single mis-extraction lives
   forever (Mem0 critique). (Fix: provenance chains to episodes, re-verification
   during sleep, confidence decay without re-confirmation.)
3. **Entity resolution drift** — same entity, multiple nodes; graph becomes
   fragmented. (Fix: synonymy detection à la HippoRAG's PHR, canonicalization
   during consolidation.)
4. **Embedding-only recall loss** — semantic similarity misses exact names,
   IDs, error codes. (Fix: hybrid BM25+vector, RRF fusion.)
5. **Context pollution** — irrelevant retrieved memories actively degrade
   answers (lost-in-the-middle, context rot). (Fix: strict admission gates,
   small high-signal evidence packets.)
6. **Over-consolidation destroys ground truth** — summaries replace evidence.
   (Fix: derived-cognition-always-linked-to-source; never destructive.)
7. **Cost blowups** — LLM-in-the-loop on every write, graph maintenance,
   embeddings. (Fix: write-once amortization, sleep-time batching, small-model
   extraction with strong-model verification.)
8. **Cross-user/cross-project leakage** — memory bleeding between contexts.
   (Fix: mandatory scope keys on every memory + query-side scoping.)
9. **No forgetting** → memory becomes noise floor (MemGPT "messy memory").
   (Fix: ACT-R decay + ECAN LTI eviction + archival tiers.)
10. **Aggressive forgetting** → lost critical facts. (Fix: importance-weighted
    retention, VLTI archive tier, never hard-delete high-LTI.)
11. **Abstention failure** — memory systems answer with partial/confabulated
    recall instead of saying "unknown". (Fix: confidence thresholds, explicit
    unknown-state, retrieval-uncertainty signaling.)
12. **Self-report delusion** — systems benchmarked on their own harness score
    far above independent results. (Fix: external-standard evaluation.)

### 5.2 Security: memory poisoning (OWASP ASI06, 2026)
Memory poisoning = persistent prompt injection: malicious content written to
memory in session A activates in session B, possibly months later.

Attack families and evidence:
- **MINJA** (arXiv 2503.03704): query-only injection via indication prompts +
  bridging steps + progressive shortening; **>95% success** across agents;
  attacker never touches storage.
- **eTAMP** (arXiv 2604.02623): malicious instructions embedded in web content
  get ingested into raw trajectory memory; later retrieved cross-site;
  exploits GPT-5-class models at 23.4% ASR even in the worst case.
- **AgentPoison**: poison rate <0.1%, ASR ≥80%, no model retraining.
- **Unit 42 PoC**: indirect prompt injection via *session-summarization
  manipulation* — the summarizer itself writes the poison into long-term
  memory. This is a direct attack on our sleep-time consolidation design;
  the consolidation agent must be treated as a write path needing its own
  screening.
- Agent Security Bench: highest average ASR 84%.

**Required controls (from ASI06 + literature):**
1. **Write-path screening** — sanitize/filter content before persistence;
   never persist raw untrusted environment content verbatim.
2. **Provenance + trust scoring** on every memory (source reliability, scope,
   ingestion path).
3. **Scope isolation** — per-user/agent/project/session memory namespaces.
4. **Retrieval-time anomaly detection** — flag memories that are
   instruction-like, anomalous, or from low-trust sources; gate admission.
5. **Forensic audit trail + rollback snapshots** — detect poisoning via
   cross-session correlation; restore known-good state.
6. **Separation of control paths** — memory-writer (sleep) must not trust the
   conversational agent's outputs blindly; the agent must not be able to edit
   its own core memory without gates (Letta's fix).

### 5.3 The "seven sins" framing for AI memory
Schacter's seven sins of human memory, re-read for agents:
- *Transience* (decay) — **feature**: enables freshness; implement as ACT-R decay
- *Absent-mindedness* (encoding failure) — **feature**: we should not encode
  everything; implement as importance-gated encoding
- *Blocking* (retrieval failure) — pitfall: add multi-signal retrieval
- *Misattribution* (wrong source) — pitfall: provenance everywhere
- *Suggestibility* (post-event distortion) — pitfall: reconsolidation without
  evidence → guard with source anchoring
- *Bias* (distortion by prior beliefs) — pitfall: contradiction handling must
  be evidence-driven, not activation-driven
- *Persistence* (unwanted remembering) — pitfall for us: unwanted memories
  pollute context → fix with gated admission

---

## 6. Neuroscience and Cognitive Architecture Foundations

### 6.1 Complementary Learning Systems (McClelland, McNaughton, O'Reilly 1995)
Two learning systems with different rates:
- **Hippocampus**: fast, sparse, one-shot episodic encoding; supports pattern
  separation (distinct representations for distinct experiences) and pattern
  completion (recall from partial cues).
- **Neocortex**: slow, distributed, statistical learning; extracts generalities
  through **interleaved replay** of hippocampal episodes (prevents catastrophic
  forgetting).

**AI mapping**: append-only episodic store (fast, cheap, lossless) +
consolidated semantic store (slow, batched, statistical) + sleep-time replay
that re-encodes episodes into the semantic layer. This is the correct
dual-store architecture and validates UCH's existing kernel design — the
missing piece is the *quality* of consolidation (LLM-mediated, provenance-
anchored).

### 6.2 Hippocampal Indexing Theory (Teyler & DiScenna 1986)
Hippocampus stores sparse **indices** pointing into neocortical patterns, not
the patterns themselves; recall = pattern completion via index activation.
**AI mapping**: cheap concept/entity index (graph) over a rich episode store;
retrieval = graph-based activation spreading (PPR) + direct similarity — the
HippoRAG insight, generalized with bi-temporal edges and trust metadata.

### 6.3 ACT-R Declarative Memory (Anderson) — the formal retrieval math
The complete activation model:
```
A_i = B_i + Σ_j W_j·S_ji + ε          (total activation)
B_i = ln(Σ_k t_k^-d)                  (base-level: power-law decay, d≈0.5)
W_j = W/n                             (attentional weights, n = active context elements)
S_ji ≈ log(P(i|j)/P(i)) ≈ S - log(fan_j)  (associative strength, fan-penalized)
P(retrieve i) = 1/(1 + e^-(A_i - τ)/s)     (logistic retrieval probability)
T = F·e^(-f·A_i)                      (retrieval latency)
```
- d = 0.5: contribution halves when time quadruples — "rapid early forgetting,
  slow late forgetting"; d ∈ {0.3 slow, 0.5 standard, 0.7 fast} per domain.
- Base-level tracks the **log-odds a memory will be needed** (rational
  analysis, Anderson & Schooler 1991) — retrieval ranking as probability
  estimation.
- Spreading activation = contextual relevance; fan effect: memories tied to
  many contexts lose per-context strength (S - log(fan)).
- Spacing effect: massed presentations < spaced ones (base-level is not
  additive under massing).

**AI mapping**: every memory record tracks access timestamps; retrieval rank =
activation (semantic similarity is the *cue*, activation is the *priority*);
forgetting = decay to archival tiers; retrieval reinforces (each access adds a
term) — mirroring the testing effect.

### 6.4 ECAN Attention Economics (Goertzel et al.)
- **STI** (short-term importance) = current relevance; drives context
  admission (what the agent "attends to").
- **LTI** (long-term importance) = expected future usefulness
  P(useful in future); drives retention (what survives consolidation).
- **VLTI** = archive-vs-delete decision.
- Importance flows through Hebbian links; forgetting = evict lowest-LTI.

**AI mapping**: our retention/eviction policy is an economy: memory competes
for a budget; importance is earned (access, reward, user feedback, prediction
success) and spent (decay, evidence against). This is how we get "learns ROI"
behavior — memories that get retrieved and *used successfully* earn LTI;
memories that are retrieved and ignored lose it.

### 6.5 Neuromodulation → meta-parameters (already in UCH synthesis, validated)
ACh→learning rate, NE→exploration, 5-HT→discount, DA→reward sensitivity.

### 6.6 Sleep and consolidation
- NREM sharp-wave ripples replay hippocampal episodes to neocortex; REM
  integrates; synaptic homeostasis prunes noise. 
- **Reconsolidation**: reactivated memories become labile and can be updated —
  but this is also the suggestibility vulnerability: updates must be
  evidence-anchored (source episode + confidence threshold).
- Sleep-time compute (Letta) is the engineering embodiment: off-critical-path,
  stronger model, batched, ammortized.

### 6.7 Ebbinghaus + spacing + testing effects
Forgetting curve weighting at retrieval; spaced reinforcement (retrieval
schedules for critical facts); retrieval strengthens (test effect → access
history as strength).

---

## 7. Industry Production Practice (the "context engineering" canon)

### 7.1 Anthropic — Effective context engineering (Sep 2025)
- **Context rot**: performance degrades as token count grows; attention budget
  is finite; "smallest set of high-signal tokens that maximize desired
  outcome" is THE objective function.
- **Compaction**: summarize near-full context; preserve decisions/bugs/details,
  drop redundant tool outputs; tune prompt for recall-then-precision.
- **Structured note-taking (agentic memory)**: notes persisted outside context,
  pulled back later — Claude Code to-do lists, NOTES.md; the Pokémon-playing
  Claude developed maps, key-event tallies, and strategy notes autonomously
  and survived context resets.
- **Just-in-time context**: keep lightweight identifiers (paths, queries) in
  context; load data via tools at runtime — human-like "external
  organization" (files, bookmarks) rather than memorization.
- **Progressive disclosure**: agents assemble understanding layer by layer;
  metadata (names, timestamps, sizes) as cheap relevance signals.
- **Memory tool** (Sonnet 4.5 era): file-based store/consult outside context.
- **Sub-agents**: isolate exploration in subagent contexts, return 1-2K-token
  distillations.
- **Hybrid**: CLAUDE.md in-context up front + glob/grep just-in-time.

### 7.2 Anthropic — Contextual retrieval (Sep 2024)
Before embedding/BM25, prepend LLM-generated context (chunk summary +
top-level doc context). Result: **-49% retrieval failures**; combined with
reranking → -67%. **This is a mandatory technique**: our chunks must be
contextualized at write time, not raw.

### 7.3 Anthropic — Memory banks ("Write once, use many times", 2025)
Three canonical memory banks for coding agents:
1. **User memory bank** — preferences, standards, personal style
2. **Workspace memory bank** — current task state, progress, decisions
3. **Codebase memory bank** — architecture, conventions, gotchas
With freshness practices: update after use, prune stale entries, keep
distinctions clear (rules vs state), validate against codebase changes.

### 7.4 Google DeepMind — "Practical memory for agents" (2025)
- Memory forms: **episodic** (what happened), **semantic** (facts about the
  world/user), **procedural** (how to do things) — the three declarative/
  procedural split; each needs different retention (episodic decays, semantic
  persists, procedural is sticky).
- Dynamic token budgets; context caching economics; when long-context beats
  RAG (small corpora, single session) and vice versa (large corpora,
  cross-session).
- "Procedural memory needs infinite half-life; episodic needs 30-day decay"
  (community convergence with the science).

### 7.5 OpenAI / Codex / ChatGPT
- Codex cloud memory: persistent memories + AGENTS.md read before work;
  memories referenced automatically when relevant.
- ChatGPT memory: user facts, automatic extraction with user visibility and
  deletion controls.
- AGENTS.md convention (OpenAI + Anthropic + industry): file-based context for
  stable project knowledge, loaded at session start.

### 7.6 MCP memory server (official)
Simple knowledge graph (entities/relations/observations) over a JSONL store;
add/delete/search by graph traversal. Minimal but established the pattern of
memory-as-MCP-server. Our system must expose memory as MCP tools too (UCH
already does 24 tools).

### 7.7 File-based vs store-based (Valkey/Mem0 analysis, 2026)
- **File-based context** (CLAUDE.md, rules, AGENTS.md): stable, known-before-
  session guidance. 
- **Store-backed memory**: dynamic, mutable, runtime-learned, scoped,
  auditable. 
- Both are needed; the boundary is stability: *stable → files, dynamic →
  store*.

---

## 8. Reverse-Engineered Principles (the design laws)

From all of the above, distilled:

1. **Ground truth is immutable episodes; everything else is derived and
   traceable.** (MemMachine + Graphiti + HippoRAG)
2. **Bi-temporal everything.** Event time vs ingestion time; validity windows;
   auto-invalidation on contradiction. (Zep)
3. **Consolidation happens off the critical path, with a stronger model, and
   is itself a memory write requiring screening.** (Letta + ASI06)
4. **Retrieval is an admission pipeline, not a similarity search.** Scope →
   trust → candidates (semantic+BM25+graph/temporal) → activation → rerank →
   budgeted packet. (MemGate + Zep + ACT-R + Anthropic)
5. **Small evidence beats big context.** 1.6K tokens beat 115K. (Zep)
6. **Rank by ACT-R activation** (recency, frequency, spacing, contextual
   spreading, fan-penalty), **retain by ECAN economy** (STI admission, LTI
   retention, VLTI archive), **reinforce by use** (testing effect).
7. **Forget by design** — decay, tiering, eviction; episodic fast-decay,
   semantic slow, procedural near-infinite. (Google + ACT-R + ECAN)
8. **Contextualize at write time.** (Anthropic -49%)
9. **Distinguish observed / inferred / speculative; abstain when uncertain.**
   (LongMemEval + hallucination control)
10. **Gate every write path and every read path.** Memory poisoning is the
    threat model; provenance is the shield. (OWASP ASI06)
11. **Memory must earn its tokens.** Budgets, ROI tracking, and demonstrable
    task gains over no-memory baseline. (Bench'd + MemoryArena)
12. **The agent's own memory is a world model.** Facts feed a predictive model
    that anticipates what the agent will need next (sleep-time anticipation,
    multi-query amortization). (UCH synthesis + Letta)
13. **Dynamic meta-parameters** from neuromodulation analogs; the system
    reconfigures itself. (UCH synthesis)
14. **Stable knowledge → files; dynamic knowledge → store.** (industry)
15. **Memory blocks with budgets** for the always-in-context layer. (Letta)

---

## 9. Source Register

Primary: MemGPT (2310.08560), Sleep-time compute (2504.13171), Mem0
(2504.19413), Zep (2501.13956), HippoRAG (2405.14831), LongMemEval
(2410.10813), LOCOMO (2402.17753), survey (2404.13501, TOIS), 2026 survey
(2603.07670), MemoryBank (2305.10250), A-MEM (2502.12110), MINJA (2503.03704),
eTAMP (2604.02623), ACT-R (2505.05083; Anderson 2007), ECAN (Goertzel 2009;
OpenCog wiki), Anthropic context engineering + contextual retrieval + memory
banks, Google DeepMind practical memory, Bench'd benchmark guide, OWASP ASI06,
Neo4j Graphiti analysis, Unit 42 memory poisoning PoC, vectorize.io memory
poisoning analyses.
