from __future__ import annotations

from typing import Any

from .models import ChatMessage, ClosedTrade

TEXT_LIMIT = 1200


def _truncate(text: str) -> str:
    cleaned = (text or "").strip()
    if len(cleaned) <= TEXT_LIMIT:
        return cleaned
    return cleaned[: TEXT_LIMIT - 1] + "…"


def build_messages_review(
    messages: list[ChatMessage],
    trades: list[ClosedTrade],
) -> dict[str, list[dict[str, Any]]]:
    trades_by_message: dict[int, list[ClosedTrade]] = {}
    for trade in trades:
        if trade.message_id is None:
            continue
        trades_by_message.setdefault(trade.message_id, []).append(trade)

    used: list[dict[str, Any]] = []
    unused: list[dict[str, Any]] = []

    for message in messages:
        item: dict[str, Any] = {
            "id": message.id,
            "datetime": message.datetime.isoformat(),
            "text": _truncate(message.text),
            "edited": bool(message.edited),
        }
        linked = trades_by_message.get(message.id)
        if linked:
            item["trades"] = [
                {
                    "ticker": trade.ticker,
                    "title": trade.title,
                    "roe": float(trade.roe),
                }
                for trade in linked
            ]
            used.append(item)
        else:
            unused.append(item)

    return {"used": used, "unused": unused}
