import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { HttpError } from '../errors.js';
import {
  getTgSyncMessages,
  getTgSyncSettings,
  requestTgSyncRun,
  updateTgSyncSettings,
} from './repository.js';
import { proxyTgSync } from './tgSyncProxy.js';
import { parseTelegramLink, parseTgSyncSettingsInput } from './validation.js';

export const settingsRouter = Router();

settingsRouter.get('/tg-sync', requireAuth, async (_req, res) => {
  res.json({ settings: await getTgSyncSettings() });
});

settingsRouter.put('/tg-sync', requireAuth, async (req, res) => {
  const settings = await updateTgSyncSettings(parseTgSyncSettingsInput(req.body));
  res.json({ settings });
});

settingsRouter.post('/tg-sync/run', requireAuth, async (_req, res) => {
  const settings = await requestTgSyncRun();
  res.json({ settings });
});

settingsRouter.get('/tg-sync/status', requireAuth, async (_req, res) => {
  const settings = await getTgSyncSettings();
  res.json({
    status: {
      runRequested: settings.runRequested,
      lastRunAt: settings.lastRunAt,
      lastRunStatus: settings.lastRunStatus,
      lastRunError: settings.lastRunError,
      lastRunStats: settings.lastRunStats,
      lastRunLog: settings.lastRunLog,
    },
  });
});

settingsRouter.get('/tg-sync/messages', requireAuth, async (_req, res) => {
  res.json({ messages: await getTgSyncMessages() });
});

settingsRouter.post('/tg-sync/resolve-link', requireAuth, async (req, res) => {
  const url = req.body?.url;
  res.json({ resolved: parseTelegramLink(url) });
});

settingsRouter.get('/tg-sync/dialogs', requireAuth, async (_req, res, next) => {
  try {
    const payload = await proxyTgSync('/dialogs');
    res.json(payload);
  } catch (error) {
    if (error.status) {
      next(new HttpError(error.status, error.code ?? 'tg_sync_error', error.message));
      return;
    }
    next(error);
  }
});
