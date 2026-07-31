# Development Guide

## Prerequisites

- Node.js 18+
- npm 11+
- Docker Desktop (for database services)
- VS Code (recommended)

## First Time Setup

```bash
git clone <repo-url>
cd <project>
npx turbo telemetry disable
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in values. Never commit `.env`.

## Code Quality

- Run `npm run lint` before committing
- Run `npm run typecheck` to verify types
- Run `npm run test` to verify tests pass
- Run `npm run format` to auto-format code

## Database Changes

1. Edit `packages/db/prisma/schema.prisma`
2. Run `npm run db:migrate` to create a migration
3. Run `npm run db:generate` to regenerate the client
