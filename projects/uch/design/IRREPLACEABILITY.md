# IRREPLACEABILITY — the "impossible to reimplement" program

- **Status:** Program (IDEA-0127 promoted to an executable program;
  ratified as the objective amendment for Epochs III-V on 2026-08-01)
- **Origin:** VISION §23 (round 19, "change the objective: not
  'impossible to replace' but 'impossible to reimplement'") + §24
  (round 20, the inflection intake: "every new feature strengthens the
  foundation")
- **Related:** IDEA-0127 (objective amendment), IDEA-0128 (Cognitive
  Profiler — P1 landed), IDEA-0129 (session-benchmark corpus),
  IDEA-0130 (kernel Replication + Recovery), IDEA-0048 (every spec
  section gets a conformance test), IDEA-0098 (UCM certification
  brands), governance/CONFORMANCE-AND-CERTIFICATION.md, IDEA-0131
  (CADR — decision records as immutability substrate)

## 1. The thesis

"Impossible to replace" invites a feature race: every mechanism UCH
builds — an IR, a bytecode, a runtime — is eventually reimplementable
by someone with enough time and money. "Impossible to reimplement" is
an ecosystem goal: the unit of reimplementation is not a mechanism but
a corpus. A competitor can copy a specification; they cannot cheaply
copy the accumulated certification suite, debugging infrastructure,
compatibility guarantees that compound across major versions, the
tooling gravity, and the ecosystem of certified products. JVM, Git,
and LLVM became foundational exactly this way — not because of
bytecode, commits, or IR, but because of what accumulated around them.

**The moat test (objective amendment, recorded here):** compatibility
claims are only valid through the conformance suite; the suite,
tooling, and compatibility guarantees make adopting the standard
cheaper than reimplementing it. The suite is the moat; the brand is
the gate; the corpus is the asset.

## 2. Why the corpus is the moat

| Mechanism                            | Exists     | Role in the moat                                                          |
| ------------------------------------ | ---------- | ------------------------------------------------------------------------- |
| Specification stack (10 docs, spec/) | ✅         | The thing to implement; every section gets a conformance test (IDEA-0048) |
| CP v1 ABI + catalog (17 ops)         | ✅         | ISA; conformance.ts certifies servers, compliance.ts certifies drivers    |
| CIR + 71-case certified corpus       | ✅         | Precedent: a corpus can be certified and versioned (RFC-0004)             |
| Test suite (~3000 tests / 201 files) | ✅         | Raw material — none gated as a certification corpus yet                   |
| Certification corpus + gate          | ✅ **new** | CONFORMANCE-CORPUS.md + certification-corpus.ts (WS-2, landed)            |
| Certification brands (UCM)           | 🔶         | Brand issuance path (IDEA-0098) — the only path to a compatibility claim  |
| Session-benchmark corpus             | ⬜         | Real sessions as replayable benchmark episodes (IDEA-0129)                |
| Cognitive Profiler                   | 🔶         | Performance engineering for cognition (IDEA-0128, P1 landed)              |
| Kernel Replication / Recovery        | ⬜         | The 14th/15th kernel primitives (IDEA-0130)                               |
| CADR decision records                | ⬜         | Immutable, consulted-at-decision-time precedent (IDEA-0131)               |

## 3. Program workstreams

| WS   | Workstream                                                                 | Status |
| ---- | -------------------------------------------------------------------------- | ------ |
| WS-1 | Five-spec canon — Constitution → Physics → ISA → Runtime/ABI → Conformance | 🔶     |
| WS-2 | Certification corpus: spec-section → suite mapping + coverage gate         | ✅     |
| WS-3 | Suite growth to certification (3000+ gated cases; close G-1..G-4)          | ⬜     |
| WS-4 | Session-benchmark corpus (every session a replayable episode)              | ⬜     |
| WS-5 | Cognitive Profiler (VTune for cognition; P1 landed, 17 tests)              | 🔶     |
| WS-6 | Kernel Replication + Recovery (14th/15th primitives)                       | ⬜     |
| WS-7 | RCE discipline naming (Runtime Cognitive Engineering)                      | ⬜     |
| WS-8 | CADR — immutable, consulted-at-decision-time records                       | ⬜     |

### Pointers and dependencies

- WS-1 — spec/ stack exists; canonical restructure under IDEA-0048
  (governance-gated, high-churn).
- WS-2 — `design/CONFORMANCE-CORPUS.md` + `src/protocol/certification-corpus.ts`
  (landed 2026-08-01, 12 tests).
- WS-3 — gap list in `design/CONFORMANCE-CORPUS.md` §4; pure test-suite
  work over existing machinery (round-20 freeze discipline).
- WS-4 — IDEA-0129; blocked on UER P2 (uer-ingest wave).
- WS-5 — IDEA-0128; P2 = span-level attribution + `uch profile` CLI
  (CLI wiring belongs to the landing wave).
- WS-6 — IDEA-0130; blocked on the persistence write-path (W-01 wave).
- WS-7 — naming-only; fold into docs on the next governance wave.
- WS-8 — IDEA-0131; unblocked, foundation-strengthening.

## 4. Sequencing

1. **WS-2 done** — the corpus exists and the gate is green (2026-08-01).
2. **WS-3 next** — the four partial-coverage gaps are pure
   test-suite work over existing machinery; no parallel-wave
   conflicts; each gap closes with suites, not new features
   (round-20 freeze discipline).
3. WS-5 P2 and WS-4 follow as their dependencies land (profiler CLI
   needs the landing wave; the session corpus needs UER P2).
4. WS-6 follows the persistence write-path wave.
5. WS-1/WS-7 are governance waves, sequenced after WS-3 demonstrates
   the per-section conformance pattern.

## 5. Acceptance criteria (the moat, measured)

- **C1:** every normative section of every spec document carries a
  conformance-suite reference (IDEA-0048) — measured by the
  certification corpus; gate green.
- **C2:** the certification corpus contains ≥ 3000 gated cases, each
  derived from a spec section (not from implementation details).
- **C3:** no third party can claim UCH compatibility without passing
  the suite — enforced by the brand issuance path (IDEA-0098) and by
  WS-2's gate being a release gate.
- **C4:** real sessions are captured as replayable episodes, and the
  corpus grows with usage (IDEA-0129) — the compounding asset.
- **C5:** adopting the standard costs less than reimplementing it —
  measured by documentation completeness (books I-V) and by the
  driver/package SDK surface (Epoch IV).

## 6. Governance

- Material changes to this program are RFC-0000 amendments, recorded
  here and in docs/ROADMAP.md (roadmap entries are amendments, not
  edits).
- The objective amendment is recorded in this program and the
  roadmap; the VISION §1/§2 text amendment awaits ratification by the
  vision-intake wave that owns VISION.md.
- The freeze (round 20) applies: every new item must strengthen the
  foundation — the program's workstreams are chosen accordingly.
