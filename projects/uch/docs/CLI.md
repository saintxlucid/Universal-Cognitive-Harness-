# UCH CLI Reference

The `uch` executable is the single entry point for the harness. Run it
from `projects/uch` after `npm run build`:

```bash
node dist/cli/index.js <command> [args]
```

## Commands

### `uch` (no args) — MCP STDIO server

Starts the MCP server over stdin/stdout for AI tool integration.
Prints startup status to stderr, speaks MCP protocol on stdout.

```bash
node dist/cli/index.js            # LLM disabled → deterministic local mode
OPENAI_API_KEY=<key> node dist/cli/index.js   # LLM enabled
```

### `uch mcp` — alias of the above

### `uch serve` — legacy HTTP/SSE server

Starts the UCCP (Universal Cognitive Control Protocol) HTTP server for
network clients.

```bash
node dist/cli/index.js serve
```

### `uch help`

Prints the command reference and environment summary.

### Core cognitive commands

| Command | Purpose |
| --- | --- |
| `uch status` | Show cognitive system status |
| `uch attach` | Attach to the workspace: discover manifest, negotiate version/capabilities/drivers, start drivers, emit `workspace:opened` + `agent:attached` |
| `uch ingest` | Ingest git history into memory (episodic memory from commits) |
| `uch remember <text>` | Store something in memory |
| `uch recall <query>` | Search memory (provenance-weighted fusion) |
| `uch think "<prompt>"` | Internal reasoning turn (cognitive tools only) |
| `uch chat "<prompt>"` | Alias for `think` |
| `uch skills` | List loaded skills |

### Session commands

| Command | Purpose |
| --- | --- |
| `uch session list` | List saved sessions |
| `uch session export <id>` | Export a session as a handoff document |

### Workspace manifest commands

| Command | Purpose |
| --- | --- |
| `uch manifest init` | Create `.uch/uch.manifest.json` (refuses to overwrite) |
| `uch manifest show` | Show the discovered workspace manifest |

The manifest is the workspace's cognitive configuration — identity, runtime
requirements, capabilities, drivers, skills, policies. `uch attach` runs the
full discovery + negotiation lifecycle. See
[../design/WORKSPACE-MANIFEST.md](../design/WORKSPACE-MANIFEST.md).

### Skill commands

| Command | Purpose |
| --- | --- |
| `uch skill scan <dir>` | Scan an external skill pack (SKILL.md format) |
| `uch skill catalog <dir>` | Catalog an external skill repository |
| `uch skill import <dir> <name…> [--force]` | Install skills into `./skills` with provenance index |
| `uch skill create <name> "<desc>"` | Create a new skill from template |
| `uch skill optimize` | Analyze skill invocations, suggest improvements |
| `uch skill provenance` | Show which skills were imported, from where, and when |

See [SKILLS.md](SKILLS.md) for the full skill workflow.

### Memory search commands (progressive search)

| Command | Purpose |
| --- | --- |
| `uch mem-search "<query>"` | Layer 1: index search over memory |
| `uch mem-timeline <id>` | Layer 2: chronological context around a memory |
| `uch mem-get <id> [id…]` | Layer 3: full details for specific memory IDs |

### Retrieval & synthesis commands

| Command | Purpose |
| --- | --- |
| `uch gap-analysis "<query>"` | Synthesis with citations, coverage gaps, contradictions, staleness, confidence |
| `uch synthesize "<query>"` | Grounded synthesis: claims with `[source]` citation markers |

`uch synthesize` refuses to assert anything without retrieved sources —
unattributable claims surface as gaps.

### Takes & calibration commands

| Command | Purpose |
| --- | --- |
| `uch takes add "<claim>" <cv>` | Record a gradeable claim with conviction 0–1 |
| `uch takes resolve <id> <q>` | Grade a take: `correct|incorrect|partial|unresolvable` |
| `uch takes list [--open\|--resolved]` | List takes |
| `uch calibration` | Show calibration profile (Brier score, scorecards, bias tags) |

```bash
uch takes add "UCH calibration will reduce recall errors" 0.65
uch takes resolve <id> correct
uch calibration
```

### Principles command

| Command | Purpose |
| --- | --- |
| `uch principles-check` | Evaluate a change against the 4 coding principles (think before coding, simplicity first, surgical changes, goal-driven execution) |
| `uch organic-score` | Score a change against the 15-metric Organic Score rubric (>=90 pass, 70-89 revise, <70 reject; security and error-masking are constitutional vetoes). Format: `uch organic-score "<change> [:: intent] [:: files: a.ts,b.ts] [:: tests: npm test]"` |

## Environment

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | LLM completions + embeddings (default provider) |
| `ANTHROPIC_API_KEY` | Alternative provider |
| `OPENAI_BASE_URL` | Custom endpoint (proxies, local models) |
| `UCH_LLM_PROVIDER` | `openai \| anthropic \| google \| auto` |
| `UCH_LLM_MODEL` | Default model override |
| `CEREBRAS_API_KEY[_1..3]` | Inference fabric compute resources |
| `UCH_RECENCY_DECAY` | Recency decay overrides: `prefix:halflifeDays:coefficient,…` |

## State

Runtime state lives under `.uccp/` (gitignored):

- `.uccp/persist/` — kernel memory persistence
- `.uccp/calibration/takes.json` — takes record
- `.uccp/sessions/` — saved sessions
