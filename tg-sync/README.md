# tg-sync

Отдельный контейнер: читает Telegram-чат через **user-сессию** Telethon, режет историю по календарным неделям, отдаёт в OpenRouter и атомарно перезаливает закрытые сделки в Postgres.

## Первичная авторизация Telegram

1. Получите `api_id` / `api_hash` на https://my.telegram.org
2. Пропишите в `.env`: `TG_API_ID`, `TG_API_HASH`, `OPENROUTER_API_KEY`
3. Если DC Telegram режутся (ТСПУ) — HTTP CONNECT к `telegram-proxy` (`setup.sh`, :3128).
   На реле ACL должен пускать не только `api.telegram.org`, но и CIDR DC на 443
   (см. `3proxy/3proxy.cfg.tmpl` в aheron/telegram-proxy).

```env
TELEGRAM_PROXY=http://tg-proxy:pass@telegram-proxy.messengers.aheron.pro:3128
```

4. Запустите интерактивный логин (один раз):

```bash
docker compose run --rm tg-sync auth
```

Введите телефон и код из Telegram. Session-файл останется в volume `tg-session`.

## Запуск

```bash
docker compose up -d tg-sync
```

Разовый прогон без демона:

```bash
docker compose run --rm tg-sync once
```

Настройки расписания, чата, топика и дальности парсинга — в админке (`/admin`).

Там же можно:
- вставить ссылку вида `https://t.me/c/…/topic/msg` → подставятся chat id и topic id;
- нажать **Показать чаты сессии** и выбрать диалог кликом.

Формат приватной супергруппы: `https://t.me/c/3935021784/5/48553` → chat `-1003935021784`, топик `5`.
