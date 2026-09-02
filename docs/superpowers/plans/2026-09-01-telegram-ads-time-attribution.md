# Telegram Ads Time-Based Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add probabilistic attribution from Telegram Ads campaigns to Telegram bot `/start` users by matching bot start times with Telegram Ads `actions` counter deltas.

**Architecture:** Keep attribution as a separate backend subsystem inside `apps/server`. The bot records structured start events, an Ads collector records periodic Telegram Ads metric snapshots, and a matcher assigns each bot start an attribution result: `likely`, `ambiguous`, or `unknown`.

**Tech Stack:** Node.js, TypeScript, Express, grammY, Prisma, SQLite, Vitest. Prefer a Telegram Ads internal JSON endpoint if one is available from the authenticated cabinet; use browser automation as the next option; use HTML parsing with `cheerio` only as a fallback.

**Spec:** This plan is the implementation source of truth for the MVP attribution subsystem.

## Global Constraints

- Do not replace the existing `AnalyticsEvent` flow; it remains the lightweight analytics digest mechanism.
- Do not block bot `/start`, payments, Mini App API, webhook handling, or polling on Telegram Ads collection.
- Treat attribution as probabilistic. Never label these matches as exact unless Telegram later provides a deterministic campaign identifier to the bot.
- Match primarily on Telegram Ads `actions`, not `clicks`, because `actions` are closer to bot-start outcomes for bot destinations.
- Put all runtime collector behavior behind `TELEGRAM_ADS_ATTRIBUTION_ENABLED`; default it to disabled.
- Keep collector failures isolated with `try/catch` and persist enough failure state for diagnosis.
- No Mini App UI changes are required for the MVP.

---

## Current Project Context

Relevant existing files:

- `apps/server/src/bot.ts`: handles `/start`, upserts `TelegramUser`, records analytics event `старт бота`.
- `apps/server/src/repositories/users.ts`: upserts Telegram users.
- `apps/server/src/repositories/analytics.ts`: writes `AnalyticsEvent`.
- `apps/server/src/services/analytics.ts`: formats and flushes analytics to Telegram.
- `apps/server/src/index.ts`: starts Express, starts bot polling/webhook mode, and runs the current analytics flush interval.
- `apps/server/src/config.ts`: parses environment configuration with Zod.
- `apps/server/prisma/schema.prisma`: Prisma schema, currently SQLite.
- `apps/server/src/test/db.ts`: hand-written SQLite test schema for repository/service tests.
- `docker-compose.yml`: production runs as one service with SQLite in Docker volume.
- `Dockerfile`: based on `node:22-bookworm-slim`; it does not currently install browser dependencies.

## File Structure

Create:

- `apps/server/src/repositories/botStarts.ts`: persistence for structured bot start events.
- `apps/server/src/repositories/telegramAds.ts`: persistence for Ads snapshots, metrics, and action deltas.
- `apps/server/src/repositories/userAttributions.ts`: persistence for per-start attribution results.
- `apps/server/src/services/adsAttribution.ts`: matching logic from bot starts to Ads action deltas.
- `apps/server/src/services/adsAttribution.test.ts`: unit tests for matching behavior.
- `apps/server/src/telegramAds/collector.ts`: runtime collector entrypoint that obtains and stores Telegram Ads metrics.
- `apps/server/src/telegramAds/parser.ts`: converts raw Telegram Ads data into normalized metrics.
- `apps/server/src/telegramAds/parser.test.ts`: parser tests using representative raw payload/HTML samples.

Modify:

- `apps/server/prisma/schema.prisma`: add attribution models and relations.
- `apps/server/src/test/db.ts`: add matching SQLite DDL for tests.
- `apps/server/src/bot.ts`: write `BotStartEvent` on `/start` while preserving existing analytics event.
- `apps/server/src/index.ts`: start collector and matcher intervals when enabled.
- `apps/server/src/config.ts`: add attribution-related env vars.
- `apps/server/src/services/analytics.ts`: optionally enrich start-event digest lines with attribution status/source when present.
- `apps/server/package.json`: add runtime dependencies only if collector implementation requires them, for example Playwright.
- `Dockerfile`: add browser/system dependencies only if the final collector requires headless browser automation.

---

### Task 1: Add Prisma Models And Test Database Schema

**Files:**

- Modify: `apps/server/prisma/schema.prisma`
- Modify: `apps/server/src/test/db.ts`

**Interfaces:**

- Produces Prisma models: `BotStartEvent`, `TelegramAdsSnapshot`, `TelegramAdMetric`, `TelegramAdActionDelta`, `UserAttribution`.
- Later repository tasks consume these model names through Prisma Client.

- [ ] **Step 1: Add `BotStartEvent` model**

Add a model with:

- `id String @id @default(cuid())`
- `userId String`
- `username String?`
- `occurredAt DateTime @default(now())`
- `isFirstStart Boolean`
- relation `user TelegramUser @relation(fields: [userId], references: [id], onDelete: Cascade)`
- indexes on `occurredAt` and `userId`

Also add `botStartEvents BotStartEvent[]` to `TelegramUser`.

- [ ] **Step 2: Add Telegram Ads snapshot and metric models**

Add `TelegramAdsSnapshot`:

- `id String @id @default(cuid())`
- `collectedAt DateTime @default(now())`
- `status String`
- `errorMessage String?`
- `rawPayload String?`
- relation `metrics TelegramAdMetric[]`
- indexes on `collectedAt` and `status`

Add `TelegramAdMetric`:

- `id String @id @default(cuid())`
- `snapshotId String`
- `adKey String`
- `adTitle String`
- `views Int`
- `clicks Int`
- `actions Int`
- `spent Float`
- relation `snapshot TelegramAdsSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)`
- unique constraint on `[snapshotId, adKey]`
- index on `adKey`

- [ ] **Step 3: Add action delta model**

Add `TelegramAdActionDelta`:

- `id String @id @default(cuid())`
- `adKey String`
- `adTitle String`
- `delta Int`
- `observedFrom DateTime`
- `observedTo DateTime`
- `fromSnapshotId String?`
- `toSnapshotId String?`
- indexes on `observedFrom`, `observedTo`, and `adKey`

Do not create deltas for `delta <= 0`.

- [ ] **Step 4: Add user attribution model**

Add `UserAttribution`:

- `id String @id @default(cuid())`
- `userId String`
- `botStartEventId String @unique`
- `status String`
- `primarySource String?`
- `candidatesJson String?`
- `matchedWindowFrom DateTime`
- `matchedWindowTo DateTime`
- `createdAt DateTime @default(now())`
- relation to `TelegramUser`
- relation to `BotStartEvent`
- indexes on `userId`, `status`, and `createdAt`

Also add `attributions UserAttribution[]` to `TelegramUser` and `attribution UserAttribution?` to `BotStartEvent`.

- [ ] **Step 5: Mirror the new schema in `apps/server/src/test/db.ts`**

Add SQLite `CREATE TABLE` statements for all new models and indexes. Follow the existing style in `SCHEMA_SQL`.

- [ ] **Step 6: Generate Prisma Client and run tests**

Run:

```bash
pnpm --filter @novell-reader/server prisma:generate
pnpm --filter @novell-reader/server test
pnpm --filter @novell-reader/server typecheck
```

Expected: existing tests still pass after schema generation and test DB update.

---

### Task 2: Record Structured Bot Start Events

**Files:**

- Create: `apps/server/src/repositories/botStarts.ts`
- Modify: `apps/server/src/bot.ts`
- Test: add coverage in an appropriate bot/repository test file

**Interfaces:**

- Produces `recordBotStartEvent(db, input): Promise<BotStartEvent>`.
- Produces `listUnattributedBotStartEvents(db, before, limit): Promise<BotStartEvent[]>`.

- [ ] **Step 1: Implement repository API**

`recordBotStartEvent` input:

- `userId: string`
- `username?: string | null`
- `occurredAt?: Date`

Behavior:

- Determine `isFirstStart` by checking whether this user already has any `BotStartEvent`.
- Create the new `BotStartEvent`.
- Return it.

- [ ] **Step 2: Add pending-start query**

`listUnattributedBotStartEvents` behavior:

- Return bot start events with no related `UserAttribution`.
- Only include `occurredAt < before`.
- Order ascending by `occurredAt`.
- Limit by caller-provided `limit`.

- [ ] **Step 3: Call repository from `/start`**

In `apps/server/src/bot.ts`, after `upsertTelegramUser` and before or near `recordAnalyticsEvent`, call `recordBotStartEvent`.

Preserve the existing `AnalyticsEvent` with label `старт бота`.

- [ ] **Step 4: Test first-start behavior**

Add a test proving:

- first `/start` for a user creates `isFirstStart = true`
- second `/start` for same user creates `isFirstStart = false`

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @novell-reader/server test -- src/repositories
pnpm --filter @novell-reader/server typecheck
```

Expected: tests pass.

---

### Task 3: Implement Telegram Ads Persistence And Delta Calculation

**Files:**

- Create: `apps/server/src/repositories/telegramAds.ts`
- Test: `apps/server/src/repositories/telegramAds.test.ts`

**Interfaces:**

- Produces `NormalizedTelegramAdMetric`.
- Produces `recordTelegramAdsSnapshot(db, input): Promise<{ snapshotId: string; deltasCreated: number }>`
- Later collector consumes this repository.

Define normalized metric shape:

```ts
export type NormalizedTelegramAdMetric = {
  adKey: string;
  adTitle: string;
  views: number;
  clicks: number;
  actions: number;
  spent: number;
};
```

- [ ] **Step 1: Write tests for first snapshot**

Expected behavior:

- creates one `TelegramAdsSnapshot` with `status = "success"`
- creates one `TelegramAdMetric` per normalized metric
- creates no deltas because there is no previous successful snapshot

- [ ] **Step 2: Write tests for positive action delta**

Given previous snapshot:

- ad `romance`, actions `4`

Given next snapshot:

- ad `romance`, actions `6`

Expected:

- one `TelegramAdActionDelta`
- `delta = 2`
- `observedFrom = previous.collectedAt`
- `observedTo = next.collectedAt`

- [ ] **Step 3: Write tests for zero/negative deltas**

Expected:

- no delta for unchanged actions
- no delta for decreased actions
- decreased actions should not throw

- [ ] **Step 4: Implement `recordTelegramAdsSnapshot`**

Implementation rules:

- Save raw payload if provided.
- Save all normalized metrics.
- Find immediately previous successful snapshot before current `collectedAt`.
- Compare current metrics against previous metrics by `adKey`.
- Create deltas only when `current.actions - previous.actions > 0`.

- [ ] **Step 5: Add failure snapshot helper**

Add `recordTelegramAdsCollectionFailure(db, input)`:

- `collectedAt?: Date`
- `errorMessage: string`
- `rawPayload?: unknown`

It creates `TelegramAdsSnapshot` with `status = "failed"` and no metrics.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @novell-reader/server test -- src/repositories/telegramAds.test.ts
pnpm --filter @novell-reader/server typecheck
```

Expected: tests pass.

---

### Task 4: Implement Attribution Matcher

**Files:**

- Create: `apps/server/src/repositories/userAttributions.ts`
- Create: `apps/server/src/services/adsAttribution.ts`
- Test: `apps/server/src/services/adsAttribution.test.ts`

**Interfaces:**

- Produces `matchPendingTelegramAdsAttributions(db, options): Promise<{ processed: number; likely: number; ambiguous: number; unknown: number }>`
- Consumes `BotStartEvent` and `TelegramAdActionDelta`.

Options:

```ts
export type AdsAttributionMatchOptions = {
  now?: Date;
  beforeWindowSeconds: number;
  afterWindowSeconds: number;
  unknownAfterSeconds: number;
  limit: number;
};
```

- [ ] **Step 1: Implement attribution repository**

Add:

- `createUserAttribution(db, input)`
- `findAttributionForStartEvent(db, botStartEventId)`
- `listActionDeltasOverlappingWindow(db, from, to)`

Make creation idempotent through the unique `botStartEventId` constraint. If a duplicate exists, return the existing row.

- [ ] **Step 2: Write matcher tests for `likely`**

Scenario:

- one bot start at `12:00:10`
- one action delta for ad `романтика` observed between `12:00:00` and `12:00:20`

Expected:

- attribution status `likely`
- `primarySource = "романтика"`
- candidates include only `романтика`

- [ ] **Step 3: Write matcher tests for `ambiguous`**

Scenario:

- one bot start at `12:00:10`
- action delta for `романтика`
- action delta for `ранобэ`
- both overlap the match window

Expected:

- attribution status `ambiguous`
- `primarySource = null`
- `candidatesJson` contains both sources

- [ ] **Step 4: Write matcher tests for `unknown`**

Scenario:

- bot start is older than `unknownAfterSeconds`
- no deltas overlap the match window

Expected:

- attribution status `unknown`
- no primary source
- empty candidates

- [ ] **Step 5: Implement matcher**

For each pending bot start:

- If it is too recent, skip it so late Ads counter updates can arrive.
- Window start: `occurredAt - beforeWindowSeconds`.
- Window end: `occurredAt + afterWindowSeconds`.
- Query overlapping action deltas.
- Build candidates from every matching delta.
- If candidate count is `0`, create `unknown`.
- If candidate count is `1`, create `likely`.
- If candidate count is greater than `1`, create `ambiguous`.

Do not try to over-optimize confidence scoring in MVP.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @novell-reader/server test -- src/services/adsAttribution.test.ts
pnpm --filter @novell-reader/server typecheck
```

Expected: tests pass.

---

### Task 5: Implement Telegram Ads Parser And Collector Adapter

**Files:**

- Create: `apps/server/src/telegramAds/parser.ts`
- Create: `apps/server/src/telegramAds/parser.test.ts`
- Create: `apps/server/src/telegramAds/collector.ts`
- Modify: `apps/server/package.json` only if a new collector dependency is required
- Modify: `Dockerfile` only if headless browser dependencies are required

**Interfaces:**

- Produces `collectTelegramAdsSnapshot(db, config): Promise<{ ok: boolean; metricsCount: number; deltasCreated: number }>`
- Consumes `recordTelegramAdsSnapshot` and `recordTelegramAdsCollectionFailure`.

- [ ] **Step 1: Investigate Telegram Ads data source manually**

Open the authenticated Telegram Ads cabinet in a browser and inspect Network requests.

Prefer data sources in this order:

1. Authenticated JSON/internal endpoint returning ad list and metrics.
2. Browser automation that can read the rendered table.
3. HTML scraping with `cheerio`.

Record the selected approach in comments near collector configuration.

- [ ] **Step 2: Implement parser against saved sample payload**

Store test samples inside the test file or fixtures if they are small and non-sensitive.

Parser output must normalize:

- `adKey`
- `adTitle`
- `views`
- `clicks`
- `actions`
- `spent`

Parse formatted numbers like `1,573` as `1573`.

- [ ] **Step 3: Test parser**

Test:

- multiple ads parse correctly
- formatted numbers parse correctly
- missing required fields throw a clear parser error

- [ ] **Step 4: Implement collector adapter**

Collector behavior:

- Fetch or read current Ads metrics.
- Pass raw data to parser.
- Save success snapshot through `recordTelegramAdsSnapshot`.
- On error, save failed snapshot through `recordTelegramAdsCollectionFailure`.
- Return a compact result object for logs.

- [ ] **Step 5: Avoid committing secrets**

Do not commit cookies, session files, account IDs, tokens, screenshots containing private account details, or raw production payloads.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @novell-reader/server test -- src/telegramAds/parser.test.ts
pnpm --filter @novell-reader/server typecheck
```

Expected: tests pass.

---

### Task 6: Wire Background Jobs Behind Feature Flag

**Files:**

- Modify: `apps/server/src/config.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/src/config.test.ts`

**Interfaces:**

- Consumes `collectTelegramAdsSnapshot`.
- Consumes `matchPendingTelegramAdsAttributions`.

- [ ] **Step 1: Add config fields**

Add:

- `TELEGRAM_ADS_ATTRIBUTION_ENABLED`: boolean-like string, default `false`
- `TELEGRAM_ADS_COLLECT_INTERVAL_MS`: positive int, default `15000`
- `TELEGRAM_ADS_MATCH_INTERVAL_MS`: positive int, default `15000`
- `TELEGRAM_ADS_MATCH_WINDOW_BEFORE_SECONDS`: positive int, default `60`
- `TELEGRAM_ADS_MATCH_WINDOW_AFTER_SECONDS`: positive int, default `180`
- `TELEGRAM_ADS_UNKNOWN_AFTER_SECONDS`: positive int, default `600`

Keep defaults safe for local development.

- [ ] **Step 2: Test config defaults**

Update `config.test.ts` to assert:

- attribution is disabled by default
- default intervals/windows match the values above

- [ ] **Step 3: Add safe interval wrappers**

In `index.ts`, if attribution is enabled:

- start collector interval
- start matcher interval
- wrap each interval body in `try/catch`
- log errors with enough context
- do not throw out of interval callbacks

- [ ] **Step 4: Prevent overlapping collector runs**

Use an in-memory `isCollecting` guard so a slow collection does not overlap with the next tick.

Use a separate `isMatching` guard for matcher.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @novell-reader/server test -- src/config.test.ts
pnpm --filter @novell-reader/server typecheck
```

Expected: tests pass.

---

### Task 7: Surface Attribution In Analytics Digest

**Files:**

- Modify: `apps/server/src/services/analytics.ts`
- Modify or add tests: `apps/server/src/services/analytics.test.ts`

**Interfaces:**

- Consumes `UserAttribution`.
- Produces enriched Telegram digest text for `старт бота` events where attribution exists.

- [ ] **Step 1: Decide minimal digest shape**

For a start event with likely attribution:

```text
атрибуция: likely, романтика
```

For ambiguous:

```text
атрибуция: ambiguous, варианты: романтика, ранобэ
```

For unknown:

```text
атрибуция: unknown
```

- [ ] **Step 2: Fetch attribution for start events**

When flushing analytics, for events with:

- `source = "bot"`
- `label = "старт бота"`

look up attribution for the nearest matching `BotStartEvent` by same `userId` and close `occurredAt`.

Prefer adding `botStartEventId` into analytics metadata during Task 2 if that keeps this lookup cleaner.

- [ ] **Step 3: Add tests**

Test that digest includes attribution lines for:

- likely
- ambiguous
- unknown

Existing analytics digest behavior should remain unchanged for non-start events.

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm --filter @novell-reader/server test -- src/services/analytics.test.ts
pnpm --filter @novell-reader/server typecheck
```

Expected: tests pass.

---

### Task 8: Production Rollout And Verification

**Files:**

- Modify: `.env.example` if present
- Modify: `README.md` only if operational setup changed
- Modify: `docker-compose.yml` only if collector requires new mounted session/cookie volume
- Modify: `Dockerfile` only if collector requires browser dependencies

**Interfaces:**

- Produces deployable attribution MVP.

- [ ] **Step 1: Keep feature disabled by default**

Ensure production remains stable if no Telegram Ads credentials/session are configured.

- [ ] **Step 2: Document required env vars**

Document:

- feature flag
- polling intervals
- matching windows
- collector credential/session setup

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm --filter @novell-reader/server test
pnpm --filter @novell-reader/server typecheck
pnpm build
```

Expected: all pass.

- [ ] **Step 4: Deploy disabled**

Deploy with `TELEGRAM_ADS_ATTRIBUTION_ENABLED=false`.

Expected:

- bot still starts
- Mini App still works
- payments still work
- no collector interval starts

- [ ] **Step 5: Enable in a controlled window**

Enable attribution in production during active observation.

Expected:

- snapshots appear
- action deltas appear after Telegram Ads counter increases
- bot starts receive `UserAttribution`
- collector failures are logged and persisted but do not affect bot/API

- [ ] **Step 6: Tune windows after real data**

After 1-2 days:

- measure how many attributions are `likely`, `ambiguous`, `unknown`
- increase `afterWindowSeconds` if Ads updates lag
- decrease windows if ambiguity is too high

---

## Acceptance Criteria

- Every `/start` creates a `BotStartEvent`.
- Existing `AnalyticsEvent` behavior remains intact.
- Telegram Ads snapshots are saved regularly when attribution is enabled.
- Positive `actions` deltas are saved as `TelegramAdActionDelta`.
- New bot starts receive exactly one `UserAttribution`.
- Collisions are represented as `ambiguous`, not force-picked.
- Missing matches become `unknown` after the configured delay.
- Collector failures are persisted and logged.
- Collector/matcher failures do not crash the backend.
- Matcher and parser have unit tests.
- Server `test`, `typecheck`, and root `build` pass.

## Implementation Notes

Build the pipeline in this order:

1. Database models.
2. Structured `/start` storage.
3. Matcher on synthetic deltas.
4. Snapshot/delta repository.
5. Parser and collector.
6. Background intervals.
7. Analytics digest enrichment.
8. Production rollout.

The collector is the riskiest part because Telegram Ads does not provide a stable public source for this use case. Keep the rest of the attribution pipeline independent from the collector so it can be tested with synthetic data and survive changes in the Ads cabinet.
