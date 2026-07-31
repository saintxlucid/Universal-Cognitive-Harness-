# Agent Platform Baseline

## Runtime surfaces

- `AGENTS.md` is the durable workspace contract for Codex.
- `CLAUDE.md` mirrors the core workspace contract for Claude Code.
- `.agent/` contains shared, runtime-neutral instructions, templates, and memory.
- `.agents/skills/` contains Codex-discoverable, repository-scoped skills.
- `.codex/config.toml` contains trusted project-scoped Codex settings and MCP registration.
- `.agent/memory/WORKSPACE-MEMORY.md` is the cross-runtime source of durable workspace context.
- `.agent/memory/SESSION-LOG.md` is the append-only cross-agent continuation log.

## Automation model

Use agents to plan, implement, validate, and document work, but retain a human
approval boundary for secrets, production deployments, destructive commands,
financial actions, and any tool that writes to external systems. Prefer staged
delivery: brief, plan, implement, verify, then release.

## MCP policy

| Server | Purpose | Default | Credential policy |
| --- | --- | --- | --- |
| OpenAI Developer Docs | Official OpenAI and Codex documentation | Enabled | ChatGPT session authentication |
| Context7 | Current library documentation | Enabled | No workspace secret stored |
| Sequential Thinking | Structured problem decomposition | Enabled | Thought logging disabled |
| Exa | Current web search and page retrieval | Enabled | Hosted read-only endpoint; no workspace secret stored |
| Playwright | Browser-based UI verification | Disabled | Enable per task; prompt for actions |
| GitHub, Figma, cloud, database, ticketing | Project data and external actions | Not configured | Add only with least-privilege credentials and explicit approval |

After changing `.codex/config.toml`, trust the project and restart the Codex
client, then use the in-session `/mcp` view to confirm the active servers.
The first Context7 use may download its launcher package through `npx`; this
is intentional and should be approved according to the workspace dependency
policy.

## Cross-agent memory protocol

Every agent begins by reading `WORKSPACE-MEMORY.md` and the latest relevant
entries in `SESSION-LOG.md`. For a substantive task, record a start entry and a
completion or blocker with `scripts/agent-session.ps1`. Add only durable,
workspace-relevant decisions to `WORKSPACE-MEMORY.md`; do not store secrets,
customer data, tokens, or unverified claims.

## Project states at setup

- **DAIRA**: React/Vite application with local scripts for development, build,
  lint, and type checking.
- **AI Studio**: documented AI-product-studio example; no implementation yet.
- **HR OS** and **Lumen Care AI**: empty product slots; scaffold them from the
  starter template only after their product goals and stack decisions exist.
