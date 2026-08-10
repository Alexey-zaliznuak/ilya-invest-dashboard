import { clearSession, loadSession, saveSession, type AdminSession } from './session';
import type {
  ResolvedTelegramLink,
  Trade,
  TradeDraft,
  TgDialog,
  TgSyncSettings,
  TgSyncStatus,
} from './types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, { method = 'GET', body, auth }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth) {
    const session = loadSession();
    if (!session) throw new ApiError(401, 'unauthorized', 'Сессия истекла, войдите заново');
    headers.authorization = `Bearer ${session.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Не удалось связаться с сервером');
  }

  if (response.status === 401) {
    clearSession();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const details = (payload ?? {}) as { error?: string; message?: string };
    throw new ApiError(
      response.status,
      details.error ?? 'unknown_error',
      details.message ?? `Ошибка запроса (${response.status})`,
    );
  }

  return payload as T;
}

export async function fetchTrades(): Promise<Trade[]> {
  const { trades } = await request<{ trades: Trade[] }>('/trades');
  return trades;
}

export async function login(loginName: string, password: string): Promise<AdminSession> {
  const session = await request<AdminSession>('/auth/login', {
    method: 'POST',
    body: { login: loginName, password },
  });
  saveSession(session);
  return session;
}

export const verifySession = (): Promise<{ login: string; expiresAt: number }> =>
  request('/auth/session', { auth: true });

export async function createTrade(draft: TradeDraft): Promise<Trade> {
  const { trade } = await request<{ trade: Trade }>('/trades', {
    method: 'POST',
    body: draft,
    auth: true,
  });
  return trade;
}

export async function updateTrade(id: number, draft: TradeDraft): Promise<Trade> {
  const { trade } = await request<{ trade: Trade }>(`/trades/${id}`, {
    method: 'PUT',
    body: draft,
    auth: true,
  });
  return trade;
}

export const deleteTrade = (id: number): Promise<void> =>
  request(`/trades/${id}`, { method: 'DELETE', auth: true });

export async function fetchTgSyncSettings(): Promise<TgSyncSettings> {
  const { settings } = await request<{ settings: TgSyncSettings }>('/settings/tg-sync', {
    auth: true,
  });
  return settings;
}

export async function saveTgSyncSettings(
  draft: Omit<
    TgSyncSettings,
    | 'runRequested'
    | 'lastRunAt'
    | 'lastRunStatus'
    | 'lastRunError'
    | 'lastRunStats'
    | 'lastRunLog'
    | 'updatedAt'
  >,
): Promise<TgSyncSettings> {
  const { settings } = await request<{ settings: TgSyncSettings }>('/settings/tg-sync', {
    method: 'PUT',
    body: draft,
    auth: true,
  });
  return settings;
}

export async function requestTgSyncRun(): Promise<TgSyncSettings> {
  const { settings } = await request<{ settings: TgSyncSettings }>('/settings/tg-sync/run', {
    method: 'POST',
    auth: true,
  });
  return settings;
}

export async function fetchTgSyncStatus(): Promise<TgSyncStatus> {
  const { status } = await request<{ status: TgSyncStatus }>('/settings/tg-sync/status', {
    auth: true,
  });
  return status;
}

export async function resolveTelegramLink(url: string): Promise<ResolvedTelegramLink> {
  const { resolved } = await request<{ resolved: ResolvedTelegramLink }>(
    '/settings/tg-sync/resolve-link',
    {
      method: 'POST',
      body: { url },
      auth: true,
    },
  );
  return resolved;
}

export async function fetchTgDialogs(): Promise<TgDialog[]> {
  const { dialogs } = await request<{ dialogs: TgDialog[] }>('/settings/tg-sync/dialogs', {
    auth: true,
  });
  return dialogs;
}
