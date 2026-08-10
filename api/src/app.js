import express from 'express';

import { authRouter } from './auth/router.js';
import { HttpError } from './errors.js';
import { pool } from './db.js';
import { settingsRouter } from './settings/router.js';
import { tradesRouter } from './trades/router.js';

export function createApp() {
  const app = express();
  // Приложение работает за nginx, поэтому доверяем X-Forwarded-For:
  // без этого троттлинг логина видел бы один и тот же IP прокси.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'db_unavailable' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/trades', tradesRouter);
  app.use('/api/settings', settingsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Такого эндпоинта нет' });
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.code, message: error.message });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: 'invalid_json', message: 'Тело запроса — не валидный JSON' });
      return;
    }
    console.error('Необработанная ошибка:', error);
    res.status(500).json({ error: 'internal_error', message: 'Внутренняя ошибка сервера' });
  });

  return app;
}
