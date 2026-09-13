FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl postgresql-client sqlite3 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/miniapp/package.json apps/miniapp/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=postgresql://novell_reader:novell_reader@postgres:5432/novell_reader?schema=public
ENV MINI_APP_DIST_DIR=/app/apps/miniapp/dist

EXPOSE 3000

CMD ["pnpm", "start:prod"]
