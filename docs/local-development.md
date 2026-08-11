# Локальная Разработка

## Переменные Окружения

Создай `.env` из `.env.example` и заполни:

- `BOT_TOKEN`: токен Telegram-бота.
- `MINI_APP_URL`: публичный URL Mini App.
- `SUPPORT_URL`: `https://t.me/esimsmile_support`.
- `ANALYTICS_CHANNEL_ID`: id Telegram-канала для логов.
- `STARS_ACCESS_PRICE`: цена доступа на 30 дней в Stars.
- `DATABASE_URL`: локально можно оставить `file:./dev.db`.
- `PUBLIC_BASE_URL`: публичный URL backend, если используются webhooks.
- `PORT`: порт backend, по умолчанию `3000`.
- `VITE_API_BASE_URL`: URL backend для Mini App, например `http://localhost:3000`.

## Telegram Bot

1. Создай бота через BotFather.
2. Вставь токен в `BOT_TOKEN`.
3. Создай Mini App/Web App для бота и укажи URL frontend-приложения.
4. Добавь бота администратором в закрытый канал аналитики.
5. Укажи id канала в `ANALYTICS_CHANNEL_ID`.

## Контент

1. Положи EPUB-файлы в `content/epub/`.
2. Запусти импорт:

```bash
pnpm import:epub
```

Импорт создает нормализованные книги, главы и обложки в `content/imported/` и БД. Служебные страницы вроде `Информация о книге` не считаются главами.

## Запуск

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
