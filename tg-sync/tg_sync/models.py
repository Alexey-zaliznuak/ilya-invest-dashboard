from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator

MSK = ZoneInfo("Europe/Moscow")


class ClosedTrade(BaseModel):
    model_config = ConfigDict(extra="ignore")

    datetime: datetime
    ticker: str
    title: str = ""
    roe: Decimal
    message_id: int | None = None

    @field_validator("datetime", mode="before")
    @classmethod
    def parse_datetime(cls, value: Any) -> datetime:
        if isinstance(value, datetime):
            parsed = value
        else:
            text = str(value).strip().replace("Z", "+00:00")
            if len(text) == 10 and text[4] == "-" and text[7] == "-":
                text = f"{text}T00:00:00+03:00"
            parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=MSK)
        return parsed

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

    def as_db_row(self) -> dict[str, Any]:
        row = {
            "datetime": self.datetime.isoformat(),
            "ticker": self.ticker,
            "title": self.title,
            "roe": float(self.roe),
        }
        if self.message_id is not None:
            row["message_id"] = self.message_id
        return row


class ChatMessage(BaseModel):
    id: int
    datetime: datetime
    text: str
    edited: bool = False


class WeekChunk(BaseModel):
    week_start: datetime
    week_end: datetime
    messages: list[ChatMessage] = Field(default_factory=list)

    @property
    def key(self) -> str:
        return self.week_start.date().isoformat()
