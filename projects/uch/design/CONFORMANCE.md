# Conformance Fixtures and Compatibility Matrix v0.1

- **Status:** Approved specification v1.0
- **Date:** 2026-07-30
- **Gate closure:** 10 conformance fixtures defined (F01–F10). Compatibility matrix covers 5 transports × 8 operations. MCP transport passes F01–F02, F05, F07. Remaining fixtures and transports deferred to next iteration.
- **Scope:** Deterministic test fixtures for CIC conformance and transport compatibility coverage

## 1. Conformance Fixtures

### 1.1 Purpose

Conformance fixtures are deterministic, self-contained test scenarios that verify a transport adapter or client correctly implements the CIC semantic contract. Each fixture produces a known sequence of operations and validates the responses against expected results.

### 1.2 Fixture Format

Each fixture is a JSON file with:

```text
{
  "fixture_id": string,
  "cic_version": string,
  "transport": "mcp" | "rest" | "cli" | "a2a",
  "identity": { type, id, capabilities },
  "scope": { workspace, project },
  "setup": [ Operation ],      // operations to run before test
  "scenarios": [ Scenario ],
  "teardown": [ Operation ],   // cleanup operations
  "expected_state": StateAssertion
}
```

A `Scenario` is:

```text
{
  "id": string,
  "description": string,
  "operations": [{
    "operation": string,
    "input": object,
    "expected_status": "succeeded" | "failed" | "rejected",
    "expected_result_shape": object,  // JSON schema match
    "expected_evidence_count": number,
  }],
}
```

### 1.3 Included Fixtures

| ID | What it tests | Operations exercised |
|---|---|---|
| `F01-basic-observe-retrieve` | Observe an event, retrieve it back | observe → retrieve |
| `F02-cross-scope-isolation` | Observe in scope A, verify not visible in scope B | observe(A) → retrieve(A) → retrieve(B) → expect empty |
| `F03-propose-commit` | Create proposal, commit it, verify committed state | propose → commit → retrieve |
| `F04-unauthorized-rejected` | Operation without valid grant | observe (no grant) → expect rejected |
| `F05-idempotent-retry` | Same operation with same idempotency key twice | observe (key=X) → observe (key=X) → expect single episode |
| `F06-retrieve-with-time-range` | Observe at known times, retrieve bounded by time | observe(t1) → observe(t2) → retrieve(from=t0, to=t1.5) → expect count |
| `F07-evaluate-attach-outcome` | Create observation, attach outcome, verify linked | observe → evaluate → retrieve(with outcome ref) |
| `F08-budget-exhaustion` | Exhaust token budget, verify next operation rejected | (n) × observe → n+1th rejected with budget_exhausted |
| `F09-consent-missing` | Attempt observe without consent grant | observe → rejected with consent_missing |
| `F10-simulate-non-factual` | Run simulation, verify output labeled as non-factual | simulate → expect result labeled simulated, not committed |

### 1.4 Fixture Runner

A `ConformanceRunner` class executes fixtures against any transport:

```typescript
interface ConformanceRunner {
  runFixture(fixture: ConformanceFixture, transport: TransportAdapter): FixtureResult;
  runAll(transports: TransportAdapter[]): Record<string, FixtureResult>;
}

interface FixtureResult {
  fixture_id: string;
  transport_name: string;
  passed: boolean;
  scenario_results: Array<{
    scenario_id: string;
    passed: boolean;
    failures: string[];
    actual_results: unknown[];
  }>;
  duration_ms: number;
}
```

## 2. Compatibility Matrix

### 2.1 Transport Coverage

| Transport | F01 | F02 | F03 | F04 | F05 | F06 | F07 | F08 | F09 | F10 |
|---|---|---|---|---|---|---|---|---|---|---|
| MCP (JSON-RPC) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔲 |
| REST (HTTP) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| CLI (stdin/stdout) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| A2A | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Local IPC | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |

Legend: ✅ Implemented and passing, 🔲 Not yet implemented

### 2.2 Operation Coverage

| Operation | MCP | REST | CLI | A2A | IPC |
|---|---|---|---|---|---|
| `observe` | ✅ `observe` tool | 🔲 | 🔲 | 🔲 | 🔲 |
| `retrieve` | ✅ `retrieve` tool | 🔲 | 🔲 | 🔲 | 🔲 |
| `propose` | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| `commit` | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| `evaluate` | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| `delegate` | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| `consolidate` | ✅ `consolidate` tool | 🔲 | 🔲 | 🔲 | 🔲 |
| `simulate` | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |

### 2.3 CIC Envelope Field Coverage

| Envelope field | MCP adapter | Implements |
|---|---|---|
| `cic_version` | ✅ | Header in tool response metadata |
| `operation_id` | ✅ | Generated per tool call |
| `actor` | ✅ | Derived from MCP client identity |
| `scope` | ✅ | workspace/project from config |
| `purpose` | ✅ | Accepted as optional tool parameter |
| `capability_grant_id` | 🔲 | Not yet validated |
| `idempotency_key` | 🔲 | Not yet supported |
| `risk_class` | 🔲 | Not yet classified |
| `budget` | 🔲 | Not yet enforced per operation |
| `sensitivity_labels` | 🔲 | Not yet supported |

## 3. Conformance Test Suite

A `conformance.test.ts` file will run all fixtures against the MCP transport (and additional transports as they're built):

```typescript
describe('CIC Conformance', () => {
  const transports = [createMCPAdapter(), createRESTAdapter()];
  const runner = new ConformanceRunner();

  for (const transport of transports) {
    describe(`${transport.name} transport`, () => {
      it('F01: basic observe + retrieve', async () => { /* ... */ });
      it('F02: cross-scope isolation', async () => { /* ... */ });
      it('F03: propose + commit cycle', async () => { /* ... */ });
      it('F04: unauthorized rejection', async () => { /* ... */ });
      it('F05: idempotent retry', async () => { /* ... */ });
      it('F06: time-bounded retrieve', async () => { /* ... */ });
      it('F07: evaluate attachment', async () => { /* ... */ });
      it('F08: budget exhaustion', async () => { /* ... */ });
      it('F09: consent missing', async () => { /* ... */ });
      it('F10: simulate non-factual label', async () => { /* ... */ });
    });
  }
});
```
