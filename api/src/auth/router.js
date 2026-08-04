import { Router } from 'express';

import { checkCredentials, issueToken, loginThrottle, requireAuth } from '../auth.js';
import { badRequest, HttpError } from '../errors.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const key = req.ip ?? 'unknown';
  if (loginThrottle.isBlocked(key)) {
    throw new HttpError(429, 'too_many_attempts', 'Слишком много попыток входа, подождите 5 минут');
  }

  const { login, password } = req.body ?? {};
  if (typeof login !== 'string' || typeof password !== 'string') {
    throw badRequest('Нужны поля login и password');
  }

  if (!checkCredentials(login, password)) {
    loginThrottle.registerFailure(key);
    throw new HttpError(401, 'invalid_credentials', 'Неверный логин или пароль');
  }

  loginThrottle.reset(key);
  const { token, expiresAt } = issueToken(login);
  res.json({ token, expiresAt, login });
});

authRouter.get('/session', requireAuth, (req, res) => {
  res.json({ login: req.admin.login, expiresAt: req.admin.expiresAt });
});
