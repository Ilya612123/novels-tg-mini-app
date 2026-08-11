# Novell Reader MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать MVP Telegram-бота и Telegram Mini App для чтения новелл из EPUB с прогрессом, paywall после первой трети глав, оплатой доступа на 30 дней через Telegram Stars и логами в Telegram-канал.

**Architecture:** Проект делается как TypeScript-монорепозиторий: общий пакет типов и бизнес-правил, backend/bot-сервис, frontend Mini App и CLI-импорт EPUB. Backend хранит пользователей, книги, главы, прогресс, доступ, платежи и события аналитики. Mini App работает только с нормализованными API-данными, EPUB не парсится на клиенте.

**Tech Stack:** Node.js + TypeScript, pnpm workspaces, React + Vite, grammY, Prisma, SQLite для local dev с PostgreSQL-ready схемой, Vitest, Playwright smoke-тесты для Mini App.

## Global Constraints

- Все новые пользовательские тексты, документация и комментарии пишутся на русском.
- Поддержка ведет на `https://t.me/esimsmile_support`.
- Новеллы в MVP загружаются как EPUB-файлы в `content/epub/`; админки нет.
- Бесплатная часть книги считается по главам: `ceil(totalChapters / 3)`, если у книги не задан ручной `freeChapterLimit`.
- Доступ покупается через Telegram Stars на 30 дней; автопродления нет.
- Активный доступ открывает платные главы всех книг.
- Событие `/start` логируется как `старт бота`.
- Аналитика отправляется в Telegram-канал батчами раз в минуту.
- Mini App должен быть визуально спокойной "уютной библиотекой" для женщин 30+.
- Переменные окружения: `BOT_TOKEN`, `MINI_APP_URL`, `SUPPORT_URL`, `ANALYTICS_CHANNEL_ID`, `STARS_ACCESS_PRICE`, `DATABASE_URL`, `PUBLIC_BASE_URL`.

---

## Структура Файлов

Создать:

- `package.json` — корневые scripts и workspaces.
- `pnpm-workspace.yaml` — список workspace-пакетов.
- `tsconfig.base.json` — общие настройки TypeScript.
- `.env.example` — обязательные переменные окружения.
- `content/epub/.gitkeep` — папка для исходных EPUB.
- `content/imported/.gitkeep` — папка для подготовленных глав и обложек.
- `packages/shared/package.json` — общий пакет.
- `packages/shared/src/types.ts` — общие типы API и сущностей.
- `packages/shared/src/access.ts` — расчет free-limit и доступа.
- `packages/shared/src/analytics.ts` — типы и форматирование аналитики.
- `packages/shared/src/index.ts` — публичные экспорты shared.
- `packages/shared/src/*.test.ts` — unit-тесты shared.
- `apps/server/package.json` — backend/bot пакет.
- `apps/server/prisma/schema.prisma` — схема БД.
- `apps/server/src/config.ts` — чтение env.
- `apps/server/src/db.ts` — Prisma client.
- `apps/server/src/repositories/*.ts` — доступ к данным.
- `apps/server/src/services/*.ts` — бизнес-логика: книги, прогресс, доступ, платежи, аналитика.
- `apps/server/src/bot.ts` — Telegram bot и handlers.
- `apps/server/src/api.ts` — HTTP API для Mini App.
- `apps/server/src/index.ts` — запуск сервера и бота.
- `apps/server/src/import/epub.ts` — EPUB parsing/import pipeline.
- `apps/server/src/import/cli.ts` — CLI-команда импорта.
- `apps/server/src/**/*.test.ts` — unit/integration тесты backend.
- `apps/miniapp/package.json` — Mini App пакет.
- `apps/miniapp/index.html` — Vite entry.
- `apps/miniapp/src/main.tsx` — React entry.
- `apps/miniapp/src/api/client.ts` — API-клиент.
- `apps/miniapp/src/telegram.ts` — Telegram WebApp wrapper.
- `apps/miniapp/src/App.tsx` — router/layout.
- `apps/miniapp/src/screens/*.tsx` — Catalog, Novel, Reader, Profile, Paywall.
- `apps/miniapp/src/components/*.tsx` — BookCard, BottomNav, LoadingState, ErrorState.
- `apps/miniapp/src/styles.css` — визуальная система.
- `apps/miniapp/src/**/*.test.tsx` — тесты UI-логики.

---

### Task 1: Базовый TypeScript-Монорепозиторий

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `content/epub/.gitkeep`
- Create: `content/imported/.gitkeep`

**Interfaces:**
- Produces: workspace scripts `typecheck`, `test`, `build`, `dev:server`, `dev:miniapp`, `import:epub`.
- Produces: documented env names used by all later tasks.

- [ ] **Step 1: Create root workspace files**

Create `package.json`:

```json
{
  "name": "novell-reader",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "dev:server": "pnpm --filter @novell-reader/server dev",
    "dev:miniapp": "pnpm --filter @novell-reader/miniapp dev",
    "import:epub": "pnpm --filter @novell-reader/server import:epub"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 2: Create env documentation**

Create `.env.example`:

```bash
BOT_TOKEN=
MINI_APP_URL=
SUPPORT_URL=https://t.me/esimsmile_support
ANALYTICS_CHANNEL_ID=
STARS_ACCESS_PRICE=
DATABASE_URL=file:./dev.db
PUBLIC_BASE_URL=
PORT=3000
```

- [ ] **Step 3: Create content folders**

Add empty keep files:

```text
content/epub/.gitkeep
content/imported/.gitkeep
```

- [ ] **Step 4: Verify workspace metadata**

Run: `pnpm install`

Expected: lockfile is created and install succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .env.example content/epub/.gitkeep content/imported/.gitkeep pnpm-lock.yaml
git commit -m "chore: scaffold workspace"
```

---

### Task 2: Shared Types, Access Rules, Analytics Formatting

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/access.ts`
- Create: `packages/shared/src/analytics.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/access.test.ts`
- Test: `packages/shared/src/analytics.test.ts`

**Interfaces:**
- Produces: `calculateFreeChapterLimit(totalChapters: number, manualLimit?: number | null): number`
- Produces: `canReadChapter(input: AccessCheckInput): boolean`
- Produces: `formatAnalyticsBatch(input: AnalyticsBatchInput): string | null`
- Produces: shared API types for server and Mini App.

- [ ] **Step 1: Create package metadata**

Create `packages/shared/package.json`:

```json
{
  "name": "@novell-reader/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Create `packages/shared/tsconfig.json` extending `../../tsconfig.base.json`, with `rootDir: "src"` and `outDir: "dist"`.

- [ ] **Step 2: Write failing access tests**

Create `packages/shared/src/access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateFreeChapterLimit, canReadChapter } from "./access.js";

describe("calculateFreeChapterLimit", () => {
  it("rounds the first third up", () => {
    expect(calculateFreeChapterLimit(51)).toBe(17);
    expect(calculateFreeChapterLimit(10)).toBe(4);
  });

  it("uses a manual limit when present", () => {
    expect(calculateFreeChapterLimit(51, 12)).toBe(12);
  });
});

describe("canReadChapter", () => {
  it("allows free chapters without access", () => {
    expect(canReadChapter({ chapterNumber: 17, totalChapters: 51, subscriptionUntil: null })).toBe(true);
  });

  it("blocks paid chapters without active access", () => {
    expect(canReadChapter({ chapterNumber: 18, totalChapters: 51, subscriptionUntil: null })).toBe(false);
  });

  it("allows paid chapters with active access", () => {
    expect(canReadChapter({
      chapterNumber: 18,
      totalChapters: 51,
      subscriptionUntil: new Date("2030-01-01T00:00:00.000Z"),
      now: new Date("2029-12-01T00:00:00.000Z")
    })).toBe(true);
  });
});
```

- [ ] **Step 3: Implement access rules**

Create `packages/shared/src/access.ts`:

```ts
export type AccessCheckInput = {
  chapterNumber: number;
  totalChapters: number;
  manualFreeChapterLimit?: number | null;
  subscriptionUntil: Date | string | null;
  now?: Date;
};

export function calculateFreeChapterLimit(totalChapters: number, manualLimit?: number | null): number {
  if (manualLimit != null && manualLimit > 0) return manualLimit;
  return Math.max(1, Math.ceil(totalChapters / 3));
}

export function canReadChapter(input: AccessCheckInput): boolean {
  const freeLimit = calculateFreeChapterLimit(input.totalChapters, input.manualFreeChapterLimit);
  if (input.chapterNumber <= freeLimit) return true;
  if (!input.subscriptionUntil) return false;

  const now = input.now ?? new Date();
  const until = input.subscriptionUntil instanceof Date ? input.subscriptionUntil : new Date(input.subscriptionUntil);
  return until.getTime() > now.getTime();
}
```

- [ ] **Step 4: Write failing analytics tests**

Create `packages/shared/src/analytics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatAnalyticsBatch } from "./analytics.js";

describe("formatAnalyticsBatch", () => {
  it("formats grouped user events", () => {
    const text = formatAnalyticsBatch({
      from: new Date("2026-08-11T09:21:00.000Z"),
      to: new Date("2026-08-11T09:22:00.000Z"),
      events: [
        { userId: "5100586818", username: "barboruss", occurredAt: new Date("2026-08-11T09:21:03.000Z"), label: "старт бота", source: "bot" },
        { userId: "5100586818", username: "barboruss", occurredAt: new Date("2026-08-11T09:21:11.000Z"), label: "открыл Mini App", source: "miniapp" },
        { userId: "5100586818", username: "barboruss", occurredAt: new Date("2026-08-11T09:21:24.000Z"), label: "начал читать Главу 1", source: "miniapp" }
      ]
    });

    expect(text).toContain("Логи за 12:21-12:22");
    expect(text).toContain("user 5100586818 @barboruss");
    expect(text).toContain("12:21:03 старт бота");
    expect(text).toContain("активность в mini app: 13 сек");
  });

  it("returns null without events", () => {
    expect(formatAnalyticsBatch({
      from: new Date("2026-08-11T09:21:00.000Z"),
      to: new Date("2026-08-11T09:22:00.000Z"),
      events: []
    })).toBeNull();
  });
});
```

- [ ] **Step 5: Implement analytics formatter**

Create `packages/shared/src/analytics.ts`:

```ts
export type AnalyticsEventSource = "bot" | "miniapp";

export type AnalyticsEventForFormat = {
  userId: string;
  username: string | null;
  occurredAt: Date;
  label: string;
  source: AnalyticsEventSource;
};

export type AnalyticsBatchInput = {
  from: Date;
  to: Date;
  events: AnalyticsEventForFormat[];
};

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function formatMinute(date: Date): string {
  return formatTime(date).slice(0, 5);
}

export function formatAnalyticsBatch(input: AnalyticsBatchInput): string | null {
  if (input.events.length === 0) return null;

  const grouped = new Map<string, AnalyticsEventForFormat[]>();
  for (const event of input.events) {
    const list = grouped.get(event.userId) ?? [];
    list.push(event);
    grouped.set(event.userId, list);
  }

  const lines = [`Логи за ${formatMinute(input.from)}-${formatMinute(input.to)}`, ""];

  for (const [userId, events] of grouped) {
    events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const username = events.find((event) => event.username)?.username;
    lines.push(`user ${userId}${username ? ` @${username}` : ""}`);
    for (const event of events) {
      lines.push(`  ${formatTime(event.occurredAt)} ${event.label}`);
    }

    const miniappEvents = events.filter((event) => event.source === "miniapp");
    if (miniappEvents.length >= 2) {
      const first = miniappEvents[0]!.occurredAt.getTime();
      const last = miniappEvents[miniappEvents.length - 1]!.occurredAt.getTime();
      lines.push(`  активность в mini app: ${Math.max(0, Math.round((last - first) / 1000))} сек`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
```

- [ ] **Step 6: Add shared types and exports**

Create `packages/shared/src/types.ts` with API-facing types:

```ts
export type BookSummary = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  coverUrl: string | null;
  chapterCount: number;
  freeChapterLimit: number;
  progress: ReadingProgressSummary | null;
};

export type ChapterDto = {
  id: string;
  bookId: string;
  number: number;
  title: string;
  html: string;
  canRead: boolean;
};

export type ReadingProgressSummary = {
  bookId: string;
  chapterNumber: number;
  percent: number | null;
  updatedAt: string;
};

export type AccessStatusDto = {
  active: boolean;
  subscriptionUntil: string | null;
};
```

Create `packages/shared/src/index.ts`:

```ts
export * from "./access.js";
export * from "./analytics.js";
export * from "./types.js";
```

- [ ] **Step 7: Verify**

Run: `pnpm --filter @novell-reader/shared test`

Expected: all shared tests pass.

Run: `pnpm --filter @novell-reader/shared typecheck`

Expected: TypeScript passes.

- [ ] **Step 8: Commit**

```bash
git add packages/shared
git commit -m "feat: add shared domain rules"
```

---

### Task 3: Backend Database Schema And Repositories

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/prisma/schema.prisma`
- Create: `apps/server/src/config.ts`
- Create: `apps/server/src/db.ts`
- Create: `apps/server/src/repositories/users.ts`
- Create: `apps/server/src/repositories/books.ts`
- Create: `apps/server/src/repositories/progress.ts`
- Create: `apps/server/src/repositories/access.ts`
- Create: `apps/server/src/repositories/analytics.ts`
- Test: `apps/server/src/repositories/*.test.ts`

**Interfaces:**
- Consumes: shared access and analytics types from `@novell-reader/shared`.
- Produces: Prisma models `TelegramUser`, `Book`, `Chapter`, `ReadingProgress`, `UserAccess`, `Payment`, `AnalyticsEvent`.
- Produces repository functions used by bot/API/services.

- [ ] **Step 1: Create server package**

Create `apps/server/package.json`:

```json
{
  "name": "@novell-reader/server",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "dev": "tsx src/index.ts",
    "import:epub": "tsx src/import/cli.ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@grammyjs/web-app": "^1.4.0",
    "@novell-reader/shared": "workspace:*",
    "@prisma/client": "^5.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.19.0",
    "grammy": "^1.30.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "prisma": "^5.18.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Create `apps/server/tsconfig.json` extending `../../tsconfig.base.json`, with `rootDir: "src"` and `outDir: "dist"`.

- [ ] **Step 2: Define Prisma schema**

Create `apps/server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model TelegramUser {
  id             String            @id
  username       String?
  firstName      String?
  lastName       String?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  progress       ReadingProgress[]
  access         UserAccess?
  payments       Payment[]
  analyticsEvents AnalyticsEvent[]
}

model Book {
  id               String            @id
  title            String
  author           String?
  description      String?
  coverPath        String?
  chapterCount     Int
  freeChapterLimit Int
  sourceEpubFile   String
  status           String            @default("published")
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  chapters         Chapter[]
  progress         ReadingProgress[]
}

model Chapter {
  id          String   @id
  bookId      String
  number      Int
  title       String
  contentPath String
  wordCount   Int?
  book        Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@unique([bookId, number])
}

model ReadingProgress {
  id            String       @id @default(cuid())
  userId        String
  bookId        String
  chapterNumber Int
  position      Int
  percent       Float?
  startedAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  user          TelegramUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  book          Book         @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@unique([userId, bookId])
}

model UserAccess {
  userId            String       @id
  subscriptionUntil DateTime
  updatedAt         DateTime     @updatedAt
  user              TelegramUser @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Payment {
  id             String       @id @default(cuid())
  userId         String
  providerPayload String      @unique
  starsAmount    Int
  status         String
  rawPayload     String?
  createdAt      DateTime     @default(now())
  paidAt         DateTime?
  user           TelegramUser @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AnalyticsEvent {
  id         String       @id @default(cuid())
  userId     String
  username   String?
  source     String
  label      String
  metadata   String?
  occurredAt DateTime
  flushedAt  DateTime?
  user       TelegramUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([flushedAt, occurredAt])
}
```

- [ ] **Step 3: Implement config loader**

Create `apps/server/src/config.ts`:

```ts
import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  MINI_APP_URL: z.string().url(),
  SUPPORT_URL: z.string().url().default("https://t.me/esimsmile_support"),
  ANALYTICS_CHANNEL_ID: z.string().min(1),
  STARS_ACCESS_PRICE: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1),
  PUBLIC_BASE_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(3000)
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env = process.env): AppConfig {
  return EnvSchema.parse(env);
}
```

- [ ] **Step 4: Implement Prisma client**

Create `apps/server/src/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export type DbClient = PrismaClient;
```

- [ ] **Step 5: Write repository tests for progress upsert**

Create `apps/server/src/repositories/progress.test.ts` using Vitest and a test database. The test should:

```ts
import { describe, expect, it } from "vitest";
import { upsertReadingProgress } from "./progress.js";

describe("upsertReadingProgress", () => {
  it("creates and updates progress by user and book", async () => {
    const first = await upsertReadingProgress(db, {
      userId: "5100586818",
      bookId: "book-1",
      chapterNumber: 1,
      position: 120,
      percent: 12
    });

    const second = await upsertReadingProgress(db, {
      userId: "5100586818",
      bookId: "book-1",
      chapterNumber: 2,
      position: 0,
      percent: 20
    });

    expect(second.id).toBe(first.id);
    expect(second.chapterNumber).toBe(2);
  });
});
```

Use a real Prisma test client initialized in `apps/server/src/test/db.ts`. The helper must create a temporary SQLite database, run migrations before the test suite, and disconnect after tests.

- [ ] **Step 6: Implement repositories**

Implement exact exported functions with these signatures and behavior:

```ts
export async function upsertTelegramUser(db: DbClient, input: {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<TelegramUser>;

export async function listPublishedBooks(db: DbClient): Promise<Book[]>;

export async function getBookById(db: DbClient, bookId: string): Promise<Book | null>;

export async function getChapterByNumber(db: DbClient, bookId: string, chapterNumber: number): Promise<Chapter | null>;

export async function upsertReadingProgress(db: DbClient, input: {
  userId: string;
  bookId: string;
  chapterNumber: number;
  position: number;
  percent: number | null;
}): Promise<ReadingProgress>;

export async function getActiveAccess(db: DbClient, userId: string, now?: Date): Promise<UserAccess | null>;

export async function extendAccessByThirtyDays(db: DbClient, userId: string, now?: Date): Promise<UserAccess>;

export async function recordAnalyticsEvent(db: DbClient, input: {
  userId: string;
  username?: string | null;
  source: "bot" | "miniapp";
  label: string;
  metadata?: unknown;
  occurredAt?: Date;
}): Promise<AnalyticsEvent>;
```

Repository behavior:

- `upsertTelegramUser` creates by Telegram id or updates username/name fields.
- `listPublishedBooks` returns books where `status = "published"` sorted by `createdAt desc`.
- `getBookById` returns one book by id.
- `getChapterByNumber` uses unique pair `bookId + chapterNumber`.
- `upsertReadingProgress` updates the unique `userId + bookId` record.
- `getActiveAccess` returns `null` when no access exists or `subscriptionUntil <= now`.
- `extendAccessByThirtyDays` extends from existing future `subscriptionUntil`, otherwise from `now`.
- `recordAnalyticsEvent` stores `metadata` as JSON string when present and defaults `occurredAt` to current time.

- [ ] **Step 7: Verify**

Run: `pnpm --filter @novell-reader/server prisma:generate`

Run: `pnpm --filter @novell-reader/server typecheck`

Run: `pnpm --filter @novell-reader/server test`

Expected: generation, typecheck, and tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/server packages/shared package.json pnpm-lock.yaml
git commit -m "feat: add backend data model"
```

---

### Task 4: EPUB Import Pipeline

**Files:**
- Create: `apps/server/src/import/epub.ts`
- Create: `apps/server/src/import/cli.ts`
- Test: `apps/server/src/import/epub.test.ts`
- Modify: `apps/server/package.json`

**Interfaces:**
- Consumes: Prisma `Book` and `Chapter` models.
- Produces: `importEpubDirectory(input: ImportEpubDirectoryInput): Promise<ImportSummary>`
- Produces: normalized chapters in DB and content files in `content/imported/`.

- [ ] **Step 1: Add EPUB parsing dependencies**

Run:

```bash
pnpm --filter @novell-reader/server add adm-zip cheerio sanitize-html slugify
pnpm --filter @novell-reader/server add -D @types/adm-zip
```

- [ ] **Step 2: Write failing import unit test**

Create `apps/server/src/import/epub.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractChapterNumber, shouldSkipChapterTitle } from "./epub.js";

describe("EPUB import helpers", () => {
  it("keeps real chapters and skips service pages", () => {
    expect(shouldSkipChapterTitle("Глава 51. Экстра")).toBe(false);
    expect(shouldSkipChapterTitle("Информация о книге")).toBe(true);
  });

  it("extracts chapter numbers from titles", () => {
    expect(extractChapterNumber("Глава 17")).toBe(17);
    expect(extractChapterNumber("Глава 51. Экстра")).toBe(51);
  });
});
```

- [ ] **Step 3: Implement helper functions**

In `apps/server/src/import/epub.ts`:

```ts
export function shouldSkipChapterTitle(title: string): boolean {
  return ["информация о книге", "об авторе", "оглавление"].includes(title.trim().toLowerCase());
}

export function extractChapterNumber(title: string): number | null {
  const match = title.match(/глава\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}
```

- [ ] **Step 4: Implement importer**

Implement `importEpubDirectory`:

```ts
export type ImportEpubDirectoryInput = {
  db: DbClient;
  sourceDir: string;
  outputDir: string;
};

export type ImportSummary = {
  importedBooks: number;
  importedChapters: number;
  skippedFiles: string[];
};
```

Required behavior:

- read all `.epub` files from `sourceDir`;
- open zip with `adm-zip`;
- read `META-INF/container.xml` to find OPF path;
- parse OPF manifest and spine;
- read `toc.ncx` for readable chapter titles when available;
- save cover image to `content/imported/<bookId>/cover.<ext>`;
- sanitize each XHTML chapter with `sanitize-html`;
- write each chapter to `content/imported/<bookId>/chapters/<number>.html`;
- upsert `Book`;
- delete/recreate chapters for that book during import;
- calculate `freeChapterLimit` with `calculateFreeChapterLimit(chapterCount)`;
- skip service pages such as `Информация о книге`.

- [ ] **Step 5: Implement CLI**

Create `apps/server/src/import/cli.ts`:

```ts
import path from "node:path";
import { prisma } from "../db.js";
import { importEpubDirectory } from "./epub.js";

const root = process.cwd().includes("/apps/server")
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const summary = await importEpubDirectory({
  db: prisma,
  sourceDir: path.join(root, "content/epub"),
  outputDir: path.join(root, "content/imported")
});

console.log(`Импортировано книг: ${summary.importedBooks}`);
console.log(`Импортировано глав: ${summary.importedChapters}`);
if (summary.skippedFiles.length > 0) {
  console.log(`Пропущено файлов: ${summary.skippedFiles.join(", ")}`);
}

await prisma.$disconnect();
```

- [ ] **Step 6: Verify with sample EPUB**

Copy the sample EPUB into `content/epub/` manually or document the path used for local testing.

Run:

```bash
pnpm import:epub
```

Expected for sample file:

- imported book title contains `компенсация за первую любовь`;
- imported chapter count is 51;
- free limit is 17;
- `Информация о книге` is not imported as a chapter;
- cover file exists under `content/imported/<bookId>/`.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/import apps/server/package.json content/imported package.json pnpm-lock.yaml
git commit -m "feat: import epub novels"
```

---

### Task 5: Backend API And Business Services

**Files:**
- Create: `apps/server/src/services/books.ts`
- Create: `apps/server/src/services/progress.ts`
- Create: `apps/server/src/services/access.ts`
- Create: `apps/server/src/services/analytics.ts`
- Create: `apps/server/src/api.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/src/services/access.test.ts`
- Test: `apps/server/src/api.test.ts`

**Interfaces:**
- Consumes: repositories from Task 3.
- Produces API:
  - `GET /api/me`
  - `GET /api/books`
  - `GET /api/books/:bookId`
  - `GET /api/books/:bookId/chapters/:chapterNumber`
  - `POST /api/progress`
  - `POST /api/analytics`
  - `POST /api/payments/create`

- [ ] **Step 1: Define API auth approach**

Use Telegram Mini App init data validation for production path. For local development, allow `x-dev-telegram-user-id` only when `NODE_ENV !== "production"`.

Create a helper:

```ts
export type RequestUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};
```

Implement `requireTelegramUser(req: Request): Promise<RequestUser>` so it:

- validates Telegram Mini App `initData` from `x-telegram-init-data` in production;
- reads `x-dev-telegram-user-id` and `x-dev-telegram-username` only outside production;
- throws an HTTP 401 error when neither valid init data nor dev headers are available;
- upserts the Telegram user before route handlers use the id.

- [ ] **Step 2: Write access service test**

Test that paid chapter returns locked when no access and readable after access extension:

```ts
import { describe, expect, it } from "vitest";
import { getReadableChapterState } from "./access.js";

describe("getReadableChapterState", () => {
  it("locks chapter after free limit without access", () => {
    expect(getReadableChapterState({
      chapterNumber: 18,
      totalChapters: 51,
      freeChapterLimit: 17,
      subscriptionUntil: null
    })).toEqual({ canRead: false, reason: "paywall" });
  });
});
```

- [ ] **Step 3: Implement services**

Implement these service interfaces:

```ts
export async function listBooksForUser(db: DbClient, userId: string): Promise<BookSummary[]>;
export async function getBookDetailForUser(db: DbClient, userId: string, bookId: string): Promise<BookSummary | null>;
export async function getChapterForUser(db: DbClient, userId: string, bookId: string, chapterNumber: number): Promise<ChapterDto | { canRead: false; reason: "paywall" }>;
export async function saveProgress(db: DbClient, input: SaveProgressInput): Promise<ReadingProgress>;
export async function createAnalyticsEvent(db: DbClient, input: AnalyticsInput): Promise<AnalyticsEvent>;
```

When `getChapterForUser` returns readable chapter, read HTML content from `contentPath` on the server and include it in `ChapterDto.html`.

- [ ] **Step 4: Implement Express API**

Create `apps/server/src/api.ts` with:

```ts
import express from "express";
import cors from "cors";

export function createApiServer(deps: ApiDeps) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  return app;
}
```

Add these routes after `/health`:

- `GET /api/books`: authenticate user, call `listBooksForUser`, return JSON array.
- `GET /api/books/:bookId`: authenticate user, call `getBookDetailForUser`, return 404 if missing.
- `GET /api/books/:bookId/chapters/:chapterNumber`: authenticate user, call `getChapterForUser`, return `{ canRead: false, reason: "paywall" }` with HTTP 402 when locked.
- `POST /api/progress`: authenticate user, validate `bookId`, `chapterNumber`, `position`, `percent`, then call `saveProgress`.
- `POST /api/analytics`: authenticate user, validate `label` and optional `metadata`, then call `createAnalyticsEvent`.
- `POST /api/payments/create`: authenticate user, create a Telegram Stars invoice for 30-day access, return invoice link or payload needed by Mini App.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @novell-reader/server test
pnpm --filter @novell-reader/server typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "feat: add mini app api"
```

---

### Task 6: Telegram Bot, Stars Payments, Analytics Flush

**Files:**
- Create: `apps/server/src/bot.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/services/access.ts`
- Modify: `apps/server/src/services/analytics.ts`
- Test: `apps/server/src/services/analytics.test.ts`

**Interfaces:**
- Consumes: config, repositories, analytics formatter.
- Produces: `/start` handler, `Книги` web_app button, `Поддержка` URL button, successful payment handler, one-minute analytics flusher.

- [ ] **Step 1: Implement bot start handler**

Create `apps/server/src/bot.ts`:

```ts
import { Bot, InlineKeyboard } from "grammy";

export function createBot(deps: BotDeps) {
  const bot = new Bot(deps.config.BOT_TOKEN);

  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    await deps.users.upsertTelegramUser(deps.db, {
      id: String(from.id),
      username: from.username ?? null,
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null
    });

    await deps.analytics.recordAnalyticsEvent(deps.db, {
      userId: String(from.id),
      username: from.username ?? null,
      source: "bot",
      label: "старт бота"
    });

    const keyboard = new InlineKeyboard()
      .webApp("Книги", deps.config.MINI_APP_URL)
      .url("Поддержка", deps.config.SUPPORT_URL);

    await ctx.reply("Откройте каталог новелл или напишите в поддержку.", { reply_markup: keyboard });
  });

  return bot;
}
```

- [ ] **Step 2: Implement Stars invoice creation**

Use Telegram Stars payments through bot API. Product copy:

```ts
const title = "Доступ к новеллам на 30 дней";
const description = "Откройте продолжение всех новелл на 30 дней.";
```

Provider token for Stars must be empty string according to Telegram Stars flow. `prices` contains one item with `amount = STARS_ACCESS_PRICE`.

- [ ] **Step 3: Implement successful payment handler**

On successful payment:

- find Telegram user;
- record payment as `paid`;
- call `extendAccessByThirtyDays`;
- record analytics event `оплата успешна`.

Use `providerPayload` to deduplicate payment processing.

- [ ] **Step 4: Implement analytics flusher**

In `apps/server/src/services/analytics.ts`, implement:

```ts
export async function flushAnalyticsToTelegram(input: {
  db: DbClient;
  bot: Bot;
  channelId: string;
  now?: Date;
}): Promise<{ sent: boolean; eventCount: number }> {}
```

Required behavior:

- select unflushed events with `occurredAt < now`;
- group events from the last minute batch window;
- format with `formatAnalyticsBatch`;
- send one message to `ANALYTICS_CHANNEL_ID`;
- mark sent events with `flushedAt`;
- do nothing when there are no events.

- [ ] **Step 5: Wire startup**

Create `apps/server/src/index.ts`:

```ts
import { loadConfig } from "./config.js";
import { prisma } from "./db.js";
import { createApiServer } from "./api.js";
import { createBot } from "./bot.js";
import { flushAnalyticsToTelegram } from "./services/analytics.js";

const config = loadConfig();
const bot = createBot({ config, db: prisma });
const app = createApiServer({ config, db: prisma, bot });

app.listen(config.PORT, () => {
  console.log(`Server listening on ${config.PORT}`);
});

bot.start();

setInterval(() => {
  flushAnalyticsToTelegram({ db: prisma, bot, channelId: config.ANALYTICS_CHANNEL_ID }).catch(console.error);
}, 60_000);
```

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --filter @novell-reader/server test
pnpm --filter @novell-reader/server typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 7: Commit**

```bash
git add apps/server
git commit -m "feat: add telegram bot payments and logs"
```

---

### Task 7: Mini App UI And Reader Flow

**Files:**
- Create: `apps/miniapp/package.json`
- Create: `apps/miniapp/tsconfig.json`
- Create: `apps/miniapp/vite.config.ts`
- Create: `apps/miniapp/index.html`
- Create: `apps/miniapp/src/main.tsx`
- Create: `apps/miniapp/src/App.tsx`
- Create: `apps/miniapp/src/api/client.ts`
- Create: `apps/miniapp/src/telegram.ts`
- Create: `apps/miniapp/src/screens/CatalogScreen.tsx`
- Create: `apps/miniapp/src/screens/NovelScreen.tsx`
- Create: `apps/miniapp/src/screens/ReaderScreen.tsx`
- Create: `apps/miniapp/src/screens/ProfileScreen.tsx`
- Create: `apps/miniapp/src/screens/PaywallScreen.tsx`
- Create: `apps/miniapp/src/components/BookCard.tsx`
- Create: `apps/miniapp/src/components/BottomNav.tsx`
- Create: `apps/miniapp/src/components/LoadingState.tsx`
- Create: `apps/miniapp/src/components/ErrorState.tsx`
- Create: `apps/miniapp/src/styles.css`
- Test: `apps/miniapp/src/App.test.tsx`

**Interfaces:**
- Consumes: API endpoints from Task 5.
- Produces: Mini App screens: Catalog, Novel Detail, Reader, Profile, Paywall.

- [ ] **Step 1: Create Mini App package**

Create `apps/miniapp/package.json`:

```json
{
  "name": "@novell-reader/miniapp",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@novell-reader/shared": "workspace:*",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/react": "^15.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^24.1.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Implement API client**

Create `apps/miniapp/src/api/client.ts`:

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? "",
      ...options.headers
    }
  });
  if (!res.ok) throw new Error(`Ошибка API: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  books: () => request("/api/books"),
  book: (bookId: string) => request(`/api/books/${bookId}`),
  chapter: (bookId: string, chapterNumber: number) => request(`/api/books/${bookId}/chapters/${chapterNumber}`),
  saveProgress: (body: unknown) => request("/api/progress", { method: "POST", body: JSON.stringify(body) }),
  analytics: (label: string, metadata?: unknown) => request("/api/analytics", { method: "POST", body: JSON.stringify({ label, metadata }) }),
  createPayment: () => request("/api/payments/create", { method: "POST" })
};
```

- [ ] **Step 3: Implement Telegram wrapper**

Create `apps/miniapp/src/telegram.ts`:

```ts
export function initTelegramApp() {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready();
  webApp?.expand();
  return webApp;
}

export function openInvoice(url: string) {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.openInvoice) {
    webApp.openInvoice(url);
    return;
  }
  window.location.href = url;
}
```

- [ ] **Step 4: Implement screens**

Implement screens with these visible texts:

- Catalog header: `Книги`
- Profile tab: `Профиль`
- Empty catalog: `Книги пока не импортированы`
- Reader blocked state: route to Paywall screen
- Paywall primary copy: `Бесплатная часть закончилась. Откройте доступ на 30 дней, чтобы продолжить чтение.`
- Paywall button: `Получить доступ`
- Profile started section: `Начатые новеллы`

Use bottom nav with two tabs: `Книги`, `Профиль`.

- [ ] **Step 5: Implement reader progress saving**

In `ReaderScreen.tsx`:

- save progress on chapter open;
- save progress on scroll with a debounce of 1000 ms;
- save `{ bookId, chapterNumber, position, percent }`;
- log `начал читать Главу N` on chapter open;
- log `перешел на следующую главу` and `перешел на предыдущую главу` on navigation.

- [ ] **Step 6: Implement cozy library styling**

In `styles.css`:

- use readable base font size at least `17px` in reader;
- avoid negative letter spacing;
- use covers as primary catalog visuals;
- keep controls large enough for Telegram mobile UI;
- use calm warm neutrals with restrained accent color;
- do not use teen slang or aggressive paywall styling.

- [ ] **Step 7: Add UI smoke test**

Create `apps/miniapp/src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders catalog navigation", () => {
    render(<App />);
    expect(screen.getByText("Книги")).toBeInTheDocument();
    expect(screen.getByText("Профиль")).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Verify**

Run:

```bash
pnpm --filter @novell-reader/miniapp test
pnpm --filter @novell-reader/miniapp typecheck
pnpm --filter @novell-reader/miniapp build
```

Expected: tests, typecheck, and build pass.

- [ ] **Step 9: Commit**

```bash
git add apps/miniapp package.json pnpm-lock.yaml
git commit -m "feat: add telegram mini app"
```

---

### Task 8: End-To-End Local Verification And Docs

**Files:**
- Create: `README.md`
- Create: `docs/local-development.md`
- Modify: `.env.example`
- Optional Test: `apps/miniapp/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: documented local run flow and MVP verification checklist.

- [ ] **Step 1: Write README**

Create `README.md` with Russian sections:

```md
# Novell Reader

Telegram-бот и Telegram Mini App для чтения новелл.

## MVP

- EPUB-импорт новелл из `content/epub/`
- Каталог в Telegram Mini App
- Читалка по главам
- Прогресс чтения
- Paywall после первой трети глав
- Доступ на 30 дней через Telegram Stars
- Логи событий в Telegram-канал

## Быстрый старт

1. Скопировать `.env.example` в `.env`.
2. Заполнить `BOT_TOKEN`, `MINI_APP_URL`, `ANALYTICS_CHANNEL_ID`, `STARS_ACCESS_PRICE`.
3. Установить зависимости: `pnpm install`.
4. Подготовить БД: `pnpm --filter @novell-reader/server prisma:migrate`.
5. Положить EPUB в `content/epub/`.
6. Импортировать книги: `pnpm import:epub`.
7. Запустить backend/bot: `pnpm dev:server`.
8. Запустить Mini App: `pnpm dev:miniapp`.
```

- [ ] **Step 2: Write local development doc**

Create `docs/local-development.md` covering:

- how to create Telegram bot token;
- how to configure Mini App URL;
- how to set support URL;
- how to create analytics channel and add bot as admin;
- where to put EPUB files;
- how to import books;
- how to test `/start`;
- how to test paywall;
- how to test Stars payment in Telegram test/prod constraints.

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: all packages pass.

- [ ] **Step 4: Manual MVP checklist**

Verify manually and record result in final implementation notes:

```text
[ ] /start sends message with Книги and Поддержка
[ ] /start creates analytics event старт бота
[ ] Поддержка opens https://t.me/esimsmile_support
[ ] EPUB sample imports as 51 chapters and free limit 17
[ ] Catalog shows imported book with cover
[ ] Reader opens free chapter
[ ] Chapter 18 for 51-chapter book shows paywall without access
[ ] Successful payment extends access by 30 days
[ ] Profile shows started novels
[ ] Analytics channel receives one-minute grouped log
```

- [ ] **Step 5: Commit**

```bash
git add README.md docs/local-development.md .env.example
git commit -m "docs: add local verification guide"
```

---

## Self-Review

Spec coverage:

- Bot `/start`, `Книги`, `Поддержка`: Task 6.
- Mini App catalog, detail, reader, profile, paywall: Task 7.
- EPUB import for about 20 books: Task 4.
- Progress saving: Tasks 3, 5, 7.
- Paywall after first third of chapters: Tasks 2, 5, 7.
- 30-day Stars access: Tasks 3, 5, 6.
- Analytics in one-minute channel batches with `старт бота`: Tasks 2, 3, 5, 6.
- Russian docs and local verification: Task 8.

Known implementation risk:

- Telegram Stars behavior should be verified against the current Telegram Bot API during implementation, because payment APIs can change. Use official Telegram documentation for final exact method names and payload shape before coding Task 6.
