from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg


def backup_trades(
    connection: psycopg.Connection,
    backups_dir: Path,
    *,
    parse_from: datetime | None,
    rescan_all: bool,
) -> tuple[Path, int]:
    backups_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    path = backups_dir / f"trades-{stamp}.json"

    if rescan_all:
        rows = connection.execute(
            """
            SELECT ticker, title, roe,
                   CASE
                     WHEN trade_datetime IS NULL THEN NULL
                     ELSE to_char(trade_datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                   END AS datetime
              FROM trades
             ORDER BY trade_datetime NULLS FIRST, id
            """
        ).fetchall()
    else:
        if parse_from is None:
            raise RuntimeError("parse_from обязателен, если rescan_all выключен")
        rows = connection.execute(
            """
            SELECT ticker, title, roe,
                   CASE
                     WHEN trade_datetime IS NULL THEN NULL
                     ELSE to_char(trade_datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                   END AS datetime
              FROM trades
             WHERE trade_datetime >= %s
             ORDER BY trade_datetime NULLS FIRST, id
            """,
            (parse_from,),
        ).fetchall()

    payload: list[dict[str, Any]] = [
        {
            "datetime": row["datetime"],
            "ticker": row["ticker"],
            "title": row["title"],
            "roe": float(row["roe"]),
        }
        for row in rows
    ]
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path, len(payload)
