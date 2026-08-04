const STORAGE_KEY = 'roe-admin-session';

export interface AdminSession {
  token: string;
  login: string;
  expiresAt: number;
}

const isSession = (value: unknown): value is AdminSession =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AdminSession).token === 'string' &&
  typeof (value as AdminSession).login === 'string' &&
  typeof (value as AdminSession).expiresAt === 'number';

export function loadSession(): AdminSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed) || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: AdminSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
