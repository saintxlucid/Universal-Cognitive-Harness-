# Justfile - cross-platform command runner
# Alternative to Makefile for non-Windows or Just users
# Install: https://github.com/casey/just

alias h := help

# Show this help
help:
    @just --list

# Full workspace setup (install + build + hooks)
setup:
    npm install
    npm run build --if-present

# Install all dependencies
install:
    npm install

# Start full dev environment
dev:
    docker compose up -d
    npm run dev --if-present

# Build all packages
build:
    npm run build --if-present

# Run workspace config tests
test:
    node --test tests/workspace-config.test.mjs

# Run all tests across workspace
test-all:
    npm run test:all --if-present

# Run linters
lint:
    npm run lint

# Format code
format:
    npm run format

# Check formatting
format-check:
    npm run format -- --check

# TypeScript checks
typecheck:
    npm run typecheck || true

# Full workspace health check
doctor:
    npm run doctor

# Start Docker services
docker-up:
    docker compose up -d

# Stop Docker services
docker-down:
    docker compose down

# View Docker logs
docker-logs:
    docker compose logs -f

# Agent workspace verify
agent-verify:
    powershell -ExecutionPolicy Bypass -File scripts/workspace-doctor.ps1
