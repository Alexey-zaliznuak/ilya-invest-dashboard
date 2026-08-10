from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .proxy import parse_telegram_proxy_url, proxy_log_label


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Не задана обязательная переменная окружения {name}")
    return value


def _proxy_from_env() -> tuple[str, dict[str, Any] | None]:
    """TELEGRAM_PROXY → TG_PROXY → TELEGRAM_HTTP_PROXY (как в aheron messengers)."""
    for name in ("TELEGRAM_PROXY", "TG_PROXY", "TELEGRAM_HTTP_PROXY"):
        raw = os.environ.get(name, "").strip()
        if not raw:
            continue
        try:
            return name, parse_telegram_proxy_url(raw)
        except ValueError as error:
            raise RuntimeError(f"{name}: {error}") from error
    return "", None


@dataclass(frozen=True)
class Config:
    database_url: str
    tg_api_id: int
    tg_api_hash: str
    session_path: Path
    backups_dir: Path
    work_dir: Path
    openrouter_api_key: str
    openrouter_model: str
    openrouter_base_url: str
    openrouter_proxy_url: str
    poll_seconds: float
    llm_retries: int
    http_host: str
    http_port: int
    telegram_proxy: dict[str, Any] | None
    telegram_proxy_env: str


def load_config() -> Config:
    session_path = Path(os.environ.get("TG_SESSION_PATH", "/data/session/roe")).expanduser()
    backups_dir = Path(os.environ.get("TG_BACKUPS_DIR", "/data/backups")).expanduser()
    work_dir = Path(os.environ.get("TG_WORK_DIR", "/data/work")).expanduser()
    proxy_env, proxy = _proxy_from_env()

    return Config(
        database_url=_required("DATABASE_URL"),
        tg_api_id=int(_required("TG_API_ID")),
        tg_api_hash=_required("TG_API_HASH"),
        session_path=session_path,
        backups_dir=backups_dir,
        work_dir=work_dir,
        openrouter_api_key=os.environ.get("OPENROUTER_API_KEY", "").strip(),
        openrouter_model=os.environ.get("OPENROUTER_MODEL", "openai/gpt-5.6-luna").strip(),
        openrouter_base_url=os.environ.get(
            "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
        ).rstrip("/"),
        openrouter_proxy_url=os.environ.get("OPENROUTER_PROXY_URL", "").strip(),
        poll_seconds=float(os.environ.get("TG_SYNC_POLL_SECONDS", "20")),
        llm_retries=int(os.environ.get("TG_SYNC_LLM_RETRIES", "2")),
        http_host=os.environ.get("TG_SYNC_HTTP_HOST", "0.0.0.0").strip() or "0.0.0.0",
        http_port=int(os.environ.get("TG_SYNC_HTTP_PORT", "3010")),
        telegram_proxy=proxy,
        telegram_proxy_env=proxy_env,
    )


def describe_proxy(config: Config) -> str:
    lines: list[str] = []
    if config.telegram_proxy:
        lines.append(
            f"Telegram: трафик через {proxy_log_label(config.telegram_proxy)} "
            f"(из {config.telegram_proxy_env})"
        )
    else:
        lines.append("Telegram: прямое подключение (прокси не задан)")

    if config.openrouter_proxy_url:
        # Без логина/пароля в логах.
        from urllib.parse import urlparse

        parsed = urlparse(config.openrouter_proxy_url)
        host = parsed.hostname or "?"
        port = f":{parsed.port}" if parsed.port else ""
        lines.append(f"OpenRouter: HTTP-прокси {parsed.scheme or 'http'}://{host}{port}")
    else:
        lines.append("OpenRouter: прямое подключение (OPENROUTER_PROXY_URL не задан)")
    return "\n".join(lines)
