# Workspace Index

## Overview

This workspace is a multi-project development hub centered on shared tooling, agent infrastructure, and isolated product folders. The root tree is designed to support orchestration, templates, documentation, and several independent product initiatives.

## Top-Level Structure

- [README.md](../README.md) — workspace purpose and operating model.
- [package.json](../package.json) — root workspace package, scripts, and shared toolchain.
- [apps/](../apps) — example application workspace packages.
- [packages/](../packages) — shared libraries and UI packages.
- [projects/](../projects) — independent product or client projects.
- [templates/](../templates) — reusable starter template for new projects.
- [docs/](./) — architecture and engineering guidance.
- [shared/](../shared) — workspace-wide conventions and reusable guidance.
- [scripts/](../scripts) — workspace bootstrap and maintenance utilities.
- [tests/](../tests) — workspace-level validation tests.

## Project Inventory

### 1. AI Studio

- Location: [projects/AI Studio](../projects/AI%20Studio)
- Purpose: example AI-driven product studio demonstrating an AI-guided product lifecycle.
- Notes: includes a product vision, MVP scaffolding ideas, and delivery guidance.

### 2. D A I R A

- Location: [projects/D A I R A](../projects/D%20A%20I%20R%20A)
- Purpose: a larger product initiative with backend, web, Prisma, SQL, docs, and governance assets.
- Notes: appears to be a more mature product workspace with its own package structure and operational docs.

### 3. HR OS

- Location: [projects/HR OS](../projects/HR%20OS)
- Purpose: HRM software application project scaffold.
- Notes: currently minimal, with a README and repository metadata.

### 4. Lumen Care AI

- Location: [projects/Lumen Care AI](../projects/Lumen%20Care%20AI)
- Purpose: appears to be a project placeholder or isolated repo.
- Notes: currently contains only Git metadata.

### 5. UCH

- Location: [projects/uch](../projects/uch)
- Purpose: Universal Cognitive Harness, a cognitive infrastructure runtime for agents and AI systems.
- Notes: includes its own package manifest, docs, research assets, and source tree.

## Application and Package Surface

### Apps

- [apps/web](../apps/web) — Vite + React demo app.
  - Package: [apps/web/package.json](../apps/web/package.json)

### Packages

- [packages/ui](../packages/ui) — shared UI package.
  - Package: [packages/ui/package.json](../packages/ui/package.json)

### Project Runtime

- [projects/uch](../projects/uch) — standalone cognitive runtime package.
  - Package: [projects/uch/package.json](../projects/uch/package.json)

## Core Toolchain

- Node.js + npm workspaces
- Turbo monorepo orchestration
- TypeScript for app and package code
- ESLint, Prettier, Husky, and lint-staged workflows
- Docker and devcontainer support
- Workspace test and doctor scripts

## Key Entry Points

- [README.md](../README.md) — high-level architecture and workflow guidance
- [package.json](../package.json) — root scripts and workspace pipeline
- [AGENTS.md](../AGENTS.md) — workspace instructions for agent-driven development
- [CLAUDE.md](../CLAUDE.md) — Claude-specific workspace conventions
- [docs/architecture.md](./architecture.md) — architecture reference
- [projects/uch/README.md](../projects/uch/README.md) — cognitive runtime overview

## Scan Summary

The workspace is primarily organized around:

1. Shared engineering standards and agent orchestration
2. A reusable starter template for new projects
3. Multiple product initiatives under isolated folders
4. A custom cognitive runtime project for advanced AI infrastructure

This makes the workspace suitable for both product delivery and experimentation with agent-based tooling.
