# Getting Started with UCH

This guide takes you from zero to a working cognitive substrate in about
ten minutes. It assumes Node.js 18+ (ESM) and npm.

## 1. Install and build

```bash
cd projects/uch
npm install
npm run build          # tsc → dist/
```

The runtime has exactly three dependencies (`@opentelemetry/api` for the
trace contract, `glob`, `openai` for optional embeddings). Everything else
is in `src/`.

## 2. Verify the substrate

```bash
node dist/cli/index.js status
```

You should see the cognitive system report — version, kernel, stores,
and health. Next, verify the gates:

```bash
npm test               # vitest — 154 files / 2,436 tests
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src/
npm run check:spec-version
```

## 3. Talk to it — without an LLM

UCH is fully functional without any API key: the cognitive organs
(memory, governance, traces, organic score, engineering review) are
deterministic. Try:

```bash
node dist/cli/index.js remember "The workspace owns the intelligence"
node dist/cli/index.js recall "intelligence"
node dist/cli/index.js session list
```

To enable LLM completions and embeddings, copy `.env.example` → `.env`
and set `OPENAI_API_KEY` (Anthropic is supported as an alternative
provider). `uch think "..."` then runs a full cognitive turn.

## 4. Run as an MCP server

The default command starts the MCP STDIO server — 25 cognitive tools
(`remember`, `recall`, `organic-score`, `engineering-review`,
`framework-run`, `cp.invoke`, …). Connect it to any MCP client:

```json
{
  "mcpServers": {
    "uch": {
      "command": "node",
      "args": ["path/to/uch/dist/cli/index.js", "mcp"]
    }
  }
}
```

See [docs/MCP.md](MCP.md) for the full tool list and transports
(STDIO, SSE, HTTP, WebSocket, IPC, A2A).

## 5. Attach to a workspace

Attachment is the defining move: the workspace wakes up, the driver
does not point at it.

```bash
node dist/cli/index.js manifest init      # create .uch/uch.manifest.json
node dist/cli/index.js attach             # discover → negotiate → grant → project
node dist/cli/index.js manifest show      # what the workspace exposes
```

Every agent that attaches receives a **scoped grant** and an **authorized
projection** of workspace state — never an unrestricted memory dump.
Two agents attaching to the same workspace see different slices by design.

## 6. Use the agent plugin

Claude Code, Codex, and OpenCode auto-load UCH on startup via the boot
module (`src/agent/`). You get persistent memory, skill loading, session
handoff, and cognitive continuity across runs — switch tools mid-task and
the cognition stays.

```ts
import { bootUCH } from './projects/uch/dist/agent/boot.js';
globalThis.uch = await bootUCH({ toolName: 'claude-code' });
const ctx = await globalThis.uch.getContext(userMessage);
```

## 7. Put the engineering gates on your changes

```bash
node dist/cli/index.js organic-score "your diff or code" --kind code
node dist/cli/index.js engineering-review "<diff or prose>"
node dist/cli/index.js engineering-benchmark
node dist/cli/index.js governance "a proposed change"
```

`organic-score` evaluates the 15-metric Organic Score rubric; engineering
vetoes (SPOF, unrecovered failure, pathological complexity) **hard-reject**
regardless of score. This is the same gate the substrate uses on itself.

## 8. What to read next

| Interest | Start here |
| --- | --- |
| Why this exists | [docs/GENESIS.md](GENESIS.md) ch. 1–3, [MANIFESTO.md](../MANIFESTO.md) |
| The laws | [spec/LAWS_OF_COGNITIVE_PHYSICS.md](../spec/LAWS_OF_COGNITIVE_PHYSICS.md) (32 laws, five families) |
| The contract | [spec/CP.md](../spec/CP.md) (v1 ABI), [design/CIC-SPECIFICATION.md](../design/CIC-SPECIFICATION.md) |
| How decisions are made | [rfc/RFC-0000-specification-governance.md](../rfc/RFC-0000-specification-governance.md) |
| The roadmap | [docs/ROADMAP.md](ROADMAP.md) |
| Full CLI reference | [docs/CLI.md](CLI.md) |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `LLM: disabled` | Set `OPENAI_API_KEY` in `.env` — core functions work without it |
| Tests fail under full parallel run | Known resource-contention flake in `ingester-injection`; rerun alone |
| `attach` finds no manifest | Run `uch manifest init` first in the workspace root |
| Old spec gate fails | `spec/VERSION.md` must declare version + date; see [spec/VERSION.md](../spec/VERSION.md) |
