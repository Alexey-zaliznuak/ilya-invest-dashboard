from __future__ import annotations

import json
from datetime import datetime, timezone

import psycopg

from .apply import apply_trades
from .backup import backup_trades
from .config import Config
from .models import ClosedTrade
from .openrouter import extract_trades_for_week
from .settings import finish_run, mark_running
from .telegram_fetch import build_client, ensure_session, fetch_messages
from .weeks import chunk_by_calendar_weeks


async def run_sync_job(connection: psycopg.Connection, config: Config) -> None:
    settings = mark_running(connection)
    stats: dict = {
        "weeks": 0,
        "messages": 0,
        "trades": 0,
        "backupFile": "",
        "inserted": 0,
    }

    try:
        if not settings.chat_id.strip():
            raise RuntimeError("Не задан chat_id в настройках tg-sync")

        rescan_all = bool(settings.rescan_all)
        parse_from = None if rescan_all else settings.parse_from
        if not rescan_all and parse_from is None:
            raise RuntimeError("Укажите parse_from или включите «пересмотреть весь чат»")

        backup_path, backup_count = backup_trades(
            connection,
            config.backups_dir,
            parse_from=parse_from,
            rescan_all=rescan_all,
        )
        stats["backupFile"] = backup_path.name
        stats["backupCount"] = backup_count
        print(f"Бекап: {backup_path} ({backup_count} сделок)")

        run_dir = config.work_dir / datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        run_dir.mkdir(parents=True, exist_ok=True)

        client = build_client(config)
        async with client:
            await ensure_session(client)
            messages = await fetch_messages(
                client,
                settings.chat_id,
                min_datetime=parse_from,
                topic_id=settings.topic_id,
            )

        stats["messages"] = len(messages)
        print(f"Сообщений из TG: {len(messages)}")

        weeks = chunk_by_calendar_weeks(messages, settings.timezone)
        stats["weeks"] = len(weeks)
        all_trades: list[ClosedTrade] = []

        for index, chunk in enumerate(weeks, start=1):
            print(
                f"Неделя {index}/{len(weeks)} {chunk.key}: {len(chunk.messages)} сообщений → OpenRouter"
            )
            trades = await extract_trades_for_week(
                api_key=config.openrouter_api_key,
                base_url=config.openrouter_base_url,
                model=config.openrouter_model,
                chunk=chunk,
                retries=config.llm_retries,
            )
            week_file = run_dir / f"week-{chunk.key}.json"
            week_file.write_text(
                json.dumps([trade.as_db_row() for trade in trades], ensure_ascii=False, indent=2)
                + "\n",
                encoding="utf-8",
            )
            all_trades.extend(trades)

        # Дедуп внутри прогона по natural key; вне окна parse_from отбрасываем.
        unique: list[ClosedTrade] = []
        seen: set[tuple] = set()
        for trade in sorted(all_trades, key=lambda item: (item.datetime, item.ticker, item.roe)):
            if not rescan_all and parse_from is not None and trade.datetime < parse_from:
                continue
            key = (trade.datetime, trade.ticker, trade.roe)
            if key in seen:
                continue
            seen.add(key)
            unique.append(trade)

        merged_path = run_dir / "merged-trades.json"
        merged_path.write_text(
            json.dumps([trade.as_db_row() for trade in unique], ensure_ascii=False, indent=2)
            + "\n",
            encoding="utf-8",
        )
        stats["trades"] = len(unique)
        print(f"Собрано сделок: {len(unique)}. Пишем в БД…")

        inserted = apply_trades(
            connection,
            unique,
            parse_from=parse_from,
            rescan_all=rescan_all,
        )
        stats["inserted"] = inserted

        finish_run(
            connection,
            status="success",
            stats=stats,
            clear_rescan_all=rescan_all,
        )
        print(f"Готово: inserted={inserted}, backup={backup_path.name}")
    except Exception as error:  # noqa: BLE001
        finish_run(connection, status="error", error=str(error), stats=stats)
        print(f"Ошибка job: {error}")
        raise
