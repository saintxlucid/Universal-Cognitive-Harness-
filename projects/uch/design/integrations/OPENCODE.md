# UCH × OpenCode — Standalone Integration

Part of the UCH Hive Mind (`design/UNIVERSAL-INTEGRATION.md`). OpenCode is the
runtime with the deepest native hook surface — the plugin is the primary
adapter, the on-disk storage is the passive ingestor, and the SDK client is the
drive surface.

## 1. Mechanism of integration (verified, July 2026)

| Surface | Mechanism | What UCH does |
| --- | --- | --- |
| Live capture | `.opencode/plugins/uch-hive.ts` — plugin hooks (`event`, `chat.message`, `message.part.updated`, `tool.execute.before/after`, `session.*`, `experimental.session.compacting`) | every prompt, answer, **reasoning part**, tool call, and session event → HiveEvent |
| Custom tools | `tool` export (`tool({description, args, execute})`) | `uch_recall`, `uch_remember`, `uch_status`… available to the model in every session |
| MCP | `mcp` key in `opencode.json` | UCH MCP server (STDIO) → all 25+ cognitive tools |
| Passive ingest | daemon tail of `~/.local/share/opencode/storage/` or `opencode.db` | backfill + capture even without the plugin |
| Drive | `ctx.client.session.prompt` (SDK), `opencode run` | hive background agents can drive OpenCode sessions |
| System prompt | `experimental.chat.system.transform` hook | inject hive context/conventions into every LLM call |
| Background | `tool.execute.*` on `bash` + `shell.env` | agent shell commands → `background.process` |

Storage base path (XDG): Linux `~/.local/share/opencode/`, Windows
`%USERPROFILE%\.local\share\opencode\`.

## 2. Config (`opencode.json` / `.opencode/opencode.json`)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": {
    "uch-hive": { "path": ".opencode/plugins/uch-hive.ts" }
  },
  "mcp": {
    "uch": {
      "type": "local",
      "command": ["node", "X:/Software Development/projects/uch/dist/cli/index.js", "mcp"],
      "enabled": true
    }
  }
}
```

(Resolve the UCH path dynamically; prefer `uch mcp` from PATH once installed.)

## 3. Plugin (`uch-hive.ts`) — capture outline

```ts
import type { Plugin } from "@opencode-ai/plugin";

export const UCHHive: Plugin = async (ctx) => {
  const hive = await SpoolClient.open();           // append .hive.jsonl to ~/.uch/spool (or HTTP POST)
  const session = { runtime: "opencode", workspaceId: await workspaceIdOf(ctx.worktree) };

  return {
    // session lifecycle
    event: async ({ event }) => {
      switch (event.type) {
        case "session.created": await hive.emit({ ...session, runtimeSessionId: event.properties.id, kind: "session.start", payload: { title: event.properties.title } }); break;
        case "session.idle":    await hive.emit({ ...session, runtimeSessionId: event.properties.id, kind: "session.end",   payload: { reason: "idle" } }); break;
        case "session.updated": /* title changes */ break;
        case "session.compacted": await hive.emit({ ...session, runtimeSessionId: event.properties.id, kind: "session.compact", payload: { summary: event.properties.summary } }); break;
      }
    },

    // every message + its parts (includes reasoning parts!)
    "message.part.updated": async (input, output) => {
      // input: { sessionID, messageID, partID }  output: { info: Part }
      if (!output?.info) return;
      const p = output.info;
      const base = { ...session, runtimeSessionId: input.sessionID, meta: { model: undefined } };
      if (p.type === "text")       await hive.emit({ ...base, kind: "assistant.message", payload: { text: p.text, messageId: input.messageID, partId: input.partID } });
      else if (p.type === "reasoning") await hive.emit({ ...base, kind: "reasoning",
        payload: { text: p.text, startedAt: p.start, endedAt: p.end, messageId: input.messageID, partId: input.partID } });
      else if (p.type === "tool")  await hive.emit({ ...base, kind: "tool.call", payload: { tool: p.tool, input: p.state?.input, state: p.state?.status } });
    },

    "chat.message": async (input, output) => {
      // input: { sessionID, messageID }  output: { message, parts }
      if (output.message.role === "user") await hive.emit({ ...session, runtimeSessionId: input.sessionID,
        kind: "user.prompt", payload: { text: output.message.content, messageId: input.messageID } });
    },

    // tool execution (input: {tool, sessionID, callID}, output: {args} / {title, output, metadata})
    "tool.execute.before": async (input, output) => {
      await hive.emit({ ...session, runtimeSessionId: input.sessionID, kind: "tool.call",
        payload: { tool: input.tool, input: output.args, callId: input.callID } });
    },
    "tool.execute.after": async (input, output) => {
      await hive.emit({ ...session, runtimeSessionId: input.sessionID, kind: "tool.result",
        payload: { tool: input.tool, output: output.output?.slice(0, 65536), error: output.metadata?.error ?? undefined, callId: input.callID } });
      if (input.tool === "bash") await hive.emit({ ...session, runtimeSessionId: input.sessionID, kind: "background.process",
        payload: { kind: "shell", command: output.args?.command, output: output.output?.slice(0, 4096) } });
    },

    // inject hive context into every LLM call
    "experimental.chat.system.transform": async (_input, output) => {
      const ctx = await hive.recall("context");     // top conventions/decisions/handoffs
      output.system.push({ type: "text", text: `## UCH hive context\n${ctx}` });
    },

    // keep context across compaction
    "experimental.session.compacting": async (_input, output) => {
      output.context.push("Hive continuity: " + (await hive.handoffDoc()));
    },
  };
};
```

Note on hook signatures: OpenCode passes `(input, output)` pairs; unknown hooks
are silently ignored, so the plugin must target exact names — the full verified
list is in the plugin SDK (`node_modules/@opencode-ai/plugin/dist/index.d.ts`):
`tool.execute.before/after`, `session.created/updated/compacted/deleted/diff/error/idle/status`,
`message.part.updated/removed`, `message.updated/removed`, `chat.message`,
`chat.params`, `permission.ask`/`permission.asked`/`permission.replied`,
`server.connected`, `file.edited`, `file.watcher.updated`, `lsp.*`, `todo.updated`,
`shell.env`, `tui.*`, `command.executed`, `experimental.session.compacting`,
`experimental.chat.system.transform`.

## 4. Custom tools (available to the model)

```ts
import { tool } from "@opencode-ai/plugin";

tool: {
  uch_recall: tool({
    description: "Search the UCH hive memory (all tools) for relevant context, decisions, conventions, sessions",
    args: { query: tool.schema.string().describe("semantic query") },
    async execute({ query }) { return JSON.stringify(await hive.recall(query)); },
  }),
  uch_remember: tool({
    description: "Store a durable fact/decision/convention into the UCH hive",
    args: { type: tool.schema.enum(["decision", "convention", "fact"]).describe("kind"),
            text: tool.schema.string() },
    async execute(args) { return String(await hive.emit({ ...session, kind: args.type, payload: { text: args.text } })); },
  }),
  uch_status: tool({
    description: "UCH hive status: sessions, memory, trace count",
    args: {},
    async execute() { return JSON.stringify(await hive.status()); },
  }),
}
```

## 5. Passive ingest (daemon-side, no plugin required)

Read either storage layout (newer releases use SQLite; older use JSON files):

| Layout | Path | Read |
| --- | --- | --- |
| SQLite | `~/.local/share/opencode/opencode.db` (+ `-wal`) | tables `session`, `message`, `part`; `info` column holds full serialized JSON; also `event`, `event_sequence`, `session_share`, `project`, `workspace`, `permission` |
| JSON files | `~/.local/share/opencode/storage/{session,message,part,session_diff}/...` | `session/<projectID>/<sessionID>.json`, `message/<sessionID>/<messageID>.json`, `part/<messageID>/<partID>.json` (types: `text`, `reasoning` with `start`/`end`, `tool` with `state`/`input`, `file`, `snapshot`, `step-start`…), `session_diff/<sessionID>.json` |

Project linkage: repo-local `.git/opencode` holds the `project.id`; map to hive
workspaceId via git-root hash. Part id ↔ trace: use part `id` as nativeId;
message `info.tokens` (input/output/**reasoning**/cache read/write) and `finish`
feed `meta.tokens` / `assistant.message.finishReason`.

## 6. Drive (hive → OpenCode)

- SDK (`@opencode-ai/sdk`): `client.session.prompt({ path: { id }, body: { ... } })`,
  `client.session.messages`, `session.command`, event stream subscription —
  used by UCH background agents to dispatch tasks to OpenCode and read results
  back into the ledger (`kind: "handoff"` on completion).
- CLI: `opencode run "<prompt>" --format json --print-logs --session <id>` for
  headless one-shots; `--continue` to resume.

## 7. Testing

- Plugin unit tests run under bun with a mocked `ctx.client` + spool.
- Fixture-based ingestor tests: scrubbed sample `opencode.db` + JSON storage
  tree → expected HiveEvents.
- E2E (manual, gated): `opencode run` with plugin installed → ledger contains
  session.start / user.prompt / reasoning (with thinking model) / tool.* /
  session.end; `uch_recall` tool answers from a Claude Code session.
