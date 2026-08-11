# Novell Reader Telegram Bot + Mini App MVP Design

## Goal

Build a Telegram bot and Telegram Mini App for reading serialized novels. The target audience is women 30+. The first release should validate the core loop: open bot, enter catalog, start a novel, read free chapters, hit paywall, buy 30-day access with Telegram Stars, continue reading, and see reading progress in profile.

The MVP intentionally avoids an admin panel. Novels are uploaded into the project as EPUB files and imported into normalized application data.

## MVP Scope

Included:

- Telegram bot with `/start`.
- Bot welcome message with two buttons: `Книги` and `Поддержка`.
- `Книги` opens the Telegram Mini App.
- `Поддержка` links to `https://t.me/esimsmile_support`.
- Catalog of about 20 novels loaded from EPUB files.
- EPUB import into normalized book, cover, chapter, and metadata records.
- Novel detail screen with cover, title, description, chapter count, and reading action.
- Chapter-based reader.
- Automatic reading progress saving.
- Profile screen with started novels, progress, and access status.
- Paywall after the first third of chapters.
- 30-day access purchase through Telegram Stars.
- Analytics logs sent to a Telegram channel in one-minute batches.

Not included in MVP:

- Admin panel.
- In-app book upload UI.
- Recommendations or personalization.
- Comments, likes, ratings, or reviews.
- Full-text search inside novels.
- Auto-renewing subscription.
- Push campaigns, CRM flows, or marketing automation.

## Product Flow

1. User sends `/start` to the bot.
2. Bot sends a short welcome message with `Книги` and `Поддержка`.
3. User taps `Книги`.
4. Telegram Mini App opens on the catalog screen.
5. User selects a novel.
6. User sees the novel detail screen: cover, title, description, chapter count, and `Читать`.
7. User starts reading a chapter.
8. The app saves progress automatically: book, chapter, position inside chapter, and last activity time.
9. The first third of chapters is free.
10. When user tries to open a chapter after the free limit, the app shows paywall.
11. User buys 30-day access with Telegram Stars.
12. After payment confirmation, the app returns user to the locked chapter.
13. Profile shows started novels and allows continuing reading.

## Mini App Screens

### Catalog

Shows novels as a list or grid with covers. Each item should show at minimum:

- cover;
- title;
- short metadata line;
- reading progress if the user has started the novel.

The catalog is the Mini App home screen.

### Novel Detail

Shows:

- large cover;
- title;
- description;
- chapter count;
- current progress if started;
- primary action: `Читать` or `Продолжить`.

### Reader

Shows one chapter at a time.

Required behavior:

- render readable chapter text;
- save current book, chapter, and position;
- allow moving to next and previous chapter;
- keep navigation clear and predictable;
- restore the last saved position when user returns.

### Profile

Shows:

- started novels;
- current chapter/progress per novel;
- `Продолжить` action for each started novel;
- access status.

Access status text:

- active: `Доступ активен до DD.MM.YYYY`;
- inactive: `Доступ не активен`;
- near expiration: show an option to extend access.

### Paywall

Appears when user opens a chapter beyond the free limit without active access.

Paywall should:

- explain that the free part is over;
- show 30-day access terms;
- show price in Telegram Stars;
- provide a primary action to buy access;
- keep user on the paywall if payment is canceled or fails;
- return user to the requested chapter after successful payment.

Suggested copy:

`Бесплатная часть закончилась. Откройте доступ на 30 дней, чтобы продолжить чтение.`

### Error And Empty States

Handle:

- no imported books;
- book not found;
- chapter not found;
- payment canceled;
- payment verification failed;
- backend unavailable.

Errors should be short and human-readable.

## Visual And Tone Direction

Target audience: women 30+.

Visual direction: cozy library.

Principles:

- calm, mature interface;
- covers are the main visual element in catalog;
- large readable typography in reader;
- warm but not childish colors;
- minimal decorative noise;
- no teen slang;
- no aggressive paywall pressure;
- reading comfort matters more than visual effects.

Bot and Mini App copy should be short, direct, and friendly.

## EPUB Content Model

Source EPUB files live in a project folder such as `content/epub/`.

The import command should:

- read every `.epub`;
- extract title, author, language, and cover;
- read `content.opf` and `toc.ncx` when available;
- determine chapter order from the EPUB spine;
- exclude service pages such as `Информация о книге` when they are not actual chapters;
- convert XHTML chapters to safe HTML or sanitized text for rendering in Mini App;
- save covers as app assets;
- create normalized book and chapter data.

Normalized book fields:

- `id`;
- `title`;
- `author`;
- `description`;
- `coverPath`;
- `chapterCount`;
- `freeChapterLimit`;
- `sourceEpubFile`;
- `status`: `published` or `draft`.

Normalized chapter fields:

- `id`;
- `bookId`;
- `number`;
- `title`;
- `contentPath` or `htmlContent`;
- `wordCount` if practical.

Example EPUB observed during planning:

- source file: `Компенсация за первую любовь.epub`;
- title: `компенсация за первую любовь`;
- chapter files: 51 actual chapters;
- extra page: `Информация о книге`, should not count as a chapter;
- `Глава 51. Экстра` should count as a normal chapter;
- free chapter limit: `ceil(51 / 3) = 17`.

The application should read normalized data after import, not parse EPUB files at runtime.

## Progress Model

Progress is saved per Telegram user and book.

Required progress fields:

- Telegram user id;
- username when available;
- book id;
- current chapter number;
- position inside chapter;
- percent if practical;
- started at;
- updated at.

Progress updates should be debounced to avoid excessive backend writes while reading.

Profile uses progress records to show started novels.

## Access And Paywall Rules

Free access:

- each novel allows reading the first third of chapters;
- default formula: `ceil(totalChapters / 3)`;
- if a book has manual `freeChapterLimit`, use it instead.

Paid access:

- access lasts 30 days;
- purchase is made with Telegram Stars;
- this is not an auto-renewing subscription.

After successful payment:

- if user has no active access, set `subscriptionUntil = now + 30 days`;
- if user already has active access, extend from current `subscriptionUntil`;
- unlock all paid chapters for all novels during active access.

If payment is canceled or not confirmed, paid chapters remain locked.

## Telegram Stars Payment Flow

1. User reaches paywall.
2. User taps buy button.
3. Backend creates a Telegram Stars invoice.
4. User completes payment in Telegram.
5. Bot/backend receives successful payment update.
6. Backend verifies and records payment.
7. Backend updates user access period.
8. Mini App refreshes access state.
9. User is returned to the chapter they attempted to open.

Payment records should include:

- Telegram user id;
- invoice id or provider payload;
- Stars amount;
- status;
- created at;
- paid at;
- raw Telegram payment payload for debugging when appropriate.

## Analytics Logs

Analytics events are sent to backend. Backend groups events by user and sends one message per minute to a configured Telegram channel.

Required events:

- `старт бота`;
- opened Mini App;
- opened catalog;
- opened profile;
- opened novel detail;
- started reading chapter;
- moved to next chapter;
- moved to previous chapter;
- hit paywall;
- tapped payment button;
- payment successful;
- payment canceled or failed;
- continued reading from profile.

Message format:

```text
Логи за 12:21-12:22

user 5100586818 @barboruss
  12:21:03 старт бота
  12:21:11 открыл Mini App
  12:21:12 открыл Каталог
  12:21:24 начал читать Главу 1
  активность в mini app: 13 сек
```

Rules:

- group by user;
- sort events by time within each user group;
- show Telegram id and username when available;
- if username is missing, show only Telegram id;
- calculate Mini App activity as the difference between first and last Mini App event in the batch window;
- do not send a log message when there are no events;
- log channel id is configured through an environment variable.

## Configuration

Expected environment variables:

- `BOT_TOKEN`: Telegram bot token.
- `MINI_APP_URL`: public URL of the Telegram Mini App.
- `SUPPORT_URL`: `https://t.me/esimsmile_support`.
- `ANALYTICS_CHANNEL_ID`: Telegram channel id for analytics logs.
- `STARS_ACCESS_PRICE`: price of 30-day access in Telegram Stars.
- `DATABASE_URL`: database connection string.
- `PUBLIC_BASE_URL`: public backend base URL for webhooks if webhooks are used.

These variables should be documented in `.env.example`.

## Recommended Implementation Stack

The implementation plan should use one cohesive TypeScript stack unless the user explicitly changes the stack:

- Telegram bot: Node.js with TypeScript and a mature Telegram bot framework such as grammY.
- Mini App frontend: React + Vite + TypeScript.
- Backend API: Node.js + TypeScript, either inside the bot service or as a small separate HTTP service.
- Database: SQLite for local development, PostgreSQL-ready schema for deployment.
- ORM/query layer: Prisma or another typed database layer.
- EPUB import: a server-side import script that reads `content/epub/` and writes normalized records/assets.

This stack keeps the bot, Mini App, import tooling, and shared types in one language for the MVP.

## Data Storage

MVP needs persistent storage for:

- Telegram users;
- normalized books and chapters;
- reading progress;
- access periods;
- payments;
- analytics events before they are flushed to Telegram.

SQLite is acceptable for local development. The schema should avoid SQLite-only assumptions so it can move to PostgreSQL when deployed.

## Implementation Boundaries

The first implementation should optimize for a working, inspectable MVP:

- no admin panel;
- no custom recommendation engine;
- no complex analytics dashboard;
- no auto-renewal;
- no manual content editing UI;
- no external analytics service dependency.

Future phases can add:

- admin upload and import UI;
- moderation/quality checks for imported books;
- categories and genre filters;
- search;
- recommendations;
- reader settings;
- reminders and lifecycle messages;
- retention analytics dashboard.

## Acceptance Criteria

The MVP is ready when:

- `/start` works and logs `старт бота`;
- bot shows `Книги` and `Поддержка`;
- `Поддержка` opens `https://t.me/esimsmile_support`;
- `Книги` opens Mini App;
- about 20 EPUB files can be imported;
- imported books appear in catalog with covers;
- user can open a novel and read free chapters;
- reading progress is saved and visible in profile;
- paywall appears after the first third of chapters;
- Telegram Stars payment unlocks 30-day access;
- active access unlocks paid chapters;
- expired/no access locks paid chapters again;
- analytics logs are sent to Telegram channel in one-minute batches.
