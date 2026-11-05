import asyncio
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock

from telethon.tl.custom.message import Message
from telethon.tl.types import PeerChannel

from tg_sync.telegram_fetch import fetch_messages


def message(id, text='trade', day=2):
    return Message(id=id, peer_id=PeerChannel(123), message=text,
                   date=datetime(2026, 1, day, tzinfo=timezone.utc))


class FakeClient:
    def __init__(self, streams, concurrent=False):
        self.streams = streams
        self.calls = []
        self.get_entity = AsyncMock(return_value='entity')
        self.concurrent = concurrent
        self.started = asyncio.Event()
        self.finished = []

    async def iter_messages(self, entity, **kwargs):
        topic = kwargs.get('reply_to')
        self.calls.append(kwargs)
        if len(self.calls) == len(self.streams):
            self.started.set()
        if self.concurrent:
            await asyncio.wait_for(self.started.wait(), timeout=1)
        for item in self.streams[topic]:
            if isinstance(item, Exception):
                raise item
            yield item
        self.finished.append(topic)


class FetchMessagesTests(unittest.IsolatedAsyncioTestCase):
    async def test_reads_both_concurrently_merges_sorts_and_filters(self):
        client = FakeClient({
            5: [message(1, day=1), message(4), message(6, '  ')],
            12: [message(3), message(4), message(8, day=3)],
        }, concurrent=True)
        result = await fetch_messages(client, '-100123', topic_id=5, second_topic_id=12,
                                      min_datetime=datetime(2026, 1, 2, tzinfo=timezone.utc))
        self.assertEqual([item.id for item in result], [3, 4, 8])
        self.assertEqual(client.calls, [{'reverse': True, 'reply_to': 5}, {'reverse': True, 'reply_to': 12}])
        client.get_entity.assert_awaited_once_with(-100123)

    async def test_single_duplicate_second_only_and_whole_chat(self):
        for first, second, expected in [(5, None, 5), (5, 5, 5), (None, 12, 12), (None, None, None)]:
            with self.subTest(first=first, second=second):
                client = FakeClient({expected: [message(3)]})
                result = await fetch_messages(client, '-100123', topic_id=first,
                                              second_topic_id=second, min_datetime=None)
                self.assertEqual([item.id for item in result], [3])
                self.assertEqual(len(client.calls), 1)
                self.assertEqual(client.calls[0].get('reply_to'), expected)

    async def test_failure_does_not_return_partial_history(self):
        client = FakeClient({5: [RuntimeError('topic unavailable')], 12: [message(8)]}, concurrent=True)
        with self.assertRaisesRegex(RuntimeError, 'topic unavailable'):
            await fetch_messages(client, '-100123', topic_id=5, second_topic_id=12, min_datetime=None)
        self.assertIn(12, client.finished)


if __name__ == '__main__':
    unittest.main()
