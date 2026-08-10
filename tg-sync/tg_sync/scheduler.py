from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from croniter import croniter

from .config import Config
from .db import connect
from .job import run_sync_job
from .settings import load_settings


class CronGate:
    """Не даём одному и тому же cron-тику стартовать дважды в одном процессе."""

    def __init__(self) -> None:
        self._last_fire_key: str | None = None

    def due(self, cron: str, now: datetime, last_run_at: datetime | None) -> bool:
        if not cron.strip():
            return False
        base = now.astimezone(timezone.utc)
        iterator = croniter(cron, base)
        prev = iterator.get_prev(datetime).astimezone(timezone.utc)
        key = prev.strftime("%Y-%m-%dT%H:%M:%S")
        # Тик «сейчас», если предыдущая точка cron не старше ~2 минут.
        age = (base - prev).total_seconds()
        if age < 0 or age > 120:
            return False
        if last_run_at is not None and last_run_at.astimezone(timezone.utc) >= prev:
            return False
        if self._last_fire_key == key:
            return False
        self._last_fire_key = key
        return True


async def worker_loop(config: Config, tg_lock: asyncio.Lock | None = None) -> None:
    connection = connect(config.database_url)
    gate = CronGate()
    print(
        f"tg-sync worker стартовал (poll={config.poll_seconds}s, model={config.openrouter_model})"
    )

    try:
        while True:
            settings = load_settings(connection)
            now = datetime.now(timezone.utc)
            should_run = False
            reason = ""

            if settings.last_run_status == "running":
                # Защита от вечного running после крэша: если last_run_at старше 2ч — сбрасываем.
                if settings.last_run_at is not None:
                    age = (now - settings.last_run_at.astimezone(timezone.utc)).total_seconds()
                    if age > 2 * 3600:
                        from .settings import finish_run

                        finish_run(
                            connection,
                            status="error",
                            error="Job завис (running > 2ч), сброшен воркером",
                            stats=settings.last_run_stats,
                        )
                        print("Сброшен зависший running-статус")
            elif settings.run_requested:
                should_run = True
                reason = "manual"
            elif settings.enabled and gate.due(settings.cron, now, settings.last_run_at):
                should_run = True
                reason = "cron"

            if should_run:
                print(f"Старт sync ({reason})")
                try:
                    if tg_lock is None:
                        await run_sync_job(connection, config)
                    else:
                        async with tg_lock:
                            await run_sync_job(connection, config)
                except Exception as error:  # noqa: BLE001
                    print(f"Job завершился с ошибкой: {error}")

            await asyncio.sleep(config.poll_seconds)
    finally:
        connection.close()
