SHELL := /bin/bash
.NOTPARALLEL:

# ──────────────────────────────────────────────────
# Workspace-wide commands
# ──────────────────────────────────────────────────

.PHONY: help setup install dev build test lint format clean doctor

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Full workspace setup (install + build + hooks)
	@npm install
	@npm run build --if-present
	@npx husky init 2>/dev/null || true

install: ## Install all dependencies
	@npm install

dev: ## Start full dev environment (Docker + workspace)
	@docker compose up -d
	@npm run dev --if-present

build: ## Build all packages
	@npm run build --if-present

test: ## Run workspace tests
	@node --test tests/workspace-config.test.mjs

test-all: ## Run all tests across workspace
	@npm run test:all --if-present

lint: ## Run linters
	@npm run lint

format: ## Format code
	@npm run format

format-check: ## Check formatting
	@npm run format -- --check

typecheck: ## Run TypeScript checks
	@npm run typecheck || true

doctor: ## Full workspace health check
	@npm run doctor

clean: ## Clean build artifacts
	@git clean -fX -e '!node_modules' -e '!.env' || true

docker-up: ## Start Docker services
	@docker compose up -d

docker-down: ## Stop Docker services
	@docker compose down

docker-logs: ## View Docker service logs
	@docker compose logs -f

reset-db: ## Reset database
	@docker compose rm -sf postgres
	@docker volume rm -f software-development_postgres_data || true
	@docker compose up -d postgres

# ──────────────────────────────────────────────────
# Utility
# ──────────────────────────────────────────────────

.PHONY: agent-verify agent-session

agent-verify: ## Verify workspace agent readiness
	@powershell -ExecutionPolicy Bypass -File scripts/workspace-doctor.ps1

agent-session: ## Record agent session
	@powershell -ExecutionPolicy Bypass -File scripts/agent-session.ps1 -Action $(or $(action),start) -Notes "$(or $(notes),)"
