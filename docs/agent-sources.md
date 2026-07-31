# Imported Agent Sources

The repositories listed below are shallow-cloned into `.agent/vendor/` as a
local, ignored capability cache. They are not automatically executed or loaded
into agent context. Discover their skills with `scripts/find-agent-skill.ps1`.

| Source | Role |
| --- | --- |
| obra/superpowers | Agentic development workflow reference; installed plugin remains separate |
| fastapi/fastapi | Python API framework source and reference |
| juliangarnier/anime | Animation library source and examples |
| brillout/awesome-react-components | React component discovery reference |
| anthropics/skills, google/skills, openai/skills, microsoft/skills, NVIDIA/skills | Provider skill libraries |
| vercel-labs/skills, vercel-labs/agent-skills | Web and agent development skill libraries |
| multica-ai/andrej-karpathy-skills, ComposioHQ/awesome-claude-skills | Community skill collections; inspect carefully before use |

## SDK harness

`packages/agent-harness` declares the Node SDKs for OpenAI, Google Gen AI, and
the Claude Agent SDK. Credentials are environment variables only. Run
`npm run status --workspace @workspace/agent-harness` to view configuration
state without making an API request, and `npm run verify-imports --workspace
@workspace/agent-harness` after dependencies are installed.
