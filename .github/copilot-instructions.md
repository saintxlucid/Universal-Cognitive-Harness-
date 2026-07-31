# Shared Workspace Agent Contract

Read [AGENTS.md](../AGENTS.md), [SKILLS.md](../SKILLS.md), and
[WORKSPACE-MEMORY.md](../.agent/memory/WORKSPACE-MEMORY.md) before working.

- Use `.agents/skills/` for reusable workflows; VS Code discovers this standard
  skill location directly.
- Run `powershell -ExecutionPolicy Bypass -File .\scripts\agent-bootstrap.ps1`
  before substantial work. Use `scripts/find-agent-skill.ps1` to retrieve a
  focused imported skill rather than bulk-loading third-party instructions.
- For significant work, create and close a portable session record with
  `powershell -ExecutionPolicy Bypass -File .\scripts\agent-session.ps1`.
- Treat `projects/` as isolated product boundaries. Do not mix product code
  into shared workspace areas.
- Use MCP tools only for their intended scope. Verify external information and
  request approval before an external write, a credential change, or a package
  installation.
- Never record secrets, tokens, personal data, or unverified facts in shared
  memory or logs.
