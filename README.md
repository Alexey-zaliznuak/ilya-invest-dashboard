# ROE — прирост капитала

Дашборд последовательной капитализации сделок и админка для их правки. Сделки живут
в Postgres, дашборд считает кривую капитала по формуле `Kₙ = Kₙ₋₁ × (1 + ROEₙ / 100)`.
Порядок капитализации — по `trade_datetime`.

## Структура

```
db/schema.sql        схема trades + tg_sync_settings (идемпотентная)
api/                 Node + Express: чтение сделок, CRUD, настройки tg-sync
web/                 Vite: дашборд (/) и админка (/admin), в проде раздаёт nginx
seed/                Python-скрипт заливки исторических сделок
tg-sync/             Python: Telethon user-сессия + OpenRouter → сделки в БД
docker-compose.yml   postgres + api + nginx + tg-sync, плюс разовая задача seed
```

## Быстрый старт

```bash
cp .env.example .env      # поменяйте пароли, SESSION_SECRET, TG_* и OPENROUTER_*
docker compose up -d --build
docker compose run --rm seed
docker compose run --rm tg-sync auth   # один раз: телефон + код из Telegram
```

Дашборд — `http://localhost:8080`, админка — `http://localhost:8080/admin`.
Порт меняется переменной `WEB_PORT`.

## Переменные окружения

| Переменная | Зачем |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | доступ к базе |
| `DATABASE_URL` | строка подключения для API (в compose обычно `…@db:5432/…`) |
| `POSTGRES_PORT` | порт базы на хосте (по умолчанию 5432) |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | вход в админку |
| `SESSION_SECRET` | подпись токена сессии, `openssl rand -hex 32` |
| `SESSION_TTL_HOURS` | срок жизни токена, по умолчанию 12 |
| `WEB_PORT`, `API_PORT` | порт nginx на хосте и внутренний порт api |
| `TG_API_ID`, `TG_API_HASH` | Telegram user API (https://my.telegram.org) |
| `TELEGRAM_PROXY` | SOCKS5/HTTP прокси только для Telethon (обход блокировок DC) |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | разбор чата; default `openai/gpt-5.6-luna` |
| `OPENROUTER_PROXY_URL` | HTTP-прокси только для OpenRouter (если API режется) |

Подробнее про auth и volumes — [tg-sync/README.md](tg-sync/README.md).

## Сидирование сделок (опциональный бекап/импорт)

`seed` **не запускается** при `docker compose up` — только вручную через profile.
Нужен как разовая заливка/восстановление из JSON; источник истины дальше — tg-sync + админка.

```bash
docker compose run --rm seed
docker compose run --rm seed --dry-run --verbose
```

Формат записи в `seed/trades.json`:

```json
{
  "datetime": "2026-07-10T00:00:00+03:00",
  "ticker": "BRN6",
  "title": "Шорт нефти: 1-я цель",
  "roe": 0.114
}
```

## Автосбор из Telegram

Сервис `tg-sync` по cron (или кнопке в админке):

1. Бекапит сделки в volume `tg-backups`
2. Читает чат user-сессией Telethon (актуальный текст, в т.ч. после edit)
3. Режет историю по календарным неделям и кормит OpenRouter
4. Только после всех недель атомарно `DELETE` окна/`TRUNCATE` + `INSERT`

Настройки: `/admin` → «Автосбор из Telegram» (cron, chat id, топик, второй топик, дальность, «пересмотреть весь чат»).
Для одновременного чтения двух топиков одного чата укажите их ID в полях «Топик» и «Второй топик».
Истории читаются параллельно и объединяются по времени без повторов сообщений перед разбором сделок.
Если заполнено только одно поле, читается только этот топик; если оба пусты — весь чат.
Ошибка чтения любого топика прерывает запуск до изменения сделок в БД.
Существующие настройки одного топика сохраняются. Новое поле БД добавляется автоматически при старте обновлённого API.
Можно вставить t.me-ссылку на сообщение или выбрать чат из списка сессии.

## Локальная разработка

```bash
cd api && npm install && npm run dev     # нужен запущенный Postgres и .env в окружении
cd web && npm install && npm run dev     # http://localhost:5173, /api проксируется на :3000
```

Vite-сервер проксирует `/api` на `http://localhost:3000`; адрес меняется переменной
`API_PROXY_TARGET`. Проверка типов — `npm run typecheck` в `web`.

Проверки чтения топиков и валидации настроек:

```bash
node --test api/src/settings/validation.test.js
cd tg-sync
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
```

## API

| Метод | Путь | Доступ |
| --- | --- | --- |
| `GET` | `/api/health` | публично |
| `GET` | `/api/trades` | публично |
| `POST` | `/api/auth/login` | публично, не больше 10 неудачных попыток с адреса за 5 минут |
| `GET` | `/api/auth/session` | токен |
| `POST` | `/api/trades` | токен |
| `PUT` | `/api/trades/:id` | токен |
| `DELETE` | `/api/trades/:id` | токен |
| `GET`/`PUT` | `/api/settings/tg-sync` | токен |
| `POST` | `/api/settings/tg-sync/run` | токен |
| `GET` | `/api/settings/tg-sync/status` | токен |

Токен — HMAC-подписанная строка, админка держит его в `localStorage` и присылает
в заголовке `Authorization: Bearer …`. Повторная сделка возвращает `409`.

Расчёт иллюстративный: комиссии, налоги, проскальзывание, пополнения и выводы не учтены.
