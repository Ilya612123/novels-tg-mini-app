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

## Быстрый Старт

1. Скопировать `.env.example` в `.env`.
2. Заполнить `BOT_TOKEN`, `MINI_APP_URL`, `ANALYTICS_CHANNEL_ID`, `STARS_ACCESS_PRICE`.
3. Установить зависимости: `pnpm install`.
4. Сгенерировать Prisma Client: `pnpm --filter @novell-reader/server prisma:generate`.
5. Подготовить БД: `pnpm --filter @novell-reader/server prisma:migrate`.
6. Положить EPUB-файлы в `content/epub/`.
7. Импортировать книги: `pnpm import:epub`.
8. Запустить локальную разработку с Cloudflare tunnel: `pnpm dev`.

Команда `pnpm dev` поднимает backend, Mini App, Cloudflare HTTPS tunnel и настраивает Telegram webhook на публичный tunnel URL.

Для нее нужен установленный `cloudflared`.

## Проверки

```bash
pnpm typecheck
pnpm test
pnpm build
```

В этой среде server API-тесты через `supertest` требуют разрешения на локальный ephemeral listener.
