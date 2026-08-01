# IDEA-0099 — Universal Capability Scanner + Capability Graph

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 compatibility-layer intake (round 14) — the
  Universal Integration Architecture (UIA) claim: every application has
  multiple surfaces — Public APIs, SDK, CLI, MCP, Extension API, Plugin
  API, Workspace, Project Files, Configuration, Session Metadata,
  Telemetry (if exposed), Logs (if accessible), Git, Filesystem,
  Environment, IPC, Webhooks, Events, Authentication, Permissions,
  Local Database, OS Services. Instead of hard-coding integrations,
  "scan application → identify APIs/SDK/CLI/MCP/extensions/events/
  storage/config → generate capability graph. Now UCH knows _how_ to
  integrate, not by reverse engineering, but by understanding the
  exposed contract." Every node of the graph is traversable, so UCH
  reasons about _available capabilities_ rather than application names.
- **Related:** src/workspace-manifest/discovery.ts + loader + manifest
  (UCH-side discovery), src/drivers/registry.ts + driver manifests
  (`level_claims` per design/INTEGRATION-LEVELS.md), src/cognitive-
  plane/protocol/capability-negotiation.ts + src/workspace-manifest/
  negotiation.ts (handshake: version/capability/permission exchange),
  src/cognitive-runtime/capability-registry.ts + grants.ts +
  src/control-plane/projections.ts (authority intersection),
  src/workspace-manifest/attach.ts (runtime negotiation at attach),
  src/drivers/mcp/acp/ide drivers (surface implementations),
  connectome (capability-adjacent graph machinery), IDEA-0096 (UCCL —
  the scanner feeds the adapter contract), IDEA-0097 (CIP — discovered
  surfaces are the voluntary publish endpoints)

## Motivation

UCH discovers **its own** world: the workspace manifest, installed
drivers, their declared level claims, and the capability registry —
then negotiates at attach. The intake's claim inverts the direction:
discover **the target application's** world — enumerate what an
external tool actually exposes (its MCP endpoints, CLI entry points,
SDK, extension manifests, config files, event streams, storage, auth
model) and classify each into the UIA surface taxonomy. The result is
a traversable capability graph (VS Code → extension API → language
server → git → tasks → terminal → debug → MCP → Copilot) that UCH
walks to _choose_ how to integrate: which rails are live, which
transports exist, what level claim is honest per rail. This is the
mechanism that makes "no bespoke integrations" operational: a new tool
is not special-cased, it is scanned.

## The corpus cannot cover it because

- discovery.ts/loader.ts resolve the UCH manifest; nothing enumerates
  an external application's surfaces from its on-disk artifacts (config
  schemas, extension manifests, CLI help, MCP server lists, journal
  layouts) and classifies them into a taxonomy. The UIA surface list is
  not a named classification anywhere in the corpus.
- Capability negotiation assumes both sides already speak the protocol
  (CIC/ACP/MCP); the _probing_ step — find the endpoint, learn the
  dialect, read the version — is manual per-runtime knowledge captured
  in design/integrations/*.md, not an automated scanner feeding the
  negotiation.
- The capability registry holds UCH's capabilities; the graph of
  _external_ capabilities (app → surface → sub-surface) has no home
  (the connectome is concept-space; UER is causal trace space).

## Proposal sketch

- **UIA surface taxonomy (v1)**: the intake's 21 surfaces, each with a
  probe definition — how to detect it on a host (config file pattern,
  binary/CLI help, port/endpoint, SDK manifest, journal layout) and a
  classification (Green/Yellow per IDEA-0097).
- **Scanner**: a probe driver per surface family (filesystem probes for
  config/journals, process probes for CLI/ports, manifest probes for
  extensions/plugins/MCP server lists) that emits a capability graph —
  nodes = application + surfaces, edges = traversal (extension → LSP →
  git…). Output feeds attach-time negotiation: the handshake asks for
  the _scanned_ surface, never a guessed one.
- **Graph home**: the per-application capability graph persists in the
  workspace knowledge-graph family (workspace-graphs), versioned per
  application version; UCH reasons over it (planning, adapter choice
  per UCCL IDEA-0096, honest level claims per INTEGRATION-LEVELS).
- **Trust boundary**: scanning reads _public surface artifacts_
  (configs, manifests, help) — Green-zone only; it never probes private
  internals (Red zone per IDEA-0097).

## Risk assessment

- False positives: a surface probe must declare its evidence and allow
  override — a scanned claim is a proposal, ratified by handshake, never
  silently assumed (mirrors "never assume a level").
- Version drift: application updates change surfaces; the graph pins
  application versions and re-scans on change (continuous understanding
  pattern already in the corpus).
- Scope: the scanner is classification machinery, not an integration —
  it must stay thin; adapters remain separate waves.

## Where it lands

- `src/drivers/scanner/` (probe family + graph builder), UIA taxonomy
  in `spec/`, negotiation extension (attach consumes scanned surface).

## Code impact

- None until designed; seeds are discovery.ts, drivers/registry,
  negotiation.ts, workspace-graphs.

## Next stage

- Prototype: scan one real host (OpenCode: config file, storage layout,
  and MCP list) end-to-end into a capability graph; assert the graph
  matches the hand-written integration doc for OpenCode.
