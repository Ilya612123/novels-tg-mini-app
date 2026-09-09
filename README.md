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

## Запуск На Сервере Через Docker

1. Скопировать `.env.example` в `.env`.
2. Заполнить `BOT_TOKEN`, `PUBLIC_BASE_URL`, `ANALYTICS_USER_ID`, `STARS_ACCESS_PRICE`.
3. Убедиться, что `PUBLIC_BASE_URL` указывает на HTTPS-домен, который проксирует запросы на порт `3000` контейнера.
4. Запустить:

```bash
docker compose up -d --build
```

Контейнер сам:

- собирает backend и Mini App;
- применяет Prisma schema к SQLite БД;
- импортирует EPUB из `content/epub/` в `content/imported/`;
- запускает backend, Mini App static files и Telegram-бота в polling-режиме.

Данные SQLite хранятся в Docker volume `novell-reader-data`. Папка `content` монтируется с хоста, поэтому EPUB и импортированный контент остаются рядом с репозиторием после перезапусков.

Telegram Ads attribution запускается вместе с backend. Настройки интервалов и окон:
`TELEGRAM_ADS_COLLECT_INTERVAL_MS`, `TELEGRAM_ADS_MATCH_INTERVAL_MS`,
`TELEGRAM_ADS_MATCH_WINDOW_BEFORE_SECONDS`, `TELEGRAM_ADS_MATCH_WINDOW_AFTER_SECONDS`,
`TELEGRAM_ADS_UNKNOWN_AFTER_SECONDS`.

Collector MVP ходит на `https://ads.telegram.org/account` и использует auth из `TELEGRAM_ADS_COOKIE` или `TELEGRAM_ADS_REQUEST_HEADERS_JSON`. Он читает `initialAdsList.items` из HTML кабинета. Если URL или сессия недоступны, collector сохраняет failed snapshot и не останавливает backend.
При похожей на истекшую cookie ошибке backend один раз за failure streak отправляет уведомление в `ANALYTICS_USER_ID`.

Telegram Ads snapshots не удаляются: они нужны для связей с `TelegramAdMetric` и аналитики. Тяжелое поле `TelegramAdsSnapshot.rawPayload` хранится только для свежего debug. Backend при старте и далее раз в час зануляет `rawPayload` у successful snapshots старше 24 часов. Failed snapshots сохраняют `rawPayload` для диагностики.

Проверка:

```bash
docker compose ps
docker compose logs -f novell-reader
```

## Локальный Быстрый Старт

1. Скопировать `.env.example` в `.env`.
2. Заполнить `BOT_TOKEN`, `ANALYTICS_USER_ID`, `STARS_ACCESS_PRICE`.
3. Установить зависимости: `pnpm install`.
4. Сгенерировать Prisma Client: `pnpm --filter @novell-reader/server prisma:generate`.
5. Подготовить БД: `pnpm --filter @novell-reader/server prisma:migrate`.
6. Положить EPUB-файлы в `content/epub/`.
7. Импортировать книги: `pnpm import:epub`.
8. Запустить локальную разработку с Cloudflare tunnel: `pnpm dev`.

Команда `pnpm dev` поднимает backend, Mini App, Cloudflare HTTPS tunnel и запускает Telegram-бота в polling-режиме с кнопкой на публичный tunnel URL.

Для нее нужен установленный `cloudflared`.

## Проверки

```bash
pnpm typecheck
pnpm test
pnpm build
```

В этой среде server API-тесты через `supertest` требуют разрешения на локальный ephemeral listener.
