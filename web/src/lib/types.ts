export interface Trade {
  id: number;
  ticker: string;
  title: string;
  /** ROE фиксации в процентах от капитала до её закрытия. */
  roe: number;
  /** ISO-8601 datetime либо null, если момент неизвестен. */
  tradeDatetime: string | null;
}

/** Форма ввода: datetime можно оставить пустым. */
export interface TradeDraft {
  ticker: string;
  title: string;
  roe: number;
  tradeDatetime: string | null;
}

export interface ComputedTrade extends Trade {
  index: number;
  before: number;
  contribution: number;
  after: number;
  peak: number;
  drawdown: number;
}

export interface Metrics {
  count: number;
  wins: number;
  losses: number;
  winRate: number | null;
  roeSum: number;
  simpleTotal: number;
  finalCapital: number;
  netReturn: number;
  peakCapital: number;
  maxDrawdown: number;
  peakBeforeDrawdown: number;
  avgRoe: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  medianRoe: number | null;
  bestRoe: number | null;
  worstRoe: number | null;
  /** Границы периода по заполненным датам сделок. */
  firstDate: string | null;
  lastDate: string | null;
}

export interface TgSyncLogEntry {
  at: string;
  level: string;
  message: string;
}

export interface TgSyncSettings {
  enabled: boolean;
  cron: string;
  chatId: string;
  topicId: number | null;
  parseFrom: string | null;
  timezone: string;
  rescanAll: boolean;
  runRequested: boolean;
  lastRunAt: string | null;
  lastRunStatus: string;
  lastRunError: string;
  lastRunStats: Record<string, unknown>;
  lastRunLog: TgSyncLogEntry[];
  updatedAt: string;
}

export interface TgDialog {
  id: string;
  title: string;
  username: string | null;
  kind: string;
  unread: number;
}

export interface ResolvedTelegramLink {
  chatId: string;
  topicId: number | null;
  messageId: number | null;
  kind: string;
}

export interface TgSyncStatus {
  runRequested: boolean;
  lastRunAt: string | null;
  lastRunStatus: string;
  lastRunError: string;
  lastRunStats: Record<string, unknown>;
  lastRunLog: TgSyncLogEntry[];
}
