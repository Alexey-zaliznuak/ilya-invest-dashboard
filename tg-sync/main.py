#!/usr/bin/env python3
"""Entrypoint контейнера tg-sync: auth | worker | once."""

from __future__ import annotations

import argparse
import asyncio
import sys

from tg_sync.config import describe_proxy, load_config
from tg_sync.db import connect
from tg_sync.http_api import serve_http
from tg_sync.job import run_sync_job
from tg_sync.scheduler import worker_loop
from tg_sync.telegram_fetch import build_client, interactive_auth


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Автосбор сделок из Telegram")
    parser.add_argument(
        "command",
        nargs="?",
        default="worker",
        choices=("worker", "auth", "once"),
        help="worker — демон по cron; auth — интерактивный логин; once — один прогон",
    )
    return parser.parse_args(argv)


async def cmd_auth() -> None:
    config = load_config()
    print(describe_proxy(config))
    client = build_client(config)
    async with client:
        await interactive_auth(client)
    print(f"Сессия сохранена: {config.session_path}")


async def cmd_once() -> None:
    config = load_config()
    print(describe_proxy(config))
    connection = connect(config.database_url)
    try:
        await run_sync_job(connection, config)
    finally:
        connection.close()


async def cmd_worker() -> None:
    config = load_config()
    print(describe_proxy(config))
    tg_lock = asyncio.Lock()
    await asyncio.gather(
        worker_loop(config, tg_lock),
        serve_http(config, tg_lock, config.http_host, config.http_port),
    )


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        if args.command == "auth":
            asyncio.run(cmd_auth())
        elif args.command == "once":
            asyncio.run(cmd_once())
        else:
            asyncio.run(cmd_worker())
    except KeyboardInterrupt:
        print("Остановлено")
        return 130
    except Exception as error:  # noqa: BLE001
        print(f"Ошибка: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
