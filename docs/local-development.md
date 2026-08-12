# Локальная Разработка

## Переменные Окружения

Создай `.env` из `.env.example` и заполни:

- `BOT_TOKEN`: токен Telegram-бота.
- `ANALYTICS_USER_ID`: твой Telegram user id. Основной бот будет слать аналитику тебе в личку.
- `STARS_ACCESS_PRICE`: цена доступа на 30 дней в Stars.

Остальное имеет дефолты:

- `PUBLIC_BASE_URL`: публичный URL сервера. Если задан, Mini App URL берется из него.
- `MINI_APP_URL`: нужен только если Mini App живет не на домене сервера.
- `SUPPORT_URL`: по умолчанию `https://t.me/esimsmile_support`.
- `DATABASE_URL`: по умолчанию SQLite `file:./dev.db`.
- `PORT`: по умолчанию `3000`.

## Telegram Bot

1. Создай бота через BotFather.
2. Вставь токен в `BOT_TOKEN`.
3. Создай Mini App/Web App для бота и укажи URL frontend-приложения.
4. Открой бота в Telegram и нажми `/start`, иначе Telegram не даст боту писать тебе первым.
5. Укажи свой Telegram user id в `ANALYTICS_USER_ID`.

## Контент

1. Положи EPUB-файлы в `content/epub/`.
2. Запусти импорт:

```bash
pnpm import:epub
```

Импорт создает нормализованные книги, главы и обложки в `content/imported/` и БД. Служебные страницы вроде `Информация о книге` не считаются главами.

## Запуск Через `pnpm dev`

Для разработки в Telegram используй:

```bash
pnpm dev
```

Эта команда:

- запускает backend на `http://localhost:3000`;
- запускает Mini App на `http://localhost:5173`;
- запускает `cloudflared tunnel --url http://localhost:5173`;
- ждет публичный `https://*.trycloudflare.com` URL;
- вызывает локальный endpoint `/dev/setup-webhook`;
- настраивает Telegram webhook на `https://*.trycloudflare.com/telegram/webhook`;
- обновляет runtime `MINI_APP_URL`, чтобы кнопка `Книги` в `/start` открывала tunnel URL.

Vite проксирует `/api`, `/content` и `/telegram` на backend, поэтому один Cloudflare URL работает и для Mini App, и для webhook.

Для запуска нужен установленный `cloudflared`.

## Ручной Запуск

```bash
pnpm --filter @novell-reader/server prisma:generate
pnpm --filter @novell-reader/server prisma:migrate
pnpm dev:server
pnpm dev:miniapp
```

Для локального API без Telegram init data можно передавать dev-заголовки:

- `x-dev-telegram-user-id`
- `x-dev-telegram-username`

В production этот dev-путь не используется.

## Проверка MVP

```text
[ ] /start отправляет сообщение с кнопками Книги и Поддержка
[ ] /start создает событие аналитики старт бота
[ ] Поддержка открывает https://t.me/esimsmile_support
[ ] EPUB sample импортируется как 51 глава и free limit 17
[ ] Каталог показывает импортированную книгу с обложкой
[ ] Читалка открывает бесплатную главу
[ ] Глава 18 для книги из 51 главы показывает paywall без доступа
[ ] Успешная оплата продлевает доступ на 30 дней
[ ] Профиль показывает начатые новеллы
[ ] Канал аналитики получает сгруппированный минутный лог
```

## Telegram Stars

MVP использует покупку доступа на 30 дней, не автопродление. После успешного платежа backend продлевает `subscriptionUntil`. Если доступ еще активен, новая покупка добавляет 30 дней к текущей дате окончания.

Перед реальным запуском нужно проверить платежный сценарий на актуальной версии Telegram Bot API и в Telegram-клиенте, потому что Stars-платежи завязаны на поведение платформы.
