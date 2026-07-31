FROM node:20-alpine AS base
RUN corepack enable && corepack prepare npm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/agent-harness/package.json ./packages/agent-harness/
COPY packages/ui/package.json ./packages/ui/
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app .
EXPOSE 3000
CMD ["node", "dist/index.js"]
