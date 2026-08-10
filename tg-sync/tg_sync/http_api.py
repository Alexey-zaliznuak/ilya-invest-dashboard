from __future__ import annotations

import asyncio
import json
from typing import Any

from aiohttp import web

from .config import Config
from .link_parse import parse_telegram_link
from .telegram_fetch import build_client, ensure_session, list_dialogs


def create_app(config: Config, tg_lock: asyncio.Lock) -> web.Application:
    app = web.Application()

    async def health(_request: web.Request) -> web.Response:
        return web.json_response({"status": "ok"})

    async def dialogs(_request: web.Request) -> web.Response:
        try:
            async with tg_lock:
                client = build_client(config.tg_api_id, config.tg_api_hash, config.session_path)
                async with client:
                    await ensure_session(client)
                    items = await list_dialogs(client)
            return web.json_response({"dialogs": items})
        except Exception as error:  # noqa: BLE001
            return web.json_response(
                {"error": "tg_error", "message": str(error)},
                status=503,
            )

    async def resolve_link(request: web.Request) -> web.Response:
        try:
            body: dict[str, Any] = await request.json()
        except Exception:  # noqa: BLE001
            return web.json_response(
                {"error": "invalid_json", "message": "Ожидается JSON с полем url"},
                status=400,
            )
        url = body.get("url", "")
        try:
            parsed = parse_telegram_link(str(url))
        except ValueError as error:
            return web.json_response(
                {"error": "bad_link", "message": str(error)},
                status=400,
            )
        return web.json_response({"resolved": parsed})

    app.router.add_get("/health", health)
    app.router.add_get("/dialogs", dialogs)
    app.router.add_post("/resolve-link", resolve_link)
    return app


async def serve_http(config: Config, tg_lock: asyncio.Lock, host: str, port: int) -> None:
    app = create_app(config, tg_lock)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host=host, port=port)
    await site.start()
    print(f"tg-sync HTTP API на http://{host}:{port}")
    try:
        await asyncio.Future()
    finally:
        await runner.cleanup()
