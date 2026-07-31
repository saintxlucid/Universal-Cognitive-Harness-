# Sensor & Effector Catalogs by Host

Part of the UCH Hive Mind (`design/UNIVERSAL-INTEGRATION.md`). This catalog
lists the observation surfaces (**sensors**) and reaction surfaces
(**effectors**) each host exposes, and maps them onto the shared
`src/drivers/sensors` / `src/drivers/effectors` implementations.

## 1. Mapping key

| Term | Meaning |
| --- | --- |
| Sensor | Reads one observation surface → `SensorObservation[]` (`src/drivers/sensors/sensor.ts`) |
| Effector | Reacts to declared event types, may emit follow-up events (`src/drivers/effectors/effector.ts`) |
| Implementation | Existing `src/drivers/sensors` / `src/drivers/effectors` class; `future` = contract exists, no implementation shipped yet |

Shared surfaces (git, session) are written once and composed into every
driver whose host exposes them — a driver never assumes privileged access
everywhere (ADR-005 L0–L4 ladder).

## 2. Claude

### Sensors

| Sensor | Surface | Implementation | Notes |
| --- | --- | --- | --- |
| Hook | Claude Code process hooks (`PreToolUse`, `PostToolUse`, …) | `future` | Per-session hook lifecycle; the hook surface is the Claude host's primary observation channel |
| Session | Session lifecycle (active / idle / ended) | `SessionSensor` (`src/drivers/sensors/session-sensor.ts`) | Host-agnostic — the Claude driver supplies a provider reporting native session status; change-only emission |
| Tool | Tool invocations and results | `future` | Observes `PreToolUse`/`PostToolUse` hooks and tool-result streams |
| Git | Workspace git state | `GitSensor` (`src/drivers/sensors/git-sensor.ts`) | Shared surface; branch, hash, change list via the git driver |
| Terminal | Shell session output | `future` | Claude Code terminal capture is host-owned; normalize to `terminal.*` observations |
| MCP | MCP client/server traffic | `future` | Observes MCP tool calls routed through the harness |
| Skill | Skill loads and invocations | `future` | Skill registry access is host-visible in Claude Code |
| Diff | File diffs at edit/apply time | `future` | `git diff`-shaped payloads; feeds engineering-intelligence review |
| Approval | Permission / approval events | `future` | Approval-requested / granted / denied lifecycle |

### Effectors

| Effector | Reacts to | Implementation | Notes |
| --- | --- | --- | --- |
| Memory-Injection | Failure signals (`error:occurred`, `verification:failed`, `test:failed`) | `MemoryEffector` (`src/drivers/effectors/memory-effector.ts`) | Emits `memory.suggested` for the organism to index |
| Prompt-Augmentation | Context/recall events | `future` | Injects recalled context into the next request |
| Policy-Enforcement | Policy-denial events | `future` | Enforces constitution/CIC outcomes on the host side |
| Architecture-Suggestion | Engineering-review findings | `future` | Surfaces refactoring/architecture suggestions |
| Test-Injection | Test-run events | `future` | Injects suggested test cases into the run loop |
| Context-Compression | Token/context pressure | `future` | Compresses/evicts context per the retrieval-scaling policy |
| Tool-Selection | Tool-resolution events | `future` | Nudges tool routing (fast-path router alignment) |
| Skill-Activation | Skill-relevant signals | `future` | Activates the best-fit skill for the current task |

## 3. VS Code

Integration mechanism: the extension host (no process hooks — see
`design/integrations/VSCODE.md`). Sensors compose the shared implementations
where the surface matches.

| Sensor | Surface | Implementation | Notes |
| --- | --- | --- | --- |
| Extension | Extension host lifecycle (`activate`/`deactivate`, commands) | `future` | The VS Code driver's own lifecycle becomes `session.lifecycle` input |
| Agent-Host | Copilot Chat / agent-mode turns | `future` | Own `@hive` participant turns only; other participants' chats are captured passively from disk (VSCODE.md §1) |
| Git | Workspace git state | `GitSensor` (`src/drivers/sensors/git-sensor.ts`) | Shared surface; the extension's git extension APIs feed it |
| LSP | Language server diagnostics | `future` | `vscode.languages` diagnostics → `lsp.diagnostics` observations |
| Debug | Debug session lifecycle | `future` | `debug.onDidStartDebugSession` → `background.process` events (VSCODE.md §1) |
| Test | Test run events | `future` | `vscode.tests` → `test:started` / `test:finished` / `test:failed` observations |
| Build | Task/build events | `future` | `tasks.onDidStartTask` → `build.finished` observations |
| Terminal | Terminal shell execution | `future` | `window.onDidStartTerminalShellExecution` → `terminal.*` observations |
