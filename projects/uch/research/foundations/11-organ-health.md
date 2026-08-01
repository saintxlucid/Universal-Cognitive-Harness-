---
track: reliability
status: research-draft
version: 0.1.0
sources:
  - https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/ (Kubernetes — container states: Running/Crashed/Terminating; restart policies)
  - https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/ (Kubernetes — liveness vs readiness probes)
  - https://sre.google/sre-book/monitoring-distributed-systems/ (Google SRE book — monitoring, alerting, paging on symptoms)
  - https://en.wikipedia.org/wiki/Watchdog_timer (watchdog timer theory — missed beat → reset)
  - https://www.microsoft.com/en-us/windows (Windows safe mode — recovery boot with minimal drivers)
  - https://www.rfc-editor.org/rfc/rfc8707 (deterministic record-replay lineage — corpus anchor: ADR-002 ledger replay)
---

# Organ Health, Watchdogs & Safe Mode — G1 evidence register (IDEA-0070)

Evidence register for `rfc/ideas/IDEA-0070-organ-health-watchdogs-safe-
mode.md`: every organ reports Alive / Healthy / Degraded / Recovering /
Failed / Sleeping; every subsystem gets heartbeat monitoring; crashes
restart with state restore and signal replay; quarantine isolates bad
memories/skills/plugins/genomes; safe mode boots without learning,
plugins, or evolution.

## 1. Health states and probes

| Evidence | Source |
| --- | --- |
| Kubernetes distinguishes *liveness* (is the process alive? restart it if not) from *readiness* (is it serving? remove from rotation if not) — different probes, different responses | Kubernetes probe documentation |
| A container's lifecycle is a state machine (Pending → Running → Succeeded/Failed) with explicit crash states and restart policies (Always/OnFailure/Never) | Kubernetes pod lifecycle |
| Production monitoring separates symptoms (what users feel) from causes (what is broken); paging requires actionable, on-call-rootable alerts | Google SRE book, "Monitoring Distributed Systems" |

**Corpus anchor:** WS-E (`src/kernel/diagnostics/`) already computes 12
SMART metrics with band logic (higher-is-better, worst-wins
aggregation); the fast-path router ships builtin status/health/memory
routines. What is missing is the per-organ *state machine* these
feed — the prototype supplies `Alive → Healthy → Degraded →
Recovering → Failed` + `Sleeping`.

## 2. Watchdogs — missed beat → escalation

| Evidence | Source |
| --- | --- |
| A watchdog timer is a hardware/software device that resets a system when a periodic heartbeat is missed; the fundamental primitive of liveness detection | Watchdog timer (embedded/OS practice) |
| Escalation must be graduated: a single missed beat is jitter; repeated misses are failure; restarts are rate-limited to avoid crash loops | Kubernetes restart backoff (CrashLoopBackOff) |

**Corpus anchor:** heartbeats exist only in transports (SSE/A2A keep-
alive) and the parahippocampal poisoning watchdog; the prototype
generalizes missed-beat escalation to every organ with a deterministic
tick (no wall-clock dependence, per the cognitive clock convention).

## 3. Self-healing — restart, restore, replay

| Evidence | Source |
| --- | --- |
| The standard recovery loop for stateful services: restart the process, restore from the last checkpoint, and replay the event log since the checkpoint (record-replay / deterministic replay) | Database and stream processing practice (WAL replay; Kafka consumer replay) |
| Deterministic replay requires that the replayed inputs be *the same* inputs — the corpus's OTel trace ledger (ADR-002) is exactly this substrate, and UER (IDEA-0047) supplies the causal graph | ADR-002; IDEA-0047 |
| Crash loops must be bounded: restart backoff, then terminal failure with an operator path | Kubernetes CrashLoopBackOff |

**Corpus anchor:** `design/FAILURE-RETRY.md` documents retry policy
and the immune organ detects infections; the prototype wires the loop:
restart → `recovering` → replay signals → `healthy`, with a bounded
restart budget.

## 4. Quarantine and safe mode

| Evidence | Source |
| --- | --- |
| Safe mode boots a minimal configuration (core drivers only, third-party disabled) to allow diagnosis and repair; the OS itself remains available | Windows safe mode; *nix single-user mode |
| Quarantine precedes deletion: an untrusted object is isolated and inspectable before any decision about removal | WS-P package quarantine (corpus anchor); antivirus practice |

**Corpus anchor:** WS-P already quarantines packages (policy
quarantine, tamper detection) and the immune organ quarantines
conceptual infections; IDEA-0070 extends quarantine to memories,
skills, and genomes, and adds the safe-mode boot flag that the
corpus greps as absent.

## Prototype claims

- Per-organ health state machine with validated transitions and a
  deterministic tick-based heartbeat.
- Graduated escalation: missed beats degrade, then recover (restart +
  replay), then fail after a bounded restart budget.
- Sleeping as a first-class energy-aware state (suspend/resume).
- Safe-mode boot gating: kernel + constitution organs only.
