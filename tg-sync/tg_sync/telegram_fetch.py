from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from telethon import TelegramClient
from telethon.tl.custom.dialog import Dialog
from telethon.tl.custom.message import Message
from telethon.tl.types import Channel, Chat, User

from .models import ChatMessage


def build_client(api_id: int, api_hash: str, session_path: Path) -> TelegramClient:
    session_path.parent.mkdir(parents=True, exist_ok=True)
    return TelegramClient(str(session_path), api_id, api_hash)


async def ensure_session(client: TelegramClient) -> None:
    await client.connect()
    if not await client.is_user_authorized():
        raise RuntimeError(
            "Telegram-сессия не авторизована. Запустите: docker compose run --rm tg-sync auth"
        )


async def interactive_auth(client: TelegramClient) -> None:
    await client.start()
    me = await client.get_me()
    print(f"Авторизовано как {me.username or me.id}")


def _resolve_chat_ref(chat_id: str) -> str | int:
    text = chat_id.strip()
    if text.lstrip("-").isdigit():
        return int(text)
    return text


def _message_text(message: Message) -> str:
    return (message.message or "").strip()


def _entity_kind(entity: Any) -> str:
    if isinstance(entity, User):
        return "user"
    if isinstance(entity, Chat):
        return "group"
    if isinstance(entity, Channel):
        if entity.megagroup:
            return "supergroup"
        if entity.broadcast:
            return "channel"
        return "channel"
    return "unknown"


async def list_dialogs(client: TelegramClient, *, limit: int = 200) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    async for dialog in client.iter_dialogs(limit=limit):
        if not isinstance(dialog, Dialog):
            continue
        entity = dialog.entity
        username = getattr(entity, "username", None)
        items.append(
            {
                "id": str(dialog.id),
                "title": dialog.name or username or str(dialog.id),
                "username": f"@{username}" if username else None,
                "kind": _entity_kind(entity),
                "unread": int(dialog.unread_count or 0),
            }
        )
    return items


async def fetch_messages(
    client: TelegramClient,
    chat_id: str,
    *,
    min_datetime: datetime | None,
    topic_id: int | None = None,
) -> list[ChatMessage]:
    entity = await client.get_entity(_resolve_chat_ref(chat_id))
    min_utc = min_datetime.astimezone(timezone.utc) if min_datetime else None
    collected: list[ChatMessage] = []

    kwargs: dict[str, Any] = {"reverse": True}
    if topic_id is not None:
        # В форум-супергруппах reply_to = id топика ограничивает ленту топиком.
        kwargs["reply_to"] = topic_id

    async for message in client.iter_messages(entity, **kwargs):
        if not isinstance(message, Message):
            continue
        if message.date is None:
            continue
        msg_dt = message.date if message.date.tzinfo else message.date.replace(tzinfo=timezone.utc)
        if min_utc is not None and msg_dt < min_utc:
            continue
        text = _message_text(message)
        if not text:
            continue
        collected.append(
            ChatMessage(
                id=int(message.id),
                datetime=msg_dt.astimezone(timezone.utc),
                text=text,
                edited=bool(getattr(message, "edit_date", None)),
            )
        )

    return collected
