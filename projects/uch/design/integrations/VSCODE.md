# UCH × VS Code + GitHub Copilot Chat — Standalone Integration

Part of the UCH Hive Mind (`design/UNIVERSAL-INTEGRATION.md`). This spec covers
the VS Code extension (`uch.vscode`) that binds VS Code and GitHub Copilot Chat
to the hive.

## 1. Mechanism of integration (verified, July 2026)

VS Code is the only target without process hooks — integration is via the
**extension host**:

| Surface | API | What UCH does |
| --- | --- | --- |
| Chat | `vscode.chat.createChatParticipant('uch.hive', handler)` | `@hive` participant: answers from hive memory; its own turns are logged to the ledger (the only chat this API can see) |
| Tools | `vscode.lm.registerLanguageModelTool(metadata, tool)` + `languageModelTools` contribution | `uch_recall`, `uch_remember`, `uch_trace`, `uch_plan`, `uch_handoff`… auto-invoked by Copilot agent mode |
| MCP | `mcpServers` contribution point + `vscode.lm.registerMcpServerDefinitionProvider` | runs UCH MCP server (streamable HTTP) so ALL of UCH's 25+ tools are usable in chat |
| History | passive ingest (below) | full Copilot chat history enters the ledger even though no public API exposes other participants' chats |
| Background | `window.onDidStartTerminalShellExecution`, `tasks.onDidStartTask`, `debug.onDidStartDebugSession` | terminal/task/debug runs become `background.process` events |
| Instructions | `.github/copilot-instructions.md` + participant system prompt | hive context injected into Copilot requests |

**Limitation (documented):** VS Code exposes no public API to observe *other*
participants' conversations (no chat middleware), and Copilot does not expose
model reasoning anywhere (API, journals, or OTel span store). The extension
therefore captures (a) its own `@hive` participant turns live, and (b) **all**
Copilot sessions passively from disk (§4). COT is unavailable on this surface —
the hive's COT vault gets nothing from VS Code.

## 2. Extension manifest (`package.json` contributions)

```jsonc
{
  "name": "uch-hive",
  "displayName": "UCH Hive",
  "engines": { "vscode": "^1.99.0" },
  "activationEvents": [
    "onStartupFinished",
    "onChatParticipant:uch.hive",
    "onLanguageModelTool:uch_hive.uch_recall",
    "onLanguageModelTool:uch_hive.uch_remember",
    "onLanguageModelTool:uch_hive.uch_trace",
    "onLanguageModelChat:uch_hive.uch_recall",
    "onLanguageModelChat:uch_hive.uch_remember",
    "onLanguageModelChat:uch_hive.uch_trace"
  ],
  "contributes": {
    "chatParticipants": [
      {
        "id": "uch.hive",
        "name": "hive",
        "fullName": "UCH Hive",
        "description": "Ask the UCH hive mind: memory, decisions, sessions, handoffs.",
        "isSticky": true,
        "commands": [
          { "name": "recall", "title": "Recall relevant memory" },
          { "name": "handoff", "title": "Hand off to another tool" },
          { "name": "status", "title": "Hive status" }
        ]
      }
    ],
    "languageModelTools": [
      {
        "name": "uch_hive.uch_recall",
        "displayName": "UCH Recall",
        "modelDescription": "Search the UCH hive memory for relevant past context, decisions, conventions and sessions across all AI tools.",
        "icon": "$(database)",
        "canBeReferencedInPrompt": true
      },
      { "name": "uch_hive.uch_remember", "displayName": "UCH Remember",
        "modelDescription": "Store a durable fact or decision into the UCH hive.", "canBeReferencedInPrompt": false },
      { "name": "uch_hive.uch_trace", "displayName": "UCH Trace",
        "modelDescription": "Return the cognitive trace spans for a session or prompt.", "canBeReferencedInPrompt": false }
    ],
    "mcpServers": [
      {
        "id": "uch-hive",
        "name": "UCH Hive",
        "type": "local",
        "description": "UCH cognitive MCP server",
        "url": "http://127.0.0.1:3999/mcp"
      }
    ],
    "commands": [
      { "command": "uch.hive.status", "title": "UCH: Hive Status" },
      { "command": "uch.hive.export", "title": "UCH: Export session to hive" },
      { "command": "uch.hive.openLedger", "title": "UCH: Open Ledger View" }
    ],
    "viewsContainers": { "activitybar": [{ "id": "uch-hive", "title": "UCH Hive", "icon": "icon.svg" }] },
    "views": {
      "uch-hive": [
        { "id": "uch.sessions", "name": "Sessions" },
        { "id": "uch.memory", "name": "Memory" }
      ]
    }
  }
}
```

Note: the `mcpServers` contribution needs the corresponding
`registerMcpServerDefinitionProvider` implementation to supply the live
definition (see §3); static URL + dynamic provider are both supported by
VS Code's MCP dev guide.

## 3. Extension host outline (`src/extension.ts`)

```ts
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const hive = await HiveClient.connect(await loadToken());   // POST/GET http://127.0.0.1:3999/hive/*

  // ── 1. Chat participant ─────────────────────────────────────────────
  const hiveChat = vscode.chat.createChatParticipant('uch.hive', async (request, stream, token) => {
    await hive.emit('user.prompt', { text: request.prompt, command: request.command,
                                     references: request.references?.map(r => r.value), runtime: 'vscode' });
    const context = await hive.recall(request.prompt);          // MCP recall
    const lm = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    const model = lm?.[0];
    const response = model
      ? (await model.sendRequest([{ role: 'user' as const,
          content: `You are the UCH hive oracle...\n\nContext:\n${context}\n\nQuestion: ${request.prompt}` }],
          { tools: [uchTools] }, token)).text
      : `Hive context (no LM available):\n${context}`;
    stream.markdown(response);
    await hive.emit('assistant.message', { text: response, model: model?.id, runtime: 'vscode' });
  }, { model: 'gpt-5.2-codex', isSticky: true, toolReferenceNames: ['uch_hive.uch_recall'] });

  hiveChat.registerCommand('recall', async (request, stream) => { /* … */ });
  hiveChat.registerCommand('handoff', async (request, stream) => { /* … */ });
  vscode.chat.registerChatParticipantDetection?.(hiveChat, { /* optional /detect */ });

  // ── 2. LM tools (auto-invoked by Copilot agent mode) ────────────────
  const recallTool = await vscode.lm.registerLanguageModelTool('uch_hive.uch_recall', {
    async invoke(input, _ctx, token) {
      return { returnData: JSON.stringify(await hive.recall(String(input.query ?? ''))) };
    },
  } satisfies vscode.LanguageModelTool<{ query: string }>);
  const rememberTool = await vscode.lm.registerLanguageModelTool('uch_hive.uch_remember', { /* → hive.emit('decision'|'convention') */ });
  const traceTool = await vscode.lm.registerLanguageModelTool('uch_hive.uch_trace', { /* → hive.trace(sessionId) */ });

  // ── 3. MCP server definition provider ───────────────────────────────
  context.subscriptions.push(vscode.lm.registerMcpServerDefinitionProvider?.(
    { id: 'uch-hive' },
    { mcpServers: { 'uch-hive': { type: 'http', url: 'http://127.0.0.1:3999/mcp',
                                  headers: { authorization: `Bearer ${token}` } } } },
  ));

  // ── 4. Background process observers ─────────────────────────────────
  context.subscriptions.push(
    vscode.window.onDidStartTerminalShellExecution(async e => {
      await hive.emit('background.process', { kind: 'terminal',
        command: e.execution.commandLine.value, cwd: e.terminal.shellIntegration?.cwd?.fsPath });
    }),
    vscode.tasks.onDidStartTask(async e => {
      await hive.emit('background.process', { kind: 'task',
        name: e.execution.task.name, source: e.execution.task.source });
    }),
    vscode.debug.onDidStartDebugSession(async s => {
      await hive.emit('background.process', { kind: 'debug', type: s.type, name: s.name });
    }),
  );

  // ── 5. Passive ingest trigger + lifecycle ────────────────────────────
  await hive.tailCopilotStores(context);   // kicks daemon-side tail; see §4
  vscode.workspace.onDidChangeWorkspaceFolders(() => hive.refreshWorkspaces());
  context.subscriptions.push({ dispose: () => hive.emit('session.end', { reason: 'window.close' }) });
}
```

## 4. Passive capture — Copilot chat history (verified paths)

The daemon-side Copilot ingestor reads (Linux paths; Windows substitutes
`%APPDATA%/<variant>/User` for `~/.config/<variant>/User`):

| Source | Path | Contents |
| --- | --- | --- |
| Workspace chat journals | `<User>/workspaceStorage/<hash>/chatSessions/*.jsonl` | delta journals: `kind:0` root (sessionId, creationDate), `kind:1` property patches (customTitle), `kind:2` request appends — `message.text`, `modelId`/`result.metadata.resolvedModel`, `metadata.toolCallRounds`, token counts |
| Empty-window journals | `<User>/globalStorage/emptyWindowChatSessions/*.jsonl` | same format, no workspace |
| Copilot transcripts | `<User>/workspaceStorage/<hash>/GitHub.copilot-chat/transcripts/*.jsonl` | `session.start` (`data.producer=="copilot-agent"`, `data.context.cwd`), user+assistant text, `data.reasoningText` (excluded — see note) |
| OTel span store | `<User>/globalStorage/github.copilot-chat/agent-traces.db` | per-turn spans with real token/cache counts, `github.copilot.chat.turn.id`; used as authoritative token source when present |
| Session index | `<User>/workspaceStorage/<hash>/state.vscdb` (SQLite) | `chat.ChatSessionStore.index` → session titles |

Mapping: journal request → `user.prompt` + `assistant.message` events;
`toolCallRounds` → `tool.call`/`tool.result`; span rows → `trace.span` +
`meta.tokens`; `reasoningText` in transcripts is **skipped by design**
(estimate-quality field, excluded from capture per hive COT policy).

Workspace hash → workspaceId: resolve via `workspaceStorage/<hash>/workspace.json`
(folder URI) → git-root hash (workspace-manifest).

## 5. Copilot instructions injection

The extension generates/refreshes `.github/copilot-instructions.md` from hive
state (conventions, decisions, session handoffs) — one of the few ways to get
hive context into Copilot's *default* chat (outside `@hive`). Generated from
hive decisions/conventions; contains a marker block (`<!-- uch-hive-managed -->`)
so the extension owns only its section. Also appends a one-line pointer to the
`@hive` participant in the user's `copilot-instructions` if absent.

## 6. Settings (`contributes.configuration`)

```jsonc
"configuration": {
  "title": "UCH Hive",
  "properties": {
    "uch.hive.url":            { "type": "string",  "default": "http://127.0.0.1:3999", "description": "Hive daemon base URL" },
    "uch.hive.tokenFile":      { "type": "string",  "default": "~/.uch/hive/token" },
    "uch.hive.capture":        { "type": "boolean", "default": true, "description": "Log @hive participant turns to the ledger" },
    "uch.hive.passiveIngest":  { "type": "boolean", "default": true, "description": "Tail Copilot chat journals into the ledger" },
    "uch.hive.injectInstructions": { "type": "boolean", "default": true, "description": "Manage .github/copilot-instructions.md hive section" },
    "uch.hive.captureTerminals":   { "type": "boolean", "default": true }
  }
}
```

## 7. Auto-install in the workspace

- `.vscode/extensions.json` → `"recommendations": ["uch.uch-hive"]` in every
  UCH-managed workspace (workspace-operations task).
- Distribution: VSIX from Marketplace; `vscode:mcp/install?{json}` URL for the
  daemon MCP in docs.

## 8. Testing

- Unit: journal parser (kind 0/1/2), transcript parser, span-db reader against
  checked-in scrubbed fixtures.
- Extension host: `@vscode/test-electron` with a stubbed `vscode.lm`; assert
  participant registration, tool registration, event emission against a mock
  hive HTTP server.
- E2E: real VS Code + Copilot (manual, gated) — `@hive` turn appears in ledger;
  agent mode invokes `uch_recall`.
