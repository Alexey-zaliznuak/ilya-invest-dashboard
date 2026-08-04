#!/usr/bin/env python3
"""Заливает исторические сделки в Postgres по указанному DATABASE_URL.

Скрипт идемпотентный: сделка с такой же тройкой «дата + тикер + ROE» второй раз
не вставится, поэтому запуск можно повторять сколько угодно раз.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import psycopg

ROOT = Path(__file__).resolve().parent
DEFAULT_DATA_FILE = ROOT / "trades.json"
DEFAULT_SCHEMA_FILE = ROOT.parent / "db" / "schema.sql"

# Масштаб колонки trades.roe: приводим значения заранее, иначе округление на
# стороне базы могло бы разойтись с проверкой дублей.
ROE_SCALE = Decimal("0.0001")

INSERT_SQL = """
    INSERT INTO trades (seq, ticker, title, roe, trade_date)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT DO NOTHING
"""


@dataclass(frozen=True)
class Trade:
    seq: int
    ticker: str
    title: str
    roe: Decimal
    trade_date: date | None

    @property
    def natural_key(self) -> tuple[date | None, str, Decimal]:
        return (self.trade_date, self.ticker, self.roe)

    def describe(self) -> str:
        when = self.trade_date.isoformat() if self.trade_date else "без даты"
        return f"#{self.seq} {self.ticker} ({when}) ROE {self.roe}%"


class SeedError(Exception):
    """Ошибка входных данных или подключения, о которой достаточно сообщить текстом."""


def parse_trade(payload: Any, position: int) -> Trade:
    if not isinstance(payload, dict):
        raise SeedError(f"Запись #{position}: ожидался объект, получено {type(payload).__name__}")

    ticker = str(payload.get("ticker", "")).strip().lstrip("#")
    if not ticker:
        raise SeedError(f"Запись #{position}: не указан тикер")

    try:
        roe = Decimal(str(payload["roe"])).quantize(ROE_SCALE)
    except (KeyError, InvalidOperation) as error:
        raise SeedError(f"Запись #{position}: некорректный ROE ({error})") from error

    raw_date = payload.get("date") or payload.get("tradeDate")
    trade_date: date | None = None
    if raw_date:
        try:
            trade_date = datetime.strptime(str(raw_date), "%Y-%m-%d").date()
        except ValueError as error:
            raise SeedError(f"Запись #{position}: дата должна быть в формате ГГГГ-ММ-ДД") from error

    return Trade(
        seq=int(payload.get("seq", position)),
        ticker=ticker,
        title=str(payload.get("title", "")).strip(),
        roe=roe,
        trade_date=trade_date,
    )


def load_trades(path: Path) -> list[Trade]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise SeedError(f"Файл с данными не найден: {path}") from error
    except json.JSONDecodeError as error:
        raise SeedError(f"{path} — некорректный JSON: {error}") from error

    if not isinstance(payload, list):
        raise SeedError(f"{path}: ожидался массив сделок")

    return [parse_trade(item, index) for index, item in enumerate(payload, start=1)]


def drop_internal_duplicates(trades: list[Trade]) -> tuple[list[Trade], list[Trade]]:
    """Отбрасывает совпадения по ключу внутри самого файла, оставляя первое вхождение."""
    seen: set[tuple[date | None, str, Decimal]] = set()
    unique: list[Trade] = []
    duplicates: list[Trade] = []

    for trade in trades:
        if trade.natural_key in seen:
            duplicates.append(trade)
        else:
            seen.add(trade.natural_key)
            unique.append(trade)

    return unique, duplicates


def connect(database_url: str, retries: int, delay: float) -> psycopg.Connection:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return psycopg.connect(database_url, autocommit=False)
        except psycopg.OperationalError as error:
            last_error = error
            if attempt < retries:
                print(f"База недоступна (попытка {attempt}/{retries}), жду {delay:g} с…")
                time.sleep(delay)
    raise SeedError(f"Не удалось подключиться к базе: {last_error}")


def apply_schema(connection: psycopg.Connection, schema_file: Path) -> None:
    try:
        sql = schema_file.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise SeedError(f"Файл схемы не найден: {schema_file}") from error
    connection.execute(sql)


def insert_trades(
    connection: psycopg.Connection, trades: list[Trade], verbose: bool
) -> tuple[int, list[Trade]]:
    inserted = 0
    skipped: list[Trade] = []

    with connection.cursor() as cursor:
        for trade in trades:
            cursor.execute(
                INSERT_SQL,
                (trade.seq, trade.ticker, trade.title, trade.roe, trade.trade_date),
            )
            if cursor.rowcount == 1:
                inserted += 1
                if verbose:
                    print(f"  + {trade.describe()}")
            else:
                skipped.append(trade)
                if verbose:
                    print(f"  = уже есть: {trade.describe()}")

    return inserted, skipped


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="строка подключения к Postgres (по умолчанию берётся из DATABASE_URL)",
    )
    parser.add_argument("--file", type=Path, default=DEFAULT_DATA_FILE, help="JSON со сделками")
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA_FILE, help="SQL-файл со схемой")
    parser.add_argument("--skip-schema", action="store_true", help="не применять схему перед вставкой")
    parser.add_argument("--dry-run", action="store_true", help="прогнать вставку и откатить транзакцию")
    parser.add_argument("--verbose", action="store_true", help="печатать каждую сделку")
    parser.add_argument("--connect-retries", type=int, default=10, help="сколько раз пробовать подключиться")
    parser.add_argument("--connect-delay", type=float, default=1.0, help="пауза между попытками, с")
    return parser.parse_args(argv)


def run(args: argparse.Namespace) -> None:
    if not args.database_url:
        raise SeedError("Не задан --database-url и переменная окружения DATABASE_URL пуста")

    trades = load_trades(args.file)
    unique, internal_duplicates = drop_internal_duplicates(trades)

    print(f"В файле {args.file}: {len(trades)} сделок, уникальных по ключу: {len(unique)}")
    for duplicate in internal_duplicates:
        print(f"  ! дубль внутри файла, пропускаю: {duplicate.describe()}")

    connection = connect(args.database_url, args.connect_retries, args.connect_delay)
    try:
        if not args.skip_schema:
            apply_schema(connection, args.schema)

        inserted, skipped = insert_trades(connection, unique, args.verbose)

        if args.dry_run:
            connection.rollback()
            print(f"Пробный прогон: вставилось бы {inserted}, уже есть в базе {len(skipped)}.")
            return

        connection.commit()
        total = connection.execute("SELECT count(*) FROM trades").fetchone()
        print(f"Вставлено: {inserted}, уже было в базе: {len(skipped)}")
        if total:
            print(f"Всего сделок в базе: {total[0]}")
    finally:
        connection.close()


def main() -> int:
    try:
        run(parse_args())
    except SeedError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 1
    except psycopg.Error as error:
        print(f"Ошибка базы: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
