from __future__ import annotations

import json
from datetime import datetime, timezone

import psycopg

from .apply import apply_trades
from .backup import backup_trades
from .config import Config
from .messages_review import build_messages_review
from .models import ChatMessage, ClosedTrade
from .openrouter import extract_trades_for_week
from .settings import append_run_log, finish_run, mark_running
from .telegram_fetch import build_client, ensure_session, fetch_messages
from .weeks import chunk_by_calendar_weeks


def _log(
    connection: psycopg.Connection,
    message: str,
    *,
    level: str = "info",
    stats: dict | None = None,
) -> None:
    append_run_log(connection, message, level=level, stats=stats)


async def run_sync_job(connection: psycopg.Connection, config: Config) -> None:
    settings = mark_running(connection)
    stats: dict = {
        "weeks": 0,
        "messages": 0,
        "trades": 0,
        "backupFile": "",
        "backupCount": 0,
        "inserted": 0,
        "weekIndex": 0,
        "phase": "start",
        "messagesUsed": 0,
        "messagesUnused": 0,
    }
    messages: list[ChatMessage] = []
    all_trades: list[ClosedTrade] = []
    review: dict | None = None
    run_dir = None

    try:
        _log(connection, "Старт синхронизации", stats=stats)

        if not settings.chat_id.strip():
            raise RuntimeError("Не задан chat_id в настройках tg-sync")

        rescan_all = bool(settings.rescan_all)
        parse_from = None if rescan_all else settings.parse_from
        if not rescan_all and parse_from is None:
            raise RuntimeError("Укажите parse_from или включите «пересмотреть весь чат»")

        topic_label = settings.topic_id if settings.topic_id is not None else "—"
        mode = "полный рескан" if rescan_all else f"с {parse_from.isoformat()}"
        _log(
            connection,
            f"Параметры: chat={settings.chat_id}, topic={topic_label}, режим={mode}, tz={settings.timezone}",
        )

        stats["phase"] = "backup"
        _log(connection, "Делаю бекап сделок…", stats=stats)
        backup_path, backup_count = backup_trades(
            connection,
            config.backups_dir,
            parse_from=parse_from,
            rescan_all=rescan_all,
        )
        stats["backupFile"] = backup_path.name
        stats["backupCount"] = backup_count
        _log(connection, f"Бекап готов: {backup_path.name} ({backup_count} сделок)", stats=stats)

        run_dir = config.work_dir / datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        run_dir.mkdir(parents=True, exist_ok=True)
        _log(connection, f"Рабочая папка прогона: {run_dir.name}")

        stats["phase"] = "telegram"
        _log(connection, "Подключаюсь к Telegram…", stats=stats)
        client = build_client(config)
        async with client:
            await ensure_session(client)
            _log(connection, "Сессия Telegram авторизована, читаю сообщения…")
            messages = await fetch_messages(
                client,
                settings.chat_id,
                min_datetime=parse_from,
                topic_id=settings.topic_id,
            )

        stats["messages"] = len(messages)
        _log(connection, f"Получено сообщений: {len(messages)}", stats=stats)

        weeks = chunk_by_calendar_weeks(messages, settings.timezone)
        stats["weeks"] = len(weeks)
        stats["phase"] = "llm"
        via = "через OPENROUTER_PROXY_URL" if config.openrouter_proxy_url else "напрямую"
        _log(
            connection,
            f"Нарезано недель: {len(weeks)}. Модель: {config.openrouter_model} ({via})",
            stats=stats,
        )

        for index, chunk in enumerate(weeks, start=1):
            stats["weekIndex"] = index
            _log(
                connection,
                f"Неделя {index}/{len(weeks)} ({chunk.key}): {len(chunk.messages)} сообщ. → OpenRouter",
                stats=stats,
            )
            trades = await extract_trades_for_week(
                api_key=config.openrouter_api_key,
                base_url=config.openrouter_base_url,
                model=config.openrouter_model,
                chunk=chunk,
                retries=config.llm_retries,
                proxy_url=config.openrouter_proxy_url,
            )
            week_file = run_dir / f"week-{chunk.key}.json"
            week_file.write_text(
                json.dumps([trade.as_db_row() for trade in trades], ensure_ascii=False, indent=2)
                + "\n",
                encoding="utf-8",
            )
            all_trades.extend(trades)
            _log(
                connection,
                f"Неделя {chunk.key}: извлечено сделок {len(trades)} (накоплено {len(all_trades)})",
                stats=stats,
            )

        unique: list[ClosedTrade] = []
        seen: set[tuple] = set()
        skipped_old = 0
        for trade in sorted(all_trades, key=lambda item: (item.datetime, item.ticker, item.roe)):
            if not rescan_all and parse_from is not None and trade.datetime < parse_from:
                skipped_old += 1
                continue
            key = (trade.datetime, trade.ticker, trade.roe)
            if key in seen:
                continue
            seen.add(key)
            unique.append(trade)

        review = build_messages_review(messages, unique)
        stats["messagesUsed"] = len(review["used"])
        stats["messagesUnused"] = len(review["unused"])
        review_path = run_dir / "messages-review.json"
        review_path.write_text(
            json.dumps(review, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        merged_path = run_dir / "merged-trades.json"
        merged_path.write_text(
            json.dumps([trade.as_db_row() for trade in unique], ensure_ascii=False, indent=2)
            + "\n",
            encoding="utf-8",
        )
        stats["trades"] = len(unique)
        if skipped_old:
            _log(connection, f"Отброшено вне окна parse_from: {skipped_old}")
        _log(
            connection,
            f"Уникальных сделок к загрузке: {len(unique)} "
            f"(сообщений взято {stats['messagesUsed']}, пропущено {stats['messagesUnused']})",
            stats=stats,
        )

        stats["phase"] = "apply"
        _log(connection, "Пишу сделки в БД (атомарно)…", stats=stats)
        inserted = apply_trades(
            connection,
            unique,
            parse_from=parse_from,
            rescan_all=rescan_all,
        )
        stats["inserted"] = inserted
        stats["phase"] = "done"

        _log(
            connection,
            f"Готово: вставлено {inserted}, бекап {backup_path.name}",
            level="success",
            stats=stats,
        )
        finish_run(
            connection,
            status="success",
            stats=stats,
            messages=review,
            clear_rescan_all=rescan_all,
        )
    except Exception as error:  # noqa: BLE001
        stats["phase"] = "error"
        if messages:
            review = build_messages_review(messages, all_trades)
            stats["messagesUsed"] = len(review["used"])
            stats["messagesUnused"] = len(review["unused"])
            if run_dir is not None:
                (run_dir / "messages-review.json").write_text(
                    json.dumps(review, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
        _log(connection, f"Ошибка: {error}", level="error", stats=stats)
        finish_run(
            connection,
            status="error",
            error=str(error),
            stats=stats,
            messages=review,
        )
        raise
