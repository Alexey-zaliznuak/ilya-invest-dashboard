from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Не задана обязательная переменная окружения {name}")
    return value


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
    poll_seconds: float
    llm_retries: int
    http_host: str
    http_port: int


def load_config() -> Config:
    session_path = Path(os.environ.get("TG_SESSION_PATH", "/data/session/roe")).expanduser()
    backups_dir = Path(os.environ.get("TG_BACKUPS_DIR", "/data/backups")).expanduser()
    work_dir = Path(os.environ.get("TG_WORK_DIR", "/data/work")).expanduser()

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
        poll_seconds=float(os.environ.get("TG_SYNC_POLL_SECONDS", "20")),
        llm_retries=int(os.environ.get("TG_SYNC_LLM_RETRIES", "2")),
        http_host=os.environ.get("TG_SYNC_HTTP_HOST", "0.0.0.0").strip() or "0.0.0.0",
        http_port=int(os.environ.get("TG_SYNC_HTTP_PORT", "3010")),
    )
