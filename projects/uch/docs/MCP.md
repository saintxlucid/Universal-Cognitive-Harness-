# UCH MCP Reference

UCH exposes its cognitive capabilities to any MCP-compatible client
(Claude Code, OpenCode, VS Code, Cursor, Claude Desktop, …).

## Transports

| Transport | Command | Use for |
| --- | --- | --- |
| **STDIO** (default) | `node dist/cli/index.js` | Local clients; standard MCP configuration |
| **HTTP/SSE (legacy)** | `node dist/cli/index.js serve` | Network clients via the UCCP protocol |

### Connecting

Point your MCP client at the STDIO server:

```json
{
  "mcpServers": {
    "uch": {
      "command": "node",
      "args": ["path/to/projects/uch/dist/cli/index.js"]
    }
  }
}
```

## Tools (23)

### Memory

| Tool | Purpose |
| --- | --- |
| `observe` | Ingest an observation into memory (provenance-weighted) |
| `remember` | Store an important fact or decision |
| `recall` | Search memory for relevant past context |
| `mem-search` | Progressive memory search — layer 1 (index) |
| `mem-get` | Full details for specific memory IDs |
| `sm-store` | Scientific-memory store |
| `sm-recall` | Scientific-memory recall |
| `sm-facts` | Scientific-memory facts |

### Sessions

| Tool | Purpose |
| --- | --- |
| `session-save` | Save the current session |
| `session-load` | Load a saved session |
| `session-list` | List saved sessions |
| `session-handoff` | Export a handoff document for another agent/runtime |

### Cognition

| Tool | Purpose |
| --- | --- |
| `plan` | Break a task into a step-by-step plan |
| `reflect` | Record a structured reflection |
| `learn` | Extract durable lessons from an interaction |
| `critique` | Critically evaluate a proposal or result |
| `constitution-check` | Check an action against the Cognitive Constitution |
| `extract-concepts` | Extract concepts from text |
| `status` | Report current cognitive state |

### Retrieval & Analysis

| Tool | Purpose |
| --- | --- |
| `gap-analysis` | Synthesis with citations: coverage gaps, contradictions, staleness, confidence |
| `principles-check` | Evaluate a change against the 4 coding principles (supports an optional `plan` array as the verification loop) |
| `organic-score` | Evaluate a change against the 15-metric Organic Score rubric (>=90 pass, 70-89 revise, <70 reject; security/error-masking flags are constitutional vetoes) |
| `summarize` | Summarize text (compression accelerator) |

### Git & Scheduling

| Tool | Purpose |
| --- | --- |
| `git-ingest` | Ingest git history into memory |
| `schedule` | Schedule a cognitive accelerator task |

## LLM Modes

- **LLM enabled** (`OPENAI_API_KEY` set): full completions, embeddings,
  semantic search.
- **LLM disabled**: deterministic local mode — retrieval, fusion,
  synthesis, takes, principles-check all work without any network call.

The server announces its mode on stderr at startup:

```
UCH MCP Server v0.2.0 — LLM: enabled
UCH MCP Server v0.2.0 — LLM: disabled (set OPENAI_API_KEY)
```
