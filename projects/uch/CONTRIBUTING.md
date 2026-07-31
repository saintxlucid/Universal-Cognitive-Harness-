# Contributing to UCH

Thanks for contributing to the Universal Cognitive Harness. This
project lives inside the workspace monorepo (`projects/uch/`); the
same rules apply to all workspace projects.

## Getting Started

```bash
cd projects/uch
npm install
npm run build
npm test          # vitest — full suite
npm run typecheck # tsc --noEmit
npm run lint      # eslint
```

## Development Workflow

0. **Read the canon first.** UCH is specification-first: the Five-Book
   Canon ([docs/README.md](docs/README.md)) is the source of truth — the
   conversation is not. `spec/` (laws, constitution, CP) is immutable
   law; `rfc/` is the contract series; `design/` holds ADRs and the DOE
   operating procedures.

1. **Check the docs first** — `docs/` has the full reference suite;
   `SPEC.md` and `spec/` define the cognitive model; `design/` holds
   the ADRs and conformance criteria. A change that violates the
   Constitution or the memory filing rules (`docs/memory-filing-rules.md`)
   will be rejected.

2. **Normative changes go through the RFC lifecycle** — a new law,
   contract, instruction, schema, or boundary requires an RFC
   ([RFC-0000](rfc/RFC-0000-specification-governance.md)) and passes the
   **Five Gates** (Scientific, Architectural, Engineering, Biological,
   Economic) before it may touch the corpus
   ([design/DIRECTIONS.md](design/DIRECTIONS.md) SOP-08/09). Non-normative
   changes (clarification, bug fixes) follow the GSD workflow directly.

3. **Prefer GSD workflow** for non-trivial changes (workspace rule).
   Trivial fixes (typos, formatting, narrow bug fixes) can go straight
   in.

3. **Keep edits surgical** — follow the coding principles
   (`uch principles-check`):
   - Think before coding: state assumptions, surface ambiguity.
   - Simplicity first: minimum code that solves the problem.
   - Surgical changes: touch only what the request requires.
   - Goal-driven execution: define success criteria and verify.

4. **Tests are mandatory** — every new module ships with vitest tests.
   New behavior without tests will be rejected. Run the full suite
   before finishing: `npm test` must pass in full.

5. **Provenance matters** — UCH adapts patterns from external reference
   collections. If you port a pattern, record it in
   `docs/extraction-map.md` and keep imported skill provenance in
   `.import-index.json` (use `uch skill import`, don't hand-copy).

## Commit Conventions

Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
Pre-commit hooks (eslint + prettier via lint-staged) run automatically.

## House Rules

- Never commit secrets. `.env` is ignored; use `.env.example` for
  variable names only.
- Never commit runtime state (`.uccp/`, sessions, takes files).
- Keep the workspace clean: no debug artifacts (`fixture-debug.json`
  style files don't belong in the repo).
- Keep documentation in sync with behavior — a CLI command, MCP tool,
  or env var must be documented in `docs/` in the same change.
- Do not place personal data, access tokens, or model chain-of-thought
  in shared memory or session logs.
