from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import psycopg

from .db import transaction
from .models import ClosedTrade


def apply_trades(
    connection: psycopg.Connection,
    trades: list[ClosedTrade],
    *,
    parse_from: datetime | None,
    rescan_all: bool,
) -> int:
    with transaction(connection):
        if rescan_all:
            connection.execute("DELETE FROM trades")
        else:
            if parse_from is None:
                raise RuntimeError("parse_from обязателен, если rescan_all выключен")
            connection.execute("DELETE FROM trades WHERE trade_datetime >= %s", (parse_from,))

        inserted = 0
        for trade in trades:
            result = connection.execute(
                """
                INSERT INTO trades (ticker, title, roe, trade_datetime)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (trade.ticker, trade.title, Decimal(trade.roe), trade.datetime),
            )
            inserted += result.rowcount or 0
        return inserted
