import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from tg_sync import job


class JobTests(unittest.IsolatedAsyncioTestCase):
    async def test_topic_read_failure_leaves_trades_untouched(self):
        settings = SimpleNamespace(chat_id='-100123', topic_id=5, second_topic_id=12,
                                   rescan_all=True, parse_from=None, timezone='Europe/Moscow')
        with tempfile.TemporaryDirectory() as directory:
            config = SimpleNamespace(backups_dir=Path(directory), work_dir=Path(directory))
            fetch = AsyncMock(side_effect=RuntimeError('second topic unavailable'))
            apply = MagicMock()
            finish = MagicMock()
            with patch.multiple(job, mark_running=MagicMock(return_value=settings),
                                _log=MagicMock(), backup_trades=MagicMock(return_value=(Path('backup.json'), 10)),
                                build_client=MagicMock(return_value=MagicMock()), ensure_session=AsyncMock(),
                                fetch_messages=fetch, apply_trades=apply, finish_run=finish):
                with self.assertRaisesRegex(RuntimeError, 'second topic unavailable'):
                    await job.run_sync_job(MagicMock(), config)
            self.assertEqual(fetch.await_args.kwargs['topic_id'], 5)
            self.assertEqual(fetch.await_args.kwargs['second_topic_id'], 12)
            apply.assert_not_called()
            self.assertEqual(finish.call_args.kwargs['status'], 'error')
