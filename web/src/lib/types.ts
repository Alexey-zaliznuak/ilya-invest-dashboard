export interface Trade {
  id: number;
  seq: number;
  ticker: string;
  title: string;
  /** ROE фиксации в процентах от капитала до её закрытия. */
  roe: number;
  /** Дата в формате ГГГГ-ММ-ДД либо null, если она неизвестна. */
  tradeDate: string | null;
}

/** Форма ввода: порядковый номер может быть пустым — тогда сделка встаёт в конец. */
export interface TradeDraft {
  seq: number | null;
  ticker: string;
  title: string;
  roe: number;
  tradeDate: string | null;
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
