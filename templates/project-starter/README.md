# Monorepo Project Template

## Architecture

```
apps/
  web/       React + Vite frontend (port 5173)
  api/       Hono API backend (port 3001)
  docs/      Project documentation
packages/
  shared/    Shared types, utilities, constants
  db/        Prisma database schema and client
  config/    Shared ESLint config presets
```

## Quick Start

```bash
# Install dependencies
npm install

# Start database
docker compose up -d postgres

# Run database migrations
npm run db:migrate

# Start all dev servers
npm run dev
```

## Development

| Command           | Description                  |
|-------------------|------------------------------|
| `npm run dev`     | Start all apps in dev mode   |
| `npm run build`   | Build all packages and apps  |
| `npm run lint`    | Lint all projects            |
| `npm run test`    | Run all tests                |
| `npm run format`  | Format code                  |
| `npm run db:studio` | Open Prisma Studio         |
| `npm run clean`   | Remove all build artifacts   |

## Stack

- **Runtime**: Node.js 18+
- **Monorepo**: Turbo + npm workspaces
- **Frontend**: React 19 + Vite 6 + React Router 7
- **Backend**: Hono 4 + TypeScript
- **Database**: PostgreSQL + Prisma 6
- **Language**: TypeScript 5 (strict mode)
- **Linting**: ESLint 9
- **Formatting**: Prettier 3

## Project Structure

```
src/
├── components/   Shared UI components
├── pages/        Route-level page components
├── hooks/        Custom React hooks
├── lib/          Utility functions and API clients
└── types/        TypeScript type definitions

apps/api/src/
├── routes/       API route handlers
├── middleware/   Hono middleware
├── services/     Business logic
├── db/           Database access layer
└── types/        API-specific types
```

## Documentation

See `docs/` for architecture decisions, development guides, and deployment instructions.
