from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import psycopg

MAX_LOG_ENTRIES = 400


@dataclass
class TgSyncSettings:
    enabled: bool
    cron: str
    chat_id: str
    topic_id: int | None
    second_topic_id: int | None
    parse_from: datetime | None
    timezone: str
    rescan_all: bool
    run_requested: bool
    last_run_at: datetime | None
    last_run_status: str
    last_run_error: str
    last_run_stats: dict[str, Any]


_SELECT = """
    SELECT enabled, cron, chat_id, topic_id, second_topic_id, parse_from, timezone, rescan_all,
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
               last_run_stats = '{}'::jsonb,
               last_run_log = '[]'::jsonb,
               last_run_messages = '{"used":[],"unused":[]}'::jsonb,
               last_run_at = now(),
               updated_at = now()
         WHERE id = 1
           AND last_run_status IS DISTINCT FROM 'running'
     RETURNING enabled, cron, chat_id, topic_id, second_topic_id, parse_from, timezone, rescan_all,
               run_requested, last_run_at, last_run_status, last_run_error, last_run_stats
        """
    ).fetchone()
    if row is None:
        raise RuntimeError("Не удалось стартовать job: уже running или строка настроек отсутствует")
    return _from_row(row)


def append_run_log(
    connection: psycopg.Connection,
    message: str,
    *,
    level: str = "info",
    stats: dict[str, Any] | None = None,
) -> None:
    entry = {
        "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "level": level,
        "message": message[:2000],
    }
    print(f"[{level}] {message}")

    connection.execute(
        """
        UPDATE tg_sync_settings
           SET last_run_log = COALESCE(last_run_log, '[]'::jsonb) || %s::jsonb,
               last_run_stats = COALESCE(%s::jsonb, last_run_stats),
               updated_at = now()
         WHERE id = 1
        """,
        (
            json.dumps([entry], ensure_ascii=False),
            json.dumps(stats, ensure_ascii=False) if stats is not None else None,
        ),
    )
    connection.execute(
        """
        UPDATE tg_sync_settings
           SET last_run_log = COALESCE((
                 SELECT jsonb_agg(value ORDER BY ordinality)
                   FROM jsonb_array_elements(last_run_log)
                        WITH ORDINALITY AS t(value, ordinality)
                  WHERE ordinality > jsonb_array_length(last_run_log) - %s
               ), '[]'::jsonb)
         WHERE id = 1
           AND jsonb_array_length(COALESCE(last_run_log, '[]'::jsonb)) > %s
        """,
        (MAX_LOG_ENTRIES, MAX_LOG_ENTRIES),
    )


def finish_run(
    connection: psycopg.Connection,
    *,
    status: str,
    error: str = "",
    stats: dict[str, Any] | None = None,
    messages: dict[str, Any] | None = None,
    clear_rescan_all: bool = False,
) -> None:
    payload = messages if messages is not None else {"used": [], "unused": []}
    connection.execute(
        """
        UPDATE tg_sync_settings
           SET last_run_status = %s,
               last_run_error = %s,
               last_run_stats = %s::jsonb,
               last_run_messages = %s::jsonb,
               rescan_all = CASE WHEN %s THEN false ELSE rescan_all END,
               updated_at = now()
         WHERE id = 1
        """,
        (
            status,
            error[:4000],
            json.dumps(stats or {}, ensure_ascii=False),
            json.dumps(payload, ensure_ascii=False),
            clear_rescan_all,
        ),
    )


def _from_row(row: dict[str, Any]) -> TgSyncSettings:
    stats = row["last_run_stats"] or {}
    if isinstance(stats, str):
        stats = json.loads(stats)
    topic = row.get("topic_id")
    second_topic = row.get("second_topic_id")
    return TgSyncSettings(
        enabled=bool(row["enabled"]),
        cron=str(row["cron"]),
        chat_id=str(row["chat_id"] or ""),
        topic_id=int(topic) if topic is not None else None,
        second_topic_id=int(second_topic) if second_topic is not None else None,
        parse_from=row["parse_from"],
        timezone=str(row["timezone"] or "Europe/Moscow"),
        rescan_all=bool(row["rescan_all"]),
        run_requested=bool(row["run_requested"]),
        last_run_at=row["last_run_at"],
        last_run_status=str(row["last_run_status"] or "idle"),
        last_run_error=str(row["last_run_error"] or ""),
        last_run_stats=dict(stats),
    )
