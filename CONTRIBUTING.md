# Contributing to the Software Development Workspace

## Getting Started

1. Ensure you're using Node.js 20+ (see `.nvmrc`)
2. Run `npm install` at the workspace root
3. Create an `.env` file from `.env.example` if working with a product project

## Development Workflow

```bash
npm run dev        # Start turbo dev server
npm run build      # Build all packages
npm run lint       # Run ESLint across all packages
npm run typecheck  # TypeScript type checking
npm run format     # Format code with Prettier
npm test           # Run workspace-level tests
```

## Project Conventions

- Product code lives under `projects/<name>/`
- Shared libraries under `packages/<name>/`
- Keep secrets out of source control; use `.env.example` for variable names
- Document architectural decisions in `.agent/memory/`

## Code Style

- TypeScript strict mode
- ESLint + Prettier configured at the workspace root
- Convention over configuration—follow existing patterns

## Using Agent Workflows

- Use `gsd:quick` for trivial changes
- Use `gsd:plan-phase` + `gsd:execute-phase` for architectural work
- See `AGENTS.md` and `SKILLS.md` for available agent tooling

## Pull Request Process

1. Ensure CI passes (build, lint, typecheck, test)
2. Update relevant documentation
3. Request review from a maintainer
