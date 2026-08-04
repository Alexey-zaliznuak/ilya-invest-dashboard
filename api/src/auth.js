import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

import { config } from './config.js';

const base64url = (input) => Buffer.from(input).toString('base64url');

const sign = (payload) =>
  createHmac('sha256', config.session.secret).update(payload).digest('base64url');

/** Сравнение постоянного времени: хэшируем, чтобы длины всегда совпадали. */
const safeEqual = (a, b) => {
  const digest = (value) => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(digest(a), digest(b));
};

export function issueToken(login) {
  const expiresAt = Date.now() + config.session.ttlMs;
  const payload = base64url(JSON.stringify({ sub: login, exp: expiresAt }));
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  if (!safeEqual(signature, sign(payload))) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof claims.exp !== 'number' || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export function checkCredentials(login, password) {
  if (typeof login !== 'string' || typeof password !== 'string') return false;
  // Оба сравнения выполняются всегда, чтобы время ответа не зависело от того,
  // какое из полей неверное.
  const loginOk = safeEqual(login, config.admin.login);
  const passwordOk = safeEqual(password, config.admin.password);
  return loginOk && passwordOk;
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const claims = header.toLowerCase().startsWith('bearer ')
    ? verifyToken(header.slice(7).trim())
    : null;

  if (!claims) {
    res.status(401).json({ error: 'unauthorized', message: 'Нужна авторизация' });
    return;
  }

  req.admin = { login: claims.sub, expiresAt: claims.exp };
  next();
}

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 5 * 60 * 1000;
const attempts = new Map();

/** Примитивный анти-брутфорс: не больше 10 неудачных попыток с адреса за 5 минут. */
export const loginThrottle = {
  isBlocked(key) {
    const entry = attempts.get(key);
    if (!entry) return false;
    if (Date.now() - entry.firstAt > WINDOW_MS) {
      attempts.delete(key);
      return false;
    }
    return entry.count >= MAX_ATTEMPTS;
  },
  registerFailure(key) {
    const entry = attempts.get(key);
    if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
      attempts.set(key, { count: 1, firstAt: Date.now() });
      return;
    }
    entry.count += 1;
  },
  reset(key) {
    attempts.delete(key);
  },
};
