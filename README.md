# Software Development Workspace

This workspace is organized as a hub for multiple independent products and client projects.

## Core principle

- Keep the root workspace focused on shared standards, templates, and orchestration.
- Give every real product its own isolated folder under projects/.
- Keep the agent operating surface under .agent/ so AI systems can learn, reason, and act with context.
- Keep generated artifacts and repo metadata out of the shared workspace tree.

## Structure

- projects/ — each product or client project lives here in its own folder
- templates/ — reusable starter template for new projects
- .agent/ — agent instructions, skills, memory, harness, and templates
- shared/ — workspace-wide conventions and reusable guidance
- docs/ — architecture and development standards
- apps/ and packages/ — example starter assets and reference implementation

## Recommended workflow

1. Create or connect a project under projects/.
2. Keep product code isolated from shared workspace scaffolding.
3. Run the workspace quality checks before merging or shipping changes.
4. Use the shared agent harness and instructions to keep AI-assisted work consistent.

## Best practices included

- Clear separation between shared standards, real projects, and agent context
- Repeatable startup flow for future products
- Easier onboarding and lower coupling between projects
- Built-in quality gates and workspace diagnostics

## Developer environment upgrades

This workspace now includes:

- A dev container for consistent local and CI-like setup
- Pre-commit hooks for formatting, linting, and workspace checks
- VS Code tasks for the most common developer commands
- A reproducible onboarding path via the shared agent and workspace harness
