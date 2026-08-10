from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row


def connect(database_url: str, retries: int = 30, delay: float = 1.0) -> psycopg.Connection:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return psycopg.connect(database_url, row_factory=dict_row, autocommit=True)
        except psycopg.OperationalError as error:
            last_error = error
            if attempt < retries:
                print(f"База недоступна (попытка {attempt}/{retries}): {error}")
                time.sleep(delay)
    raise RuntimeError(f"Не удалось подключиться к базе: {last_error}")


@contextmanager
def transaction(connection: psycopg.Connection) -> Iterator[psycopg.Connection]:
    previous = connection.autocommit
    connection.autocommit = False
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.autocommit = previous
