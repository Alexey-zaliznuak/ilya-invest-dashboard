from __future__ import annotations

import re
from typing import Any

# t.me/c/<internal>/<topic>/<msg> или t.me/c/<internal>/<msg>
PRIVATE_LINK = re.compile(
    r"(?:https?://)?(?:www\.)?(?:t\.me|telegram\.me)/c/(\d+)(?:/(\d+))?(?:/(\d+))?",
    re.IGNORECASE,
)
# t.me/<username>/<msg>
PUBLIC_LINK = re.compile(
    r"(?:https?://)?(?:www\.)?(?:t\.me|telegram\.me)/([A-Za-z][\w\d_]{3,})(?:/(\d+))?",
    re.IGNORECASE,
)


def parse_telegram_link(url: str) -> dict[str, Any]:
    text = (url or "").strip()
    if not text:
        raise ValueError("Пустая ссылка")

    private = PRIVATE_LINK.fullmatch(text) or PRIVATE_LINK.search(text)
    if private:
        internal = private.group(1)
        second = private.group(2)
        third = private.group(3)
        chat_id = f"-100{internal}"
        if third is not None:
            return {
                "chatId": chat_id,
                "topicId": int(second),
                "messageId": int(third),
                "kind": "private_topic",
            }
        if second is not None:
            return {
                "chatId": chat_id,
                "topicId": None,
                "messageId": int(second),
                "kind": "private",
            }
        return {
            "chatId": chat_id,
            "topicId": None,
            "messageId": None,
            "kind": "private",
        }

    public = PUBLIC_LINK.fullmatch(text) or PUBLIC_LINK.search(text)
    if public:
        username = public.group(1)
        if username.lower() in {"c", "s", "addstickers", "share", "proxy", "socks"}:
            raise ValueError("Не похоже на ссылку на чат/сообщение")
        message_id = int(public.group(2)) if public.group(2) else None
        return {
            "chatId": f"@{username}",
            "topicId": None,
            "messageId": message_id,
            "kind": "public",
        }

    raise ValueError("Не удалось разобрать ссылку Telegram")
