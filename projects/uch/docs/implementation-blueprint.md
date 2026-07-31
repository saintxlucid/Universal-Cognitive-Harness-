# UCH Implementation Blueprint
### Mapping the Research Ledger onto the Universal Cognitive Harness Architecture

---

## 0. Framing

Your original ledger (Phases I–VII) is research material. The manifesto is the actual spec — a workspace-owned cognitive runtime with a defined organ contract, a driver/control-plane/substrate architecture, and a working repo (98 test files, six ADR-001 Phase-I criteria already implemented as of 2026-07-31).

This document does one job: **walk every organ and layer already defined in the manifesto, and attach the specific ledger content that's actually useful to building or feeding it.** Nothing here invents new architecture — UCH's shape is already decided in ADR-001, the Laws, the Constitution, and the Genome. This is the "what goes inside each box" pass.

Where ledger material doesn't map to anything in UCH's architecture, I've said so rather than forcing a fit — per the Genome's own rule: *if an organ cannot be benchmarked independently, it is a metaphor, not a component. The inverse also holds: if ledger content can't be attached to a real organ, it doesn't belong in UCH.*

One standing caveat carried over from earlier: some specifics in the original ledger (certain repo names, one benchmark statistic, the "ETCLOVG" acronym) were unverifiable. I've excluded those from this mapping rather than smuggling them in under UCH's more credible framing.

> **Verification note (2026-07-31):** this document was checked against the live repository before landing. All sixteen organ module paths and contracts in §3 match MANIFESTO §6 exactly. Test corpus is 98 test files (the manifesto's own "91 test files" figure is stale). Gap-check item #4 is already implemented and is marked as such in §7.

---

## 1. Driver Plane, Control Plane, Capability Registry

*(the outermost layer — where external clients and tools attach)*

This is where **Phase I of the ledger** (LLM Gateway, AWS multi-tenant patterns) actually belongs — not as infrastructure to copy wholesale, but as a feature checklist for what a mature driver/control-plane layer needs to expose.

**From the LLM Gateway feature set (ledger 1.3), map directly to Control Plane responsibilities already named in the manifesto (auth, policies, budgets, limits, telemetry):**

| Ledger feature | Control Plane responsibility it feeds |
|---|---|
| #11 Classification/Moderation (fast classifier + LLM fallback + human loop) | Policy engine — grey-zone requests should route to a review path, not auto-deny or auto-allow |
| #12 Structured Extraction (schema-as-prompt, single repair attempt) | Capability Registry response contracts — every capability's output should be schema-defined, not freeform |
| #14 Text-to-SQL (read-only roles, AST validation, mandatory query display) | A direct pattern for the **Database Driver** — read-only by default, validated by parsing not regex, and every query surfaced to the grant holder before execution |
| #17 Smart Autocomplete (prefix trie + ANN blend, debounce, never embed on keystroke) | A concrete pattern for the **Reflex Engine** (§3 below), not the Control Plane itself |
| #20 LLM Gateway Core (single interface, exact caching, per-tenant budgets, trace-every-call) | This *is* what the Control Plane already does per the manifesto (auth/policies/budgets/telemetry) — treat #20 as a checklist to audit the existing implementation against, not new work |

**From the AWS section (1.2):** most of it (Cognito, S3 knowledge bases, per-tenant inline filters) is solved differently in UCH — scope containment through the `ProjectionEngine` and grant-based authority already do what tenant isolation was doing in the AWS model, and they do it *without* a cloud dependency, which is directly required by Law 10 (Identity Persistence / local-first). **Don't port the AWS pattern in — UCH's own grant/projection system is the better-designed replacement for it.** The one AWS-section idea worth keeping: **OpenTelemetry-style observability** (SSM/CloudWatch equivalent) as the concrete implementation target for the Control Plane's telemetry responsibility.

---

## 2. Workspace Brain

*(identity, world-model, architecture-graph, timeline)*

Ledger content that feeds this layer:

- **DIKW Hierarchy (2.6)** is a genuinely good model for what the Workspace Brain's world-model should track as *ascension*, not just storage: raw file events are Data → indexed/organized state is Information → the architecture-graph's inferred patterns are Knowledge → anything the Executive System uses for a long-horizon decision is Wisdom. Worth using as the literal maturity ladder for how the world-model promotes content, if it doesn't already have one. *(As of 2026-07-31 the repo has no DIKW reference anywhere — this is new content.)*
- **"Organization Erosion" finding (ledger 7.1, citing Zhang et al. 2025-style filesystem-memory research):** the empirical claim that organization degrades over time for all but the strongest management processes, and that changing the toolset alone reshapes the store as much as changing the model. This is a direct argument for building **regression tests on the Workspace Brain's organization quality itself** — not just correctness tests, but tests that catch entropy creeping into the architecture-graph over long sessions. Worth a dedicated test suite category if one doesn't already exist among the 98 files.

---

## 3. Cognitive Substrate — Organ by Organ

This is the center of gravity. Below, each organ from the manifesto's Organ Contract table gets the ledger content that's actually relevant to it — and only that.

### Executive System (Prefrontal Cortex) — `src/executive-brain/`
**Contract:** planning, decisions, inhibition. **Measured by:** decision trace, plan completion rate.

- **12 Decision Models (5.3)** map directly to *selectable planning strategies*, not simultaneous features. The Executive System should pick a model per decision type, not run all twelve:
  - Reversible/fast → Lean Decision Making
  - High-stakes/irreversible → Decision Matrix + Pre-Mortem Analysis
  - Multi-stakeholder / ambiguous → Nominal Group Technique / Delphi Method (relevant once UCH has multiple agents proposing plans concurrently)
- **OODA / PDCA / Kepner-Tregoe / IDEAL (5.4)** are candidate **plan-completion loop implementations** — pick one as the Executive System's default control loop rather than trying to encode all four. OODA is the most natural fit for a continuously-attached runtime (Observe → Orient → Decide → Act maps cleanly onto the event-driven model in §7 of the manifesto).
- **Information Integrity Checklist (5.4)** — objective? qualified source? evidence of prejudice? propaganda? whole truth? — is a legitimate **inhibition gate**: before the Executive System commits to a plan based on retrieved knowledge, this is a real, cheap filter to run against the source material. This is the most directly implementable, high-value item in the whole ledger for this organ. *(As of 2026-07-31, `src/executive-brain/decision-engine.ts` is a generic options store — none of the above exists yet.)*

### Memory System (Hippocampus) — `src/kernel/memory/`, `src/hippocampus/`
**Contract:** episodic encoding, consolidation. **Measured by:** retrieval precision, consolidation latency.

- **Filesystem memory topology (ledger 3.1: `/raw /wiki /output /ctx /mem`)** is a strong candidate mapping for episodic vs. semantic separation, if the kernel memory module doesn't already draw this line explicitly: `/raw` and `/ctx` are episodic (session-scoped, immutable, high-volume); `/wiki` is the consolidated semantic layer the Learning System (below) promotes things into.
- **Enterprise RAG Pipeline (3.3)** — the specific implementable techniques are:
  - Semantic-boundary chunking (never split a definition) — directly improves retrieval precision, the organ's own success metric. **Already implemented:** `src/chunkers/semantic.ts` (`chunkSemantic`).
  - Hybrid retrieval: keyword (BM25) + vector, fused via **Reciprocal Rank Fusion** (also 7.9). **Already implemented:** `src/kernel/retrieval/fusion.ts` and `src/mnemosyne/retrieval-cortex.ts` (BM25 term index + RRF with k=60, MMR diversity).
  - Context Compressor step before generation — reduces what gets handed to the Executive/Integration layers, which also helps the Energy Budget organ (§below).
- **Faiss/OPQ/HNSW pipeline (2.4, 7.1)** — this is the *scaling reference*, not the starting design. It's real (OPQ [Ge et al. 2013], HNSW [Malkov & Yashunin 2018] are legitimate techniques), but it's calibrated for hundreds of billions of tokens against a specific model's hidden states. Treat it as the answer to "what do we do when kernel memory's retrieval latency becomes the bottleneck," not as v1 architecture.
- **Consolidation latency** (the organ's own benchmark) is a direct hook for the **Sleep Cycle** organ (§below) — consolidation is explicitly Sleep Cycle's job, not Memory System's; Memory System should expose the raw material, Sleep Cycle should do the compression/pruning pass.

### Learning System (Neocortex) — `src/neocortex/`
**Contract:** pattern discovery, abstraction. **Measured by:** pattern generalization tests.

- **Algorithmic Atlas (2.2)** — most of the 30 algorithms are not directly relevant to an LLM-centric substrate, but a specific subset is:
  - **Isolation Forest** and clustering methods (k-Means, DBSCAN) are legitimate tools for detecting *pattern drift* in workspace behavior over time — a concrete generalization test.
  - **PCA / t-SNE** are useful for actually *inspecting* whether the Learning System's abstractions are separating meaningfully — good for building the pattern-generalization test harness itself, not for the organ's runtime logic.
- **Biologically Plausible Learning / Dual-Stream Architecture (2.3)** is a real research direction (Dale's Principle, error diffusion instead of backprop) but it describes an alternative *neural network training method*. Unless the Learning System is training its own weights (as opposed to prompting/fine-tuning an existing LLM), this doesn't apply — flag as "not applicable to current UCH scope" rather than forcing it in.
- **DIKW (2.6)** — same ladder as in §2, but here it's the organ's actual job: Learning System is specifically the component that should be turning Information into Knowledge (the "How" layer). Worth stating explicitly in this organ's contract if it isn't already.

### Action Selection (Basal Ganglia) — `src/basal_ganglia/`
**Contract:** routine selection, habits. **Measured by:** selection determinism, habit hit rate.

- **Zero-LLM Routing (4.2.4)** — a keyword-based router resolving routine requests without invoking the LLM — is close to a literal spec for this organ's habit-hit-rate metric. This is the most concrete, buildable item tied to Action Selection in the whole ledger.
- **Procedural Memory (4.2.1)** — tracking successful tool-call sequences in a structured store — is the *training data* for this organ: habits should be learned from a procedural log, not hand-coded.

### Routing System (Nervous System) — `src/nervous-system/`
**Contract:** signal delivery, prioritization. **Measured by:** routing latency, Law 13 compliance.

- Same Zero-LLM Routing material as above applies here for latency, but at the *transport* level rather than the habit-selection level — worth clarifying the boundary between this organ and Basal Ganglia if it's ambiguous in the current implementation (Routing decides *where a signal goes*; Action Selection decides *what routine handles it once it arrives*).

### Integration Kernel (Cortex Kernel) — `src/cortex_kernel/`
**Contract:** cross-modal synthesis. **Measured by:** fusion quality, signal coverage.

- **Reciprocal Rank Fusion (3.3, 7.9)** is directly relevant here too — RRF is a general-purpose fusion technique, not RAG-specific, and it's a reasonable default for combining ranked signals from multiple organs (e.g., a Memory System result set and a Learning System pattern match) before they reach the Executive System.

### Persistence Engine (Aether) — `src/aether/`
**Contract:** 24/7 continuous operation. **Measured by:** uptime, state restore integrity.

- Ledger has no directly novel content here beyond general monitoring practice (Layer 9 of the original 11-layer stack — accuracy/latency/cost/hallucination tracking). Treat that list as the metric set this organ should be exposing to the Control Plane's telemetry, not new architecture.

### Signal Priority (Thalamus) — `src/nervous-system/`
**Contract:** attention gating. **Measured by:** escalation accuracy, novelty filter rate.

- **Sentiment Analytics (#18)** and **Anomaly Detection (#19)** from the LLM Gateway feature set are the two most directly relevant patterns:
  - #18's approach (aspect + evidence span, cluster-then-label, velocity-based alerting) is a good model for *what* triggers escalation.
  - #19's discipline of emitting anomalies as "hypotheses," not "verdicts," is a good guardrail for this organ specifically — Thalamus should flag for attention, not make final judgments (that's Executive System's job).

### Homeostasis (Brainstem) — `src/exoskeleton/`, health-metrics
**Contract:** vital regulation. **Measured by:** health metric stability.

- Directly fed by the same Monitoring Layer material as Persistence Engine above — accuracy, latency, cost, and hallucination/success rate tracking (original ledger Layer 9) is the concrete metric set.

### Reflex Engine (Spinal Cord) — `src/agentic/`
**Contract:** zero-LLM fast paths. **Measured by:** reflex latency, cortex-offload ratio.

- **Smart Autocomplete pattern (#17)** — prefix trie + ANN blend, 120ms debounce, never embed on keystroke — is a near-literal spec for a reflex path: fast, cheap, deterministic-where-possible, and explicitly avoiding expensive operations (embedding) on every event.
- Cortex-offload ratio (the organ's own metric) is directly improved by moving as much of #11 (fast classifier tier) and #17 here rather than into the Executive/Learning organs.

### Threat Detection (Immune System) — `src/exoskeleton/immune.ts`
**Contract:** anomaly monitoring. **Measured by:** threat precision/recall.

- **Security Layer material (original Layer 10):** authentication, PII masking, guardrails, audit logs — all directly relevant here.
- **AutoHarness / rejection sampler (4.1)** is the single most valuable piece of the entire ledger, and it belongs partly here and partly in Governance (below). Specifically for Threat Detection: the harness's job of *intercepting model outputs and rejecting rule violations* is a real, benchmarked pattern (the general finding — that agents fail on illegal/invalid actions far more than on strategy — is well-documented in agent-harness research; the specific percentage cited in the original ledger should be verified against its source before being used in any spec or marketing claim).
- **Anomaly Detection (#19)** applies here too, for behavioral (not just content) anomalies.

### Modulation (Endocrine) — `src/exoskeleton/endocrine.ts`
**Contract:** global parameter adjustment. **Measured by:** global-signal convergence.

- No strong ledger match. The closest analog is per-tenant budget/tier logic from the AWS section (Cognito claims distinguishing "Basic" vs "Premium" tier) — but that's really a Control Plane concern (§1), not this organ's. Flagging as **no direct ledger content applies here** rather than forcing a mapping.

### Offline Processing (Sleep Cycle) — `src/sleep_cycle/`
**Contract:** consolidation, pruning. **Measured by:** consolidation throughput, decay accuracy.

- This is where **skill distillation** belongs: the Perpetual Learning Loop (3.4) and Self-Evolving Roadmap (4.2) both describe, at core, an offline process that reviews recent activity and produces compressed, reusable output (a `SKILL.md`, an updated prompt, a pruned memory). Rather than the full 8-agent pipeline (Scout/Filter/Reader/Extractor/Scorer/Generator/Reviewer/Publisher) as separate live agents, this maps cleanly onto Sleep Cycle running a **scheduled offline pass** with those eight steps as internal stages of one consolidation job. *(As of 2026-07-31 the nap/deep-sleep skeleton exists in `src/sleep_cycle/cycle.ts`, but `runMaintenance()` is a stub — metrics are randomized and nothing is consolidated or distilled. This is the most actionable gap in this mapping.)*
- **"Organization Erosion" finding (7.1)** — same citation as §2 — is the direct argument for *why* Sleep Cycle needs to actively counteract entropy, not just append.
- **50–60% Token Reduction via self-compression (4.2.3)** is a concrete target metric for this organ's consolidation throughput.

### Concept Store (Connectome) — `src/connectome/`
**Contract:** relationship graph. **Measured by:** graph integrity, query latency.

- **Graph Memory / MRAgent framing (3.2)** — cue-tag-content graph, active reconstruction rather than static retrieval — maps directly onto this organ's purpose. This is one of the better-aligned pieces of the entire ledger: Connectome *is* the "associative tags as semantic bridges" idea, just under UCH's own naming. Worth explicitly cross-referencing 3.2 in the Connectome's own design doc if it isn't already there, since it's a real research pattern (MRAgent-style reconstruction) and not just a metaphor. *(As of 2026-07-31 the connectome is scaffolded only — the README admits it — and no design doc exists yet.)*

### Energy Budget (Metabolism) — `src/metabolism/`
**Contract:** resource allocation. **Measured by:** budget compliance, overspend rate.

- **Per-tenant budgets (#20, AWS section)** and **50–60% token reduction (4.2.3)** are the direct feed here — both the budget-tracking discipline and the reduction techniques (context self-compression) apply.
- **The Cost-Quality-Speed Trilemma (7.6)** — improving one degrades the other two unless the harness layer itself is optimized — is a good design principle to state explicitly in this organ's contract: Metabolism's job is managing that trilemma, not eliminating it.

### Governance (Constitution) — `spec/CONSTITUTION.md`, `src/cognitive-plane/constitution/`
**Contract:** rules, separation of powers. **Measured by:** policy violation rate, review latency.

- **Clean Code Covenant (4.5: SOC, DRY, KISS, DYC, YAGNI)** — legitimate, standard software engineering discipline, appropriate as literal enforceable rules in the Constitution, checkable by static analysis as the manifesto already claims for the Laws.
- **AutoHarness as rejection sampler (4.1)**, second half: the harness *enforcing* rules (as opposed to *detecting* threats, which is Immune System's job) belongs here — Governance is where "rejected action → specific violation message → bounded retries" should live as policy, with Immune System and Threat Detection doing the detection work that feeds it.
- **Information Integrity Checklist (5.4)** — same content referenced in Executive System above — also belongs here as a *policy*, not just a planning heuristic: if it's a rule the system must always apply (not just a strategy the Executive System might choose), it belongs in the Constitution rather than being optional.

---

## 4. Skill Loading (Attachment Lifecycle step: "Load Skills")

The manifesto's attachment lifecycle already includes "Load Skills" as a discrete step. The ledger's modular skills list (4.3: frontend-design, systematic-debugging, document-skills, security-review, web-quality-skills, memory-consolidation, code-review, simplify, artifacts-builder) is a reasonable **starter skill catalog** for what gets loaded at this step — several of these already exist as real, working skills in Claude's own environment (frontend-design, document-skills equivalents, etc.), so this isn't hypothetical; it's an available integration point worth connecting directly rather than reinventing.

**systematic-debugging (4.3 #2)** deserves a specific callout: its four phases match the ledger's own RCA chain (4.4: 5 Whys → Fishbone → Pareto → F.O.C.U.S.) almost exactly. This is the strongest single alignment between the "modular skills" list and the "decision models" section of the ledger — worth building as one unified debugging skill rather than two separate references to the same method.

---

## 5. Data Hygiene (feeds Memory System + Learning System)

**12 Data Cleaning Techniques (3.5)** — filtering, deduplication, imputation, standardization, transformation, outlier detection, validation, encoding, aggregation, sampling, cleansing, profiling — isn't a UCH organ on its own. It's the **preprocessing discipline that should sit in front of anything entering the Hippocampus/Memory System**, particularly for any driver ingesting external data (filesystem, database, git history) rather than direct conversational input. Worth a shared utility module referenced by every ingesting driver, rather than duplicated per-driver logic (this is itself a DRY application per the Clean Code Covenant above).

---

## 6. What Doesn't Map — Explicitly Out of Scope

Being honest about the parts of the ledger that don't belong in UCH, rather than force-fitting them:

- **Quantitative Alphas (6.3)** — a real framework (momentum, mean-reversion, volume-price, volatility, microstructure factors), but it's a trading-signal domain, unrelated to a cognitive runtime for coding workspaces. If ASTRA or another project wants this, it's a separate driver/plugin at most — not substrate architecture.
- **Productivity rituals (6.1: 3-3-3, Eisenhower Matrix, GTD, Eat the Frog)** — these are for the *humans building UCH*, not something the runtime executes. Useful as your own project-management discipline; not a spec item.
- **CEO Strategy Wheel (5.1) and Strategy-vs-Plan Framework (5.2)** — these are organizational/business strategy tools. They don't map to any organ. If useful at all, it's for whoever is making product decisions about UCH as a project, not for the runtime itself.
- **AWS-specific infrastructure (1.2)** — as noted in §1, UCH's own grant/projection model already solves the isolation problem this was solving, without the cloud dependency Law 10 rules against. Don't port it in.

---

## 7. Gap Check Against Manifesto §8

The manifesto states six ADR-001 Phase-I criteria are implemented (workspace manifest, capability registry semantics + grant engine, event governance, projections, plus two more implied by "all six"). Nothing in the ledger conflicts with or duplicates that work — the ledger content mapped above is entirely about **what runs inside the organs**, not the attachment/grant/governance mechanics, which are already specified and implemented. The clearest next-value items from this mapping, in rough priority order given what's already built:

1. **Governance: Information Integrity Checklist + Clean Code Covenant** as literal enforceable Constitution rules (cheap, high-value, directly buildable). Neither exists in `src/executive-brain/decision-engine.ts` or the constitution corpus as of 2026-07-31.
2. **Reflex Engine: the autocomplete-style fast-path pattern** for cortex-offload ratio improvement.
3. **Sleep Cycle: skill distillation as a scheduled consolidation job**, using the 8-stage pipeline as internal stages rather than live agents. The `nap()`/`deepSleep()` skeleton and `skillsBenchmarked` metric already exist in `src/sleep_cycle/cycle.ts` — the job body is the missing piece.
4. **Memory System: semantic-boundary chunking + hybrid RRF retrieval** — **already implemented** (`src/chunkers/semantic.ts`, `src/kernel/retrieval/fusion.ts`, `src/mnemosyne/retrieval-cortex.ts`). Remaining work is a coverage/quality audit, not new construction.
5. **Connectome: explicit cross-reference to the cue-tag-content / active-reconstruction model**, since it's a strong conceptual match worth formalizing in the organ's own design doc. The organ is currently scaffold-only.

---

*This document supersedes the earlier ASTRA-PRIME-framed version — same ledger, correctly attached to the architecture that's actually being built. Verified against the live repo 2026-07-31.*
