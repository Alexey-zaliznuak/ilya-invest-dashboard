from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import psycopg


@dataclass
class TgSyncSettings:
    enabled: bool
    cron: str
    chat_id: str
    topic_id: int | None
    parse_from: datetime | None
    timezone: str
    rescan_all: bool
    run_requested: bool
    last_run_at: datetime | None
    last_run_status: str
    last_run_error: str
    last_run_stats: dict[str, Any]


_SELECT = """
    SELECT enabled, cron, chat_id, topic_id, parse_from, timezone, rescan_all,
           run_requested, last_run_at, last_run_status, last_run_error, last_run_stats
      FROM tg_sync_settings
     WHERE id = 1
"""


def load_settings(connection: psycopg.Connection) -> TgSyncSettings:
    row = connection.execute(_SELECT).fetchone()
    if row is None:
        connection.execute("INSERT INTO tg_sync_settings (id) VALUES (1) ON CONFLICT DO NOTHING")
        return load_settings(connection)
    return _from_row(row)


def mark_running(connection: psycopg.Connection) -> TgSyncSettings:
    row = connection.execute(
        """
        UPDATE tg_sync_settings
           SET run_requested = false,
               last_run_status = 'running',
               last_run_error = '',
               last_run_at = now(),
               updated_at = now()
         WHERE id = 1
           AND last_run_status IS DISTINCT FROM 'running'
     RETURNING enabled, cron, chat_id, topic_id, parse_from, timezone, rescan_all,
               run_requested, last_run_at, last_run_status, last_run_error, last_run_stats
        """
    ).fetchone()
    if row is None:
        raise RuntimeError("Не удалось стартовать job: уже running или строка настроек отсутствует")
    return _from_row(row)


def finish_run(
    connection: psycopg.Connection,
    *,
    status: str,
    error: str = "",
    stats: dict[str, Any] | None = None,
    clear_rescan_all: bool = False,
) -> None:
    connection.execute(
        """
        UPDATE tg_sync_settings
           SET last_run_status = %s,
               last_run_error = %s,
               last_run_stats = %s::jsonb,
               rescan_all = CASE WHEN %s THEN false ELSE rescan_all END,
               updated_at = now()
         WHERE id = 1
        """,
        (status, error[:4000], json.dumps(stats or {}, ensure_ascii=False), clear_rescan_all),
    )


def _from_row(row: dict[str, Any]) -> TgSyncSettings:
    stats = row["last_run_stats"] or {}
    if isinstance(stats, str):
        stats = json.loads(stats)
    topic = row.get("topic_id")
    return TgSyncSettings(
        enabled=bool(row["enabled"]),
        cron=str(row["cron"]),
        chat_id=str(row["chat_id"] or ""),
        topic_id=int(topic) if topic is not None else None,
        parse_from=row["parse_from"],
        timezone=str(row["timezone"] or "Europe/Moscow"),
        rescan_all=bool(row["rescan_all"]),
        run_requested=bool(row["run_requested"]),
        last_run_at=row["last_run_at"],
        last_run_status=str(row["last_run_status"] or "idle"),
        last_run_error=str(row["last_run_error"] or ""),
        last_run_stats=dict(stats),
    )
