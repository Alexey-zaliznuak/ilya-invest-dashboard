import type { ComputedTrade, Metrics, Trade } from './types';

export const START_CAPITAL = 100;

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const average = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Каждый ROE применяется к капиталу, который сложился к моменту закрытия сделки,
 * то есть фиксации капитализируются последовательно: Kₙ = Kₙ₋₁ × (1 + ROEₙ / 100).
 */
export function computeSeries(trades: Trade[]): ComputedTrade[] {
  let capital = START_CAPITAL;
  let peak = START_CAPITAL;

  return trades.map((trade, index) => {
    const before = capital;
    const contribution = (before * trade.roe) / 100;
    capital = before + contribution;
    peak = Math.max(peak, capital);

    return {
      ...trade,
      index,
      before,
      contribution,
      after: capital,
      peak,
      drawdown: (capital / peak - 1) * 100,
    };
  });
}

export function computeMetrics(series: ComputedTrade[]): Metrics {
  const roes = series.map((row) => row.roe);
  const winRoes = roes.filter((roe) => roe >= 0);
  const lossRoes = roes.filter((roe) => roe < 0);
  const roeSum = roes.reduce((sum, roe) => sum + roe, 0);

  const finalCapital = series.at(-1)?.after ?? START_CAPITAL;
  const peakCapital = series.reduce((max, row) => Math.max(max, row.peak), START_CAPITAL);

  let maxDrawdown = 0;
  let peakBeforeDrawdown = START_CAPITAL;
  for (const row of series) {
    if (row.drawdown < maxDrawdown) {
      maxDrawdown = row.drawdown;
      peakBeforeDrawdown = row.peak;
    }
  }

  // Даты в ISO-формате, поэтому лексикографическая сортировка совпадает с хронологической.
  const dates = series
    .map((row) => row.tradeDate)
    .filter((date): date is string => date !== null)
    .sort();

  return {
    count: series.length,
    wins: winRoes.length,
    losses: lossRoes.length,
    winRate: series.length === 0 ? null : (winRoes.length / series.length) * 100,
    roeSum,
    simpleTotal: START_CAPITAL + roeSum,
    finalCapital,
    netReturn: finalCapital - START_CAPITAL,
    peakCapital,
    maxDrawdown,
    peakBeforeDrawdown,
    avgRoe: average(roes),
    avgWin: average(winRoes),
    avgLoss: average(lossRoes),
    medianRoe: median(roes),
    bestRoe: roes.length === 0 ? null : Math.max(...roes),
    worstRoe: roes.length === 0 ? null : Math.min(...roes),
    firstDate: dates.at(0) ?? null,
    lastDate: dates.at(-1) ?? null,
  };
}
