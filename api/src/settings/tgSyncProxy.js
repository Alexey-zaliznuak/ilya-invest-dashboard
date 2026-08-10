import { config } from '../config.js';

export async function proxyTgSync(path, { method = 'GET', body } = {}) {
  const url = `${config.tgSyncUrl.replace(/\/$/, '')}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Не удалось связаться с сервисом tg-sync';
    const err = new Error(
      `tg-sync недоступен (${message}). Убедитесь, что контейнер запущен и сессия авторизована.`,
    );
    err.status = 503;
    err.code = 'tg_sync_unavailable';
    throw err;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload.message ?? `Ошибка tg-sync (${response.status})`);
    err.status = response.status;
    err.code = payload.error ?? 'tg_sync_error';
    throw err;
  }
  return payload;
}
