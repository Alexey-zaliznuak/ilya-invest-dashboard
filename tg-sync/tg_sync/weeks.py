from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from .models import ChatMessage, WeekChunk


def week_bounds(moment: datetime, tz: ZoneInfo) -> tuple[datetime, datetime]:
    local = moment.astimezone(tz)
    start_date = local.date() - timedelta(days=local.weekday())  # Monday
    start = datetime(start_date.year, start_date.month, start_date.day, tzinfo=tz)
    end = start + timedelta(days=7)
    return start, end


def chunk_by_calendar_weeks(messages: list[ChatMessage], timezone_name: str) -> list[WeekChunk]:
    if not messages:
        return []

    tz = ZoneInfo(timezone_name)
    buckets: dict[datetime, list[ChatMessage]] = defaultdict(list)

    for message in messages:
        start, _end = week_bounds(message.datetime, tz)
        buckets[start].append(message)

    chunks: list[WeekChunk] = []
    for start in sorted(buckets):
        messages_in_week = sorted(buckets[start], key=lambda item: (item.datetime, item.id))
        chunks.append(
            WeekChunk(
                week_start=start,
                week_end=start + timedelta(days=7),
                messages=messages_in_week,
            )
        )
    return chunks
