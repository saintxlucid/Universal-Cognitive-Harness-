# UCH Directions — Регламент (DOE Framework)

- **Status:** Active — v1.0 (2026-07-31)
- **Owner:** UCH maintainers (all runtimes: opencode / claude / codex)
- **Framework:** DOE — Direction-Oriented Engineering
- **Review cadence:** quarterly, or on any ADR acceptance
- **Amendment mechanism:** §Appendix A. Every change to this document is itself a Direction change and must be recorded.

> A Direction is the written contract between intent and execution. Work that
> cannot point to a Direction clause is not authorized; work that violates one
> must either be stopped or recorded as a formal Deviation (§1.5).

---

## 0. DOE Framework — operating principles

Direction-Oriented Engineering runs a closed loop on every unit of work:

```
DIRECTION ──binds──▶ EXECUTION ──gated by──▶ VERIFICATION ──feeds──▶ LEARNING
     ▲                                                               │
     └─────────────────────── amends the Direction ◀────────────────┘
```

| Principle | Meaning | Failure signal |
| --- | --- | --- |
| **D1 — Direction binds execution** | All work maps to a written clause (this document, a plan, an ADR, a TODO register). | "I just did X" with no clause |
| **D2 — Execution is stepwise and reversible** | One small change per step; each step verifiable on its own. | Big-bang diffs, unverifiable steps |
| **D3 — Verification is mandatory and independent** | Gates (tests, typecheck, lint, score) run against a recorded baseline; claims must survive a stash comparison. | "It should be fine" without a run |
| **D4 — Learning is recorded** | Decisions → ADR; lessons → memory; debt → register. The Direction is amended, never silently violated. | Repeated identical mistakes, undocumented deviations |

---

## 1. Project goals and constraints

### 1.1 Goals

1. **G1 — UCH is a workspace-owned cognitive runtime** (ADR-001): agents and IDEs attach as *permissioned clients*; the workspace is the authority, grants are scoped, projections are filtered. Vision conformance target: **≥ 96%** (measured 96% on 2026-07-31; report `docs/vision-conformance-2026-07-31.md`).
2. **G2 — CP v1 is the stable contract**: the 17-op Cognitive Protocol is the "syscall ABI" of cognition. It must not break; additions require versioning and conformance updates (SOP-07).
3. **G3 — Engineering intelligence is layered, measured, and evidence-backed**: concepts, evaluators, benchmark corpus (ADR-003); every gate is deterministic and veto-capable only where constitutionally justified.
4. **G4 — Debt is visible and shrinking**: every change records before/after metrics; the Debt Register (§4.3) is the source of truth.

### 1.2 Constraints

| # | Constraint | Rationale / enforcement |
| --- | --- | --- |
| C1 | Only `@opentelemetry/api` + `openai` as runtime dependencies | ADR-001/002; any new runtime dep needs an ADR with alternatives |
| C2 | `src/` is ESM, strict TypeScript (`tsc --noEmit` must stay at baseline) | Type safety is a gate, not a suggestion |
| C3 | Product code lives under `projects/`; never at workspace root | Workspace boundary rule |
| C4 | No secrets, personal data, or raw chain-of-thought in repo memory | `.agent/memory` rules; `.env.example` holds names only |
| C5 | One agent owns a file until it lands | Parallel-wave protocol (§SOP-05); see example in §2.5 |
| C6 | No emojis in code or docs; no code comments unless requested | Workspace conventions |

### 1.3 Measurable baseline (recorded 2026-07-31)

| Metric | Value |
| --- | --- |
| Test files / tests | 135 / 2160 (1 known environment failure — Windows path test in `neural-fs`) |
| Pre-existing typecheck errors | 6 (all in parallel-wave files: `cli/index.ts`, `frameworks/composer.ts`, `stdio-server.ts`) |
| Lint | clean on all committed files |
| Vision conformance | 96% |
| Top complexity debt | `cli/index.ts:main` 98 cc / 733 ln; `runConformance` 19 cc / 143 ln |

---

## 2. Standard operating procedures

### 2.1 SOP-01 — Change lifecycle

| Change type | Procedure | Example |
| --- | --- | --- |
| Planned / architectural | GSD `/gsd:plan-phase` → `/gsd:execute-phase`; plan docs in `planning/` | Phase 01 organism organs |
| Non-trivial product work | GSD execute with TDD waves (SOP-02) | Engineering Intelligence Wave D |
| Trivial (typo, format, narrow fix) | `/gsd:quick` or `/gsd:fast` | A config fix with no cross-module impact |
| Contract or architecture decision | ADR first, then implementation | ADR-002 OTel trace engine |

Exit criteria for *any* change: targeted tests green → full-suite delta ≤ 0 new failures → typecheck delta ≤ 0 new errors → lint clean on touched files.

### 2.2 SOP-02 — TDD wave procedure

1. Write failing tests first (RED) — one behavior per test.
2. Implement the minimum to pass (GREEN).
3. Refactor to the quality bar (§4) without touching test assertions (REFACTOR).
4. Run the wave's full test file + dependents; record counts in the plan's VALIDATION doc.

Commands (run from `projects/uch`):
```powershell
npx vitest run src/__tests__/<target>.test.ts   # targeted
npm test                                         # full suite
npm run typecheck && npm run lint                # gates
```

### 2.3 SOP-03 — Refactoring wave procedure

Refactoring is a first-class work type. Every wave follows:

1. **Measure** — scan complexity (TS AST: cc per function, line counts); record top hotspots.
2. **Map tests** — every target file must have a test file (`git ls-files src | Select-String <target>`); no test coverage → not a target.
3. **Baseline** — run mapped tests; record pass count.
4. **Execute one refactor at a time** — Extract Method / Guard Clauses / Strategy table / data-driven validation; preserve user-visible strings verbatim (they are API).
5. **Verify per step** — mapped tests after each refactor.
6. **Track** — every task in `TODO_refactoring-expert.md` with before/after metrics and QA checklist.
7. **Land** — full suite, typecheck delta, lint.

Worked example (2026-07-31 wave): `cp.ts:createDefaultCPServer` 26 cc/223 ln → 2 cc/31 ln via named handler factories; `manifest.ts:validateManifest` 18 cc/62 ln → 7 cc/29 ln via table-driven validation; net wave: −58% cc, −60% lines, 122/122 targeted tests green.

**Known trap (recorded):** extracting an optional-field validator must preserve the `!== undefined` guard. The R-5 first attempt dropped it and `validateManifest` began rejecting manifests with absent `capabilities`; the round-trip test caught it in the same step. Rule R-3 exists because of this.

### 2.4 SOP-04 — Verification gate (independent of the author's claims)

- Targeted tests pass **without changes** to tests.
- Full suite: failure count ≤ baseline list (currently: 1 environment test — `fs.ls('\')` vs `fs.ls('/')` in neural-fs; do not "fix" it by deleting).
- Typecheck: **prove** the delta. Method: `git stash push -- <your files>` → `npx tsc --noEmit` → compare → `git stash pop`. Never rely on memory of the error list.
- Lint: `npx eslint <touched files>` exit 0.
- New code: Organic Score ≥ 90 (`uch organic-score --kind code`), 6-gate organic-code pipeline, constitution check (integrity + covenant laws).

### 2.5 SOP-05 — Parallel-wave coexistence

Multiple agents work the same repo. Rules:

1. **Check ownership first:** `git status --short -- src/...` — modified or untracked files are owned by an in-flight wave. Do not edit them (refactor or feature).
2. **Pick safe targets:** tracked + unmodified + test-mapped. In the 2026-07-31 wave, `cli/index.ts:main` (98 cc) was the #1 smell but had +223 uncommitted parallel lines → deferred with a documented R-7 instead of edited.
3. **Never stash-pop blindly** across waves; if you must stash, stash only your file set (`git stash push -- <paths>`).
4. **Land small and often**; unlanded work cannot be refactored by others.

### 2.6 SOP-06 — Documentation and memory

- Architecture decisions → ADR (numbered, status table kept current).
- Session starts/completions/blockers → `scripts/agent-session.ps1 -Status <start|note|complete|blocked> -Runtime <runtime> -Scope <scope> -Summary "<text>"`.
- Durable workspace facts → `.agent/memory/WORKSPACE-MEMORY.md` under "Durable additions (date - title)" with evidence and affected runtimes.
- Plan/validation docs → `planning/<phase>/`; design notes → `design/`.

### 2.7 SOP-07 — Contract change (CP, trace model, manifest schema)

1. Draft ADR with compatibility analysis (version bump vs. additive).
2. Implement additive-only changes first (new op, new optional field).
3. Update conformance: `src/__tests__/conformance-runner.ts` + `design/CONFORMANCE.md`.
4. Breaking changes: bump CP major, keep legacy normalization (see `normalizeTraceId` precedent), announce in changelog.

### 2.8 SOP-08 — Specification Governance System (RFC lifecycle)

*Every normative decision — a law, a contract, an instruction, a schema, a
boundary — follows this lifecycle. The specification is the source of truth;
the conversation is not (arXiv 2607.16680, specification-driven
development).*

**Mandatory lifecycle (13 stages):**

```text
Idea → Research → RFC → Prototype → Benchmark → Architecture Review →
Security Review → Constitution Check → Acceptance → Specification →
Reference Implementation → Certification → Stable
```

| Stage | Entry gate | Exit artifact |
| --- | --- | --- |
| **Idea** | Motivation: problem + why the existing corpus cannot cover it | Idea note in `../rfc/ideas/` |
| **Research** | Relevant literature + evidence register | Research note (evidence, alternatives) |
| **RFC** | Research complete; Five Gates (SOP-09) declared | `../rfc/RFC-00NN-*.md` — status `Draft` |
| **Prototype** | RFC accepted as Draft | Working prototype in `src/` behind a flag or new module |
| **Benchmark** | Prototype measurable | Benchmark results in the RFC |
| **Architecture Review** | Benchmark meets targets | Architecture review record |
| **Security Review** | Architecture review passed | Security review record (threat-model delta) |
| **Constitution Check** | Security passed | Constitution-conformance verdict (all 32 laws + Articles) |
| **Acceptance** | Constitution Check passed | RFC status → `Accepted` |
| **Specification** | Acceptance | Normative text promoted into `spec/` + `VERSION.md` bump |
| **Reference Implementation** | Specification published | Implementation + tests + conformance suite entry |
| **Certification** | Reference implementation green | `drivers/compliance.ts` certificate line |
| **Stable** | Certified + one external consumer | RFC status → `Stable`; frozen unless amended |

**Rules:**

- **One RFC, one decision.** Scope creep invalidates the RFC.
- **RFCs never get deleted.** A superseded RFC is marked
  `Superseded by RFC-00NN`, never removed — the corpus is a ledger (Law 12).
- **Small changes** (clarification, typo, non-normative) bypass the lifecycle
  via `patch` bump on the affected spec (VERSION.md bump rules) — recorded as
  a note, not an RFC.
- **Emergency changes** follow Article VII of the Constitution (Emergency
  Amendment path) and must complete the full lifecycle retroactively within
  three sleep cycles.
- RFC numbers are permanent; `RFC-0000` is the governance spec itself.

### 2.9 SOP-09 — The Five Gates (feature admission)

*Before any feature, organ, or contract change may pass the Idea stage, it
must declare and pass five gates. If any gate fails, the feature dies. The
gate verdicts are recorded in the RFC.*

| Gate | Question | Evidence required |
| --- | --- | --- |
| **G1 Scientific** | Is it supported — by CS, neuroscience, psychology, or systems engineering? | Cited literature or formal argument |
| **G2 Architectural** | Does it violate the Constitution (32 laws + Articles)? | Constitution-conformance mapping |
| **G3 Engineering** | Can it scale, be benchmarked, and be maintained? | Benchmarks, complexity estimate, test strategy |
| **G4 Biological** | Does it make the organism more coherent (dual-named, organ contract, benchmarkable)? | Organ-contract statement (MANIFESTO §6) |
| **G5 Economic** | Does it improve ROI, adoption, maintenance, or performance? | Cost/benefit analysis |

A feature that clears all five gates is eligible for the RFC stage. The Five
Gates are the admission filter; the RFC lifecycle (SOP-08) is the delivery
pipeline.

---

## 3. Rules and limitations

| # | Rule | Limit / enforcement |
| --- | --- | --- |
| R-1 | **No behavior change during refactoring.** Tests must pass without modification. | Wave blocked at step 5 of SOP-03 |
| R-2 | **No big-bang refactoring.** One refactor per step; one logical change per commit. | Review gate; PR scope check |
| R-3 | **No refactoring without test coverage** on the target. | SOP-03 step 2 |
| R-4 | **User-visible strings are API.** Error messages, permission reason strings, descriptions — preserved verbatim. | Diff review on refactor waves |
| R-5 | **Do not touch parallel-wave files** (dirty or untracked per git status). | SOP-05 |
| R-6 | **Dead-code removal only under proof of dominance** (e.g., unreachable `else-if` whose first branch strictly dominates). When in doubt, keep and flag. | Example: `chunkSemantic` `maxChars * 1.5` branch |
| R-7 | **No gold-plating, no speculative abstraction.** Patterns (Strategy, Factory, Observer) only when they solve a measured problem. | Organic Score "reuse-first" rubric |
| R-8 | **No new runtime dependencies without ADR.** | Constraint C1 |
| R-9 | **Complexity ceilings:** method cc < 10 and < 60 lines; class < 200 lines. Exceeding requires a Debt Register entry with owner. | §4.3 |
| R-10 | **Nested conditionals ≤ 2 levels**; prefer guard clauses. | Review gate |
| R-11 | **No commits, pushes, or PRs unless explicitly requested** by the user. | Workspace-wide rule |
| R-12 | **Never commit secrets.** `.env.example` contains names only; anything matching `api_key|password|secret|token` is blocked from shared logs. | Scripts check + review |

---

## 4. Quality standards

### 4.1 Definition of Done (DoD)

- [ ] Targeted tests green, unchanged
- [ ] Full suite: no new failures beyond the known list (§2.4)
- [ ] `tsc --noEmit`: zero new errors (stash-proven)
- [ ] `eslint` clean on touched files
- [ ] Before/after metrics recorded for refactors
- [ ] Debt Register updated if ceilings exceeded
- [ ] Session + memory recorded (SOP-06)

### 4.2 Quality gates

| Gate | Threshold | Tool |
| --- | --- | --- |
| Tests | 100% of targeted; full suite delta 0 | vitest |
| Types | delta 0 errors | `tsc --noEmit` |
| Lint | 0 errors on touched files | eslint |
| Organic Score | ≥ 90 (new code); vetoes reject regardless of score | `uch organic-score` |
| Engineering review | no `veto`-gate findings (SPOF, unrecovered failure, pathological complexity) | `uch engineering-review` |
| Complexity | method cc < 10, < 60 ln; nesting ≤ 2 | AST scan + review |

### 4.3 Debt Register (current, 2026-07-31)

| Debt | Severity | Owner | Plan |
| --- | --- | --- | --- |
| `cli/index.ts:main` — 98 cc / 733 ln | Critical | refactoring wave (R-7 deferred) | Extract after parallel wave lands; target < 60 cc |
| `protocol/conformance.ts:runConformance` — 19 cc / 143 ln | Medium | refactoring wave | Extract per SOP-03 |
| 6 pre-existing typecheck errors in parallel-wave files | Medium | wave owners | Land wave, then typecheck delta 0 |
| `dispatch`/`invoke` envelope duplication in `CPServer` | Low | refactoring wave | Extract `errorResponse` helper |
| 1 environment-dependent test (neural-fs Windows paths) | Low | platform | Mark env-skip; do not delete |

New debt found during any change is added here in the same change; the register is never silently edited away.

---

## 5. Success criteria

Measurable, reviewed each quarter (SOP-06) and at each ADR acceptance:

| # | Criterion | Measure | Current | Target |
| --- | --- | --- | --- | --- |
| SC-1 | Suite health | Full-suite pass rate vs known-failure list | 2160/2161 | No new failures for 4 consecutive waves |
| SC-2 | Debt shrinks | `cli/index.ts:main` cc | 98 | < 60 by Q4-2026 |
| SC-3 | Refactor discipline | % of waves with recorded before/after metrics | 100% (1/1) | 100% |
| SC-4 | Contract stability | Breaking CP changes without ADR | 0 | 0 |
| SC-5 | Vision conformance | Conformance report | 96% | ≥ 96% maintained; 100% of ADR-001 Phase-I criteria kept green |
| SC-6 | Typecheck integrity | New errors introduced per wave | 0 | 0 |
| SC-7 | Verification honesty | % of waves with stash-proven typecheck deltas | 100% (1/1) | 100% |
| SC-8 | Onboarding | A new agent runs all gates from `docs/README.md` commands without maintainer help | — | 1 successful onboarding per quarter |

A criterion failing two consecutive quarters triggers a Direction amendment (§Appendix A), never an ad-hoc exception.

---

## Appendix A — Amendment and deviation record

**Amendment:** any change to this document (sections, thresholds, SOPs) is itself a Direction change:
1. Record the change in the table below.
2. Bump `v1.x`; update `Status` and `Last review`.
3. If the amendment is architectural, pair it with an ADR.

**Deviation:** a temporary, justified exception to a clause:
1. Written entry below (who, what, why, until-when).
2. Must be re-reviewed at the next review cadence; cannot be extended twice.
3. Deviations are visible to all runtimes — never buried in session logs.

| Date | Type (Amend/Deviation) | Clause | Change | Author |
| --- | --- | --- | --- | --- |
| 2026-07-31 | Amend | — | v1.0 initial Direction (DOE framework adoption; baselines from the 2026-07-31 refactoring wave) | refactoring-expert |
