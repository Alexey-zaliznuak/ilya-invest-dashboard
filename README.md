# ROE — прирост капитала

Дашборд последовательной капитализации сделок и админка для их правки. Сделки живут
в Postgres, дашборд считает кривую капитала по формуле `Kₙ = Kₙ₋₁ × (1 + ROEₙ / 100)`.

## Структура

```
db/schema.sql        схема таблицы trades (идемпотентная, одна на всех)
api/                 Node + Express: публичное чтение сделок, CRUD под токеном
web/                 Vite: дашборд (/) и админка (/admin), в проде раздаёт nginx
seed/                Python-скрипт заливки исторических сделок
docker-compose.yml   postgres + api + nginx, плюс разовая задача seed
```

## Быстрый старт

```bash
cp .env.example .env      # поменяйте пароли и SESSION_SECRET
docker compose up -d --build
docker compose run --rm seed
```

Дашборд — `http://localhost:8080`, админка — `http://localhost:8080/admin`.
Порт меняется переменной `WEB_PORT`.

## Переменные окружения

| Переменная | Зачем |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | доступ к базе; `DATABASE_URL` для api и seed compose собирает из них сам |
| `POSTGRES_PORT` | порт базы на хосте (по умолчанию 5432) |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | вход в админку |
| `SESSION_SECRET` | подпись токена сессии, `openssl rand -hex 32` |
| `SESSION_TTL_HOURS` | срок жизни токена, по умолчанию 12 |
| `WEB_PORT`, `API_PORT` | порт nginx на хосте и внутренний порт api |

## Сидирование сделок

Скрипт заливает `seed/trades.json` (95 исторических фиксаций) и повторных вставок не делает:
сделка уникальна по тройке **дата + тикер + ROE**, ограничение стоит в самой базе
(`trades_natural_key_idx`), поэтому дубли не пройдут ни через скрипт, ни через админку.

В контейнере:

```bash
docker compose run --rm seed
docker compose run --rm seed --dry-run --verbose   # прогон без записи
```

Локально, против любой базы:

```bash
pip install -r seed/requirements.txt
python seed/seed_trades.py --database-url postgresql://user:pass@localhost:5432/roe
```

Полезные флаги: `--file` (другой JSON), `--schema` (другой SQL), `--skip-schema`,
`--dry-run`, `--verbose`.

Формат записи в `trades.json` — `seq` задаёт порядок капитализации, `date` можно опустить:

```json
{ "seq": 1, "date": "2026-08-01", "ticker": "BRN6", "title": "1-я цель, шорт нефти", "roe": 0.114 }
```

## Локальная разработка

```bash
cd api && npm install && npm run dev     # нужен запущенный Postgres и .env в окружении
cd web && npm install && npm run dev     # http://localhost:5173, /api проксируется на :3000
```

Vite-сервер проксирует `/api` на `http://localhost:3000`; адрес меняется переменной
`API_PROXY_TARGET`. Проверка типов — `npm run typecheck` в `web`.

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

Токен — HMAC-подписанная строка, админка держит его в `localStorage` и присылает
в заголовке `Authorization: Bearer …`. Повторная сделка возвращает `409`.

Расчёт иллюстративный: комиссии, налоги, проскальзывание, пополнения и выводы не учтены.
