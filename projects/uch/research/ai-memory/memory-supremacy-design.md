---
track: T03
status: design
date: 2026-07-31
supersedes: SYNTHESIS.md (memory sections), research/ai-memory/2026-memory-systems.md
related: UCH-COMPLETE-INDEX.md, organism-architecture.md
---

# MNEMOSYNE — The Cognitive Memory Brain

**Design blueprint for the memory supremacy system of UCH.**

Named for the Titaness of memory, mother of the Muses: memory is not a store —
it is the mother of all intelligent behavior. Mnemosyne is the memory system
of the UCH organism, reverse-engineered from every system in the research
landscape (`memory-supremacy-research-2026.md`), grounded in the formal math
of cognitive science (ACT-R, ECAN, CLS, hippocampal indexing), hardened
against the documented failure modes (stale facts, durable falsehoods, memory
poisoning), and architected as a biological organism: every mechanism is an
organ with a role, a budget, and a lifecycle.

---

## 1. Design Philosophy — The Ten Commitments

1. **Ground truth is sacred.** Episodes are immutable. Everything derived
   (claims, concepts, summaries, skills) carries a provenance chain to its
   source episodes. Nothing destructive ever happens to ground truth.
2. **Memory is a two-speed brain.** Fast hippocampal system (episodic,
   sparse, one-shot) + slow neocortical system (semantic, statistical,
   consolidated via replay). Complementary Learning Systems, implemented.
3. **Retrieval is admission, not search.** Nothing enters context without
   passing five gates: scope → trust → candidates → activation → budget.
4. **Attention is an economy.** STI/LTI/VLTI currencies. Memories compete
   for context budget; retention is earned (access, reward, prediction
   success) and spent (decay, disconfirmation). ROI is tracked, not assumed.
5. **Rank like a human brain.** ACT-R activation: recency + frequency +
   contextual spreading, power-law decay (d per memory class), fan-penalty,
   spacing effect. Each access reinforces (testing effect).
6. **Forget by design.** Decay to tiers; archive, never silently delete
   important memories; episodic decays fast, semantic slow, procedural
   near-infinite.
7. **Consolidate while sleeping.** Off-critical-path, batched, stronger model,
   provenance-anchored, contradiction-resolving, reconsolidation-without-
   overwrite. Sleep is a write path: screened like one.
8. **Never hallucinate memory.** Observed / inferred / speculative are
   explicit epistemic states; abstention is a valid answer; confidence is
   calibrated by evidence and corroboration, not by recency.
9. **The enemy is not forgetting — it is poisoning.** Every write path and
   read path is gated. Provenance is the shield; scope is the border;
   anomaly detection is the immune system.
10. **Memory must earn its tokens and prove its worth.** Benchmarked against
    ground truth and against the no-memory baseline. If memory doesn't make
    the agent better, memory is noise.

---

## 2. Architecture Overview

```
                        ┌───────────────────────────────────────────────┐
                        │            AGENT / LLM CONTEXT                 │
                        │  (compiled by Context Compiler, §8)            │
                        └───────────────┬───────────────────────────────┘
                                        │ read                          │ write
              ┌─────────────────────────▼─────────────────────────┐
              │         PARAHIPPOCAMPAL GATE  (§7)                 │
              │  scope check · trust check · anomaly screening    │
              │  instruction-likeness · poisoning detector         │
              └──────┬──────────────────────────────────┬──────────┘
                     │                                   │
        ┌────────────▼─────────────┐        ┌────────────▼─────────────┐
        │   RETRIEVAL CORTEX (§6)   │        │    SENSORY CORTEX (§3)   │
        │  multi-signal fusion      │        │  observations · outcomes │
        │  activation ranking      │        │  artifacts · feedback    │
        │  rerank · packet build   │        │  contextualization       │
        └────────────┬─────────────┘        └────────────┬─────────────┘
                     │                                   │
        ┌────────────▼────────────────────────────────────▼─────────────┐
        │                    LIMBIC CORE (the stores)                   │
        │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
        │  │ HIPPOCAMPUS  │  │ NEOCORTEX    │  │  PROCEDURAL CORTEX   │ │
        │  │ episodic     │  │ semantic     │  │  skills · patterns   │ │
        │  │ immutable    │  │ bi-temporal  │  │  lessons · utilities │ │
        │  │ + sparse idx │  │ KG + claims  │  │  reinforcement-shaped│ │
        │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
        │         │  ACTIVATION & IMPORTANCE LAYER (§5)   │             │
        │         │  ACT-R activation · ECAN STI/LTI/VLTI │             │
        │         └────────── Hebbian association graph ─┘             │
        └─────────────────────────────┬─────────────────────────────────┘
                                      │ replay
                    ┌─────────────────▼──────────────────┐
                    │     SLEEP CYCLE  (§4)              │
                    │  consolidation · contradiction    │
                    │  resolution · reconsolidation     │
                    │  abstraction · pruning ·          │
                    │  anticipation (query prediction)  │
                    └─────────────────┬──────────────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │   NEUROMODULATION & METABOLISM     │
                    │  DA/NE/ACh/5-HT meta-parameters    │
                    │  energy budgets · policy tuning    │
                    └────────────────────────────────────┘
```

Cross-cutting: **Evaluation Harness** (§10) watches every component; the
**Metacognition Loop** (self-critic on memory quality, calibration,
contradiction hygiene) monitors the whole organism.

---

## 3. Sensory Cortex — the Write Path

### 3.1 Ingestion channels
| Channel | Example payload | Epistemic status |
|---|---|---|
| observation | user statement, environment fact | observed |
| tool_call | tool+input+output+error | observed (tool) |
| outcome | task result, success/failure, reward | observed (evaluated) |
| artifact | file diff, project state, workspace snapshot | observed (artifact) |
| feedback | user satisfaction signal, correction | observed (direct) |
| inference | consolidation output, prediction | inferred |
| hypothesis | speculation, model guess | speculative |

### 3.2 Write pipeline (all channels)
1. **Contextualization** (Anthropic contextual retrieval): every chunk is
   annotated at write time with *why it matters* and *what it belongs to*
   (project, task, session) — because embedding raw text loses context.
   Expected effect: ~49% retrieval-failure reduction.
2. **Sanitization** (ASI06): strip/neutralize instruction-like content from
   untrusted channels (web content, tool output from external sources).
   Instruction-likeness score is computed and stored with the episode.
3. **Sparse index generation**: k-WTA hashing → hippocampal-style sparse
   pattern-separated fingerprint (pattern separation).
4. **Embedding**: real semantic embedding (provider or local model), plus
   lexical terms for BM25.
5. **Importance estimate** (ACh-modulated): recency of context, user
   engagement, task progress, emotional/valence markers, explicit user
   emphasis. Used for encoding *strength*, not for retention alone.
6. **Scope stamping**: every memory carries `user`, `agent`, `project`,
   `session`, `task` keys — mandatory, enforced at the store boundary.

### 3.3 Episodic store (Hippocampus)
- Append-only; never mutated, never deleted (only archived).
- Fields: id, type, content (multimodal: text, structured, tool payload,
  image reference, code), timestamp (event time), ingested_at (ingestion
  time), scope keys, provenance (channel, source, reliability), importance,
  sparse fingerprint, embedding, lexical terms, instruction-likeness,
  trust score, access history (timestamps — feeds activation), cross-refs.
- Retention: episodes decay to cold tier by activation; archived episodes
  remain searchable by index (VLTI decides disk vs delete).
- **Ground truth contract**: any derived object must be able to enumerate its
  source episodes; any episode must be able to enumerate its derived objects.

---

## 4. Sleep Cycle — Consolidation (off-critical-path, stronger model)

Runs on idle: after sessions, on schedule, on demand. Sleep phases mirror
biology:

### 4.1 NREM — Replay & Claim Formation
- Replay new episodes (importance-ranked; spaced, not massed).
- **Claim extraction**: LLM (stronger model than the conversational agent)
  extracts atomic claims: `(subject, predicate, object, time, certainty)`.
  Each claim records source episode ids + extraction model + confidence.
- **Dedup & canonicalization**: entity resolution against the semantic graph
  (synonymy detection — HippoRAG PHR analog); merge duplicates; update
  canonical entity embeddings.
- **Contradiction detection**: compare new claims against existing claims
  with overlapping subject+predicate. Outcomes:
  - *Update*: if new evidence is stronger (more sources, more recent,
    higher trust) → **reconsolidation**: old claim gets `invalid_at`, new
    claim gets `valid_at` and supersession link. History preserved.
  - *Conflict unresolved*: claims coexist with a contradiction marker; the
    retrieval layer surfaces both with confidence; the agent sees the
    conflict explicitly (never silently overwrite — UCH constitution).

### 4.2 REM — Abstraction & Pattern Completion
- **Pattern mining**: repeated (sub)episode structures → procedural patterns;
  recurring user behaviors → preference hypotheses (marked inferred until
  confirmed).
- **Summary formation**: hierarchical episode summaries (session → project →
  workspace), each with provenance to its children.
- **Anticipation** (sleep-time compute): given accumulated context, predict
  likely future queries/tasks; pre-compute and pre-warm relevant derived
  context (multi-query amortization — 2.5x cost reduction demonstrated by
  Letta).

### 4.3 Synaptic Homeostasis — Pruning
- Recompute activation for touched memories; demote/promote tiers by
  importance economy (§5).
- Archive low-LTI episodes; merge fragmented entities; drop dead links.
- **Re-verification sweep**: high-importance claims not re-confirmed within
  their decay horizon get confidence decay; stale-claim detector flags
  claims whose subject has newer contradicting evidence.

### 4.4 Sleep security (ASI06 — the Unit 42 lesson)
The sleep-time agent is a **write path**. Its inputs (episodes, prior memory)
are screened for instruction-likeness; its outputs (claims) are:
- never raw copies of untrusted content,
- always provenance-tagged,
- sampled for anomaly (a claim that is instruction-like or scope-inconsistent
  is quarantined to a review list, not promoted).

---

## 5. Activation & Importance Economy

### 5.1 Activation (retrieval ranking) — ACT-R, implemented
For every memory record, maintain `accessTimes[]` and `spreadEdges`.

```
B_i(t) = ln( Σ_k (t - t_k)^-d )            // base-level, per-class decay d
A_i(t) = B_i(t) + Σ_j W_j · S_ji + ε       // + contextual spreading
S_ji   = S₀ - log(fan_j)                    // associative strength, fan-penalized
```

- Decay classes (Google/maenifold guidance):
  - episodic: d = 0.7 (fast — "what happened" fades)
  - working/task state: session-bound (d high, purged at task end)
  - semantic claims: d = 0.5 (standard)
  - procedural skills: d = 0.3 (sticky, near-infinite half-life)
  - core/user identity: d = 0.3 + re-confirmation boost (never decays below
    floor while re-confirmed)
- Spreading: current context entities (from the query/session) spread
  activation through the Hebbian association graph — memories semantically
  related to the current task get boosted (contextual relevance).
- Spacing: activation recomputation naturally implements the spacing effect;
  massed accesses strengthen less per access (log-sum behavior).
- Retrieval probability: logistic on (A - τ); τ tuned per memory class.
  Below-threshold memories can still be found by explicit index search
  (archival recall = deliberate, effortful recall — human-like).

### 5.2 Importance economy — ECAN, implemented
- **STI** (short-term importance): current relevance; drives context
  admission. Flows from query activation; fast-changing.
- **LTI** (long-term importance): expected future usefulness. Updated by:
  - +Δ retrieval-and-use success (the agent retrieved it, used it, and the
    outcome was good — reward signal, DA-modulated)
  - +Δ user feedback / explicit save
  - +Δ corroboration (more episodes support the claim — evidence count)
  - -Δ disconfirmation (contradiction won against it)
  - -Δ decay without re-confirmation
- **VLTI** (archive): high-LTI or constitution-protected memories get archived
  to durable storage instead of deletion.
- **Budgets**: context admission budget (tokens per query class), store
  growth budgets per tier, consolidation budget per sleep cycle. Everything
  competes; nothing grows unbounded.
- **ROI ledger**: per memory (and per memory class): tokens spent retrieving
  it vs. outcomes it contributed to. The metacognition loop reviews
  low-ROI classes and adjusts budgets/precision. This is how the system
  learns "what's worth remembering" — the user's ROI requirement, made
  algorithmic.

---

## 6. Retrieval Cortex — the Read Path

### 6.1 The five gates (order matters — admission pipeline)
1. **Scope gate**: query scope keys (user/agent/project/session/task) must
   match memory scope. Cross-project leakage is structurally impossible.
2. **Trust gate**: memory trust score (source reliability × channel ×
   corroboration) vs. query's trust requirement. Low-trust memories only
   enter if explicitly requested or with warning tags.
3. **Candidate generation** (fused, parallel):
   - Semantic: embedding cosine over scoped candidate pool
   - Lexical: BM25 (exact names, IDs, error codes, symbols)
   - Associative: PPR over the Hebbian/concept graph seeded by query entities
     (HippoRAG mechanism — single-step multi-hop)
   - Temporal: interval/validity filtering (claim valid_at ≤ now ≤ invalid_at)
   - Recency-weighted by activation (ACT-R base-level)
   - Fusion: RRF (reciprocal rank fusion) over the ranked lists
4. **Activation & rerank**: final rank = RRF score × logistic(activation)
   with MMR diversity to avoid near-duplicate domination; optional
   cross-encoder rerank for high-stakes queries.
5. **Budget gate**: assemble the **evidence packet** within the token budget
   for the query class (e.g. 800–2,000 tokens for live reasoning; larger
   only for deep-dive). Packet composition: highest-value claims with
   `valid_at` windows + source links, key episodes, procedural patterns,
   with epistemic status labels.

### 6.2 Packet metadata (anti-hallucination)
Every packet item carries:
- epistemic status (observed/inferred/speculative)
- confidence + evidence count
- validity window
- scope keys
- instruction-likeness flag (if any — agent is warned)
The context compiler renders these as labeled sections so the LLM can weigh
evidence — and can *abstain* when the packet is thin or contradictory.

### 6.3 Query-time behaviors
- **Unknown-flagging**: if the packet confidence < threshold → the compiler
  emits an explicit "memory: uncertain/unknown" signal; the agent is
  instructed to say so rather than confabulate (LongMemEval abstention).
- **Just-in-time follow-up**: the packet contains identifiers (episode ids,
  file paths, tool queries) so the agent can deep-load details on demand —
  progressive disclosure, not dumping.
- **Cache-awareness**: high-frequency packet layouts are stabilized for
  prompt caching.

---

## 7. Parahippocampal Gate — Trust & Security

### 7.1 Write-side controls
- Sanitization + instruction-likeness scoring (§3)
- Sleep-write screening (§4.4)
- Scope enforcement at store boundary
- Immutability of episodes (poisoned episodes can be *quarantined*, never
  silently edited)

### 7.2 Read-side controls
- Trust gate (§6.1)
- **Anomaly detection**: retrieved items are scored for instruction-like
  language, scope mismatch, anomalous confidence vs. historical norms;
  anomalies are downgraded or flagged to the agent.
- **Poisoning watchdog**: cross-session correlation of memory writes; if
  multiple new memories share anomalous properties (e.g. burst of
  instruction-like content from one channel), quarantine + alert + rollback
  snapshot restore (ASI06 forensic controls).

### 7.3 Audit
Every read and write is logged (who/what/when/scope/decision). Forensic
snapshots enable known-good restore. This is the ASI06 audit trail made
native.

---

## 8. Context Compiler — the Context Engineering Layer

Bridges memory → LLM context, implementing the Anthropic canon:

1. **Memory banks** (stable vs dynamic split):
   - **Identity bank** (agent persona, values, taste, style — slow, low-budget)
   - **User bank** (preferences, profile, relationships — slow)
   - **Workspace bank** (projects, tasks, progress, decisions — medium)
   - **Codebase bank** (architecture, conventions, gotchas — medium, git-
     validated)
   - **Session state** (current task, working memory — fast, small)
   Each bank: a typed memory block with a token budget (Letta-style), updated
   by sleep consolidation or explicit calls, loaded in priority order.
2. **Progressive disclosure**: banks in-context; details via tools
   (memory_search, memory_open_episode, memory_graph_walk).
3. **Compaction**: when context nears limit — hierarchical summary into the
   workspace bank, tool-call results cleared, raw outputs dropped.
4. **Just-in-time retrieval**: the agent actively queries memory during work
   (gated through §6); memory results are cache-stable.
5. **Token accounting**: every component reports tokens in/out; the
   metabolism layer enforces budgets; the ROI ledger reviews them.

---

## 9. Procedural Cortex — Skills, Patterns, Lessons

- **Skill memory**: verified patterns (tool sequences, solution templates)
  with activation (procedural decay ~0.3), reinforcement from successful
  reuse, demotion on failure (utilities learned, not assumed).
- **Lesson memory**: mistake → root cause → prevention, linked to the
  episodes that produced them; accessed at task start (mistake
  pre-briefing — this is the "learn from trials and errors" requirement,
  and it already exists in `.opencode/tools/` — Mnemosyne makes it a first-
  class memory organ with activation and ROI).
- **Behavior memory**: user preferences, communication style, corrections
  (inferred until confirmed twice — an inferred preference is never acted on
  as fact).
- **Pattern recognition**: sleep-time pattern mining (§4.2) feeds this store;
  the metacognition loop reviews discovered patterns for false generalizations.

---

## 10. Evaluation Harness — prove it or prune it

1. **Ground-truth fixtures**: synthetic sessions with planted facts, updates,
   contradictions, and temporal chains (LongMemEval-style: extraction,
   multi-session reasoning, temporal reasoning, knowledge updates,
   abstention) + LOCOMO-style multi-session trails.
2. **Agentic delta tests** (MemoryArena-style): complete tasks with vs
   without memory; memory must improve task outcomes.
3. **Operational metrics** (the taxonomy from the research doc §4.5):
   recall@k, freshness, contradiction rate, abstention accuracy, tokens/
   query, cost/query, injection ASR, cross-scope leak rate.
4. **Security drills**: MINJA-style adversarial write attempts, poison
   fixtures, cross-scope probes. Gate must block; audit must catch.
5. **Calibration**: confidence vs. correctness histograms; mis-calibrated
   classes get corrected priors.
6. **CI integration**: run on every memory-system change; regression gate.

---

## 11. Neuromodulation & Metabolism

- **DA** (reward): outcome feedback modulates LTI updates, skill utilities.
- **NE** (salience): novel/unexpected observations get encoding boost —
  prediction-error weighting (predictive coding: when the agent's world
  model was wrong, the episode is more important).
- **ACh** (plasticity): sleep phase sets high plasticity (consolidation);
  active phase sets low plasticity, high retrieval (encoding/retrieval
  mode switch).
- **5-HT** (discount): horizon of planning affects how far ahead
  anticipation computes.
- **Metabolism**: token budgets per subsystem; energy model tracks spend;
  starvation prevention (UCH law: never starve a component).

---

## 12. Data Model (core types)

```ts
Episode: {
  id, type: 'observation'|'tool_call'|'outcome'|'artifact'|'feedback'|'inference'|'hypothesis',
  content: MultiModal, ts: Date (event), ingestedAt: Date,
  scope: { user, agent, project, session, task },
  provenance: { channel, sourceId, reliability },
  importance, trust, instructionLikeness,
  fingerprint: SparseVec, embedding: Vec, terms: string[],
  accessHistory: Date[], derived: string[] (ids)
}

Claim: {
  id, subject, predicate, object, certainty,
  validAt, invalidAt: Date|null, supersedes: id|null, supersededBy: id|null,
  sources: EpisodeId[], extraction: { model, confidence },
  corroborations: number, contradictions: [{ claimId, resolved: bool }],
  scope, accessHistory, STI, LTI, VLTI, class: 'semantic'|'preference'|'behavior'|'procedure'
}

Entity: { id, canonicalName, aliases[], embedding, fan, claimIds[], scope }
Pattern/Skill: { id, pattern, condition, utilities: {outcome: reward}, accessHistory, class }
Lesson: { id, mistakeRef, rootCause, prevention, sourceEpisodes, lti }
Bank: { id, kind: identity|user|workspace|codebase|session, budget, blocks: Block[] }
Block: { id, label, content, limit, version, updatedBy: 'sleep'|'agent'|'user' }
```

---

## 13. Implementation Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| P0 | Data model + EpisodicStore + Sensory Cortex (write pipeline, contextualization, sanitization, fingerprints) | episodes written with full provenance; sanitization unit tests |
| P1 | Activation layer (ACT-R) + tiers + importance economy (STI/LTI/VLTI) + ROI ledger | activation math unit-tested; decay classes verified |
| P2 | Semantic store: claims, entities, bi-temporal validity, contradiction detection | invalidation & reconsolidation fixtures pass |
| P3 | Retrieval Cortex: 5 gates, fusion (semantic+BM25+PPR+temporal+RRF+MMR), evidence packets | LongMemEval-style fixture suite ≥ targets; packet token budgets enforced |
| P4 | Sleep Cycle: claim formation, pattern mining, pruning, anticipation, sleep security | sleep writes screened; re-verification sweep works |
| P5 | Context Compiler: memory banks, progressive disclosure, compaction, cache-aware layout | budgeted banks render; compaction preserves decisions |
| P6 | Security suite: watchdog, quarantine, audit, rollback, MINJA drills | ASR targets met; leak rate = 0 |
| P7 | Evaluation harness in CI + neuromodulation tuning + metacognition review loop | regression gate; calibration report |

Each phase lands inside UCH's existing organs (hippocampus, neocortex,
sleep_cycle, memory kernel) as upgrades with tests; no phase breaks ground
truth.

---

## 14. Why This Is Superior (the receipts)

| Requirement | Mechanism |
|---|---|
| Human-like recall | ACT-R activation (recency/frequency/context), logistic retrieval, spacing effect, effortful archival recall |
| Vast understanding | CLS dual store + bi-temporal KG + PPR associative index + hierarchical summaries |
| Learn from experience/trials | procedural cortex + lesson memory + outcome rewards (DA) |
| Learn the user | user bank + behavior claims (inferred-until-confirmed) + feedback channel |
| ROI & usefulness | importance economy + ROI ledger + budgeted admission |
| Minimal tokens | evidence packets (1.6K beats 115K — Zep), cache-stable layout, just-in-time disclosure, contextualization |
| Preferences / multi-project states | memory banks + mandatory scope keys; cross-project leakage impossible |
| Auto-update old context | reconsolidation (supersede, never overwrite) + stale-claim sweeps + re-verification |
| Alive & dynamic | sleep cycle + anticipation + neuromodulation + self-tuning budgets |
| No hallucinations | epistemic states, provenance, abstention signal, confidence calibration, contradiction surfacing |
| Multimodal | episode content typed (text/structured/code/image refs) |
| Chain-of-thought & reasoning | reasoning traces as episodes; reason-graph cross-links (UCH cortex_kernel) |
| Self-critique / evolution | metacognition loop + evaluation harness + pattern review |
| Security | 5-gate admission, ASI06 write/read controls, poisoning watchdog |
| Autonomous | everything runs on schedules and thresholds; no user supervision needed |
