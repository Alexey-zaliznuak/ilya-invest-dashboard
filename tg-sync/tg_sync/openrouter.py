from __future__ import annotations

import json
import re
from decimal import Decimal
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import ClosedTrade, WeekChunk

SYSTEM_PROMPT = """\
Ты извлекаешь закрытые сделки трейдера из переписки Telegram-чата.

Верни ТОЛЬКО валидный JSON-объект вида:
{"trades":[{"message_id":48553,"ticker":"BRN6","title":"Закрыл нефть по текущим","roe":0.206}]}

Правила:
- Только закрытые/зафиксированные сделки с известным ROE (в процентах, число).
- Не включай открытые позиции, планы, обсуждения без фиксации.
- message_id — id сообщения из метаданных строки (поле id=…). Именно по нему мы возьмём время из Telegram API; datetime сам не придумывай и не возвращай.
- Если одна фиксация описана несколькими сообщениями — укажи id сообщения, где зафиксированы закрытие и ROE.
- ticker без #.
- title — краткое описание события на русском.
- Если закрытых сделок нет — {"trades":[]}.
- Не добавляй markdown, комментарии и поля вне схемы.
"""


class ExtractedTrade(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message_id: int = Field(alias="message_id")
    ticker: str
    title: str = ""
    roe: Decimal

    @field_validator("message_id", mode="before")
    @classmethod
    def parse_message_id(cls, value: Any) -> int:
        message_id = int(value)
        if message_id < 1:
            raise ValueError("message_id должен быть ≥ 1")
        return message_id

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        ticker = value.strip().lstrip("#")
        if not ticker:
            raise ValueError("тикер пустой")
        if len(ticker) > 32:
            raise ValueError("тикер длиннее 32 символов")
        return ticker

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        return (value or "").strip()[:300]

    @field_validator("roe", mode="before")
    @classmethod
    def parse_roe(cls, value: Any) -> Decimal:
        if isinstance(value, str):
            value = value.replace(",", ".").strip()
        roe = Decimal(str(value)).quantize(Decimal("0.0001"))
        if roe < -100:
            raise ValueError("ROE < -100")
        return roe


def _extract_json(text: str) -> Any:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", cleaned)
        if not match:
            raise
        return json.loads(match.group(0))


def _parse_extracted_payload(payload: Any) -> list[ExtractedTrade]:
    if isinstance(payload, dict):
        items = payload.get("trades", payload.get("items"))
        if items is None and "message_id" in payload:
            items = [payload]
    elif isinstance(payload, list):
        items = payload
    else:
        raise ValueError("Ответ модели не JSON-объект/массив")

    if not isinstance(items, list):
        raise ValueError("Поле trades должно быть массивом")

    return [ExtractedTrade.model_validate(item) for item in items]


def resolve_trades(extracted: list[ExtractedTrade], chunk: WeekChunk) -> list[ClosedTrade]:
    by_id = {message.id: message for message in chunk.messages}
    resolved: list[ClosedTrade] = []
    for item in extracted:
        message = by_id.get(item.message_id)
        if message is None:
            raise ValueError(
                f"Модель вернула message_id={item.message_id}, которого нет в неделе {chunk.key}"
            )
        resolved.append(
            ClosedTrade(
                datetime=message.datetime,
                ticker=item.ticker,
                title=item.title,
                roe=item.roe,
                message_id=item.message_id,
            )
        )
    return resolved


def format_week_prompt(chunk: WeekChunk) -> str:
    lines = [
        f"Неделя: {chunk.week_start.isoformat()} — {chunk.week_end.isoformat()}",
        f"Сообщений: {len(chunk.messages)}",
        "Время в квадратных скобках — метка Telegram API (для ориентира). В ответе нужен только message_id.",
        "",
        "Сообщения:",
    ]
    for message in chunk.messages:
        edited = " [edited]" if message.edited else ""
        lines.append(
            f"id={message.id} time={message.datetime.isoformat()}{edited}\n{message.text}\n"
        )
    return "\n".join(lines)


async def extract_trades_for_week(
    *,
    api_key: str,
    base_url: str,
    model: str,
    chunk: WeekChunk,
    retries: int = 2,
) -> list[ClosedTrade]:
    if not api_key:
        raise RuntimeError("Не задан OPENROUTER_API_KEY")

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": format_week_prompt(chunk)},
        ],
        "reasoning": {"effort": "max"},
        "temperature": 0.1,
    }

    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=180.0) as client:
        for attempt in range(1, retries + 2):
            try:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://github.com/roe-capital/tg-sync",
                        "X-Title": "ROE Capital tg-sync",
                    },
                    json=body,
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                if not isinstance(content, str):
                    raise ValueError("Пустой content в ответе модели")
                extracted = _parse_extracted_payload(_extract_json(content))
                return resolve_trades(extracted, chunk)
            except Exception as error:  # noqa: BLE001 — ретраим любой сбой недели
                last_error = error
                print(f"OpenRouter week {chunk.key} attempt {attempt} failed: {error}")

    raise RuntimeError(f"Не удалось разобрать неделю {chunk.key}: {last_error}")
