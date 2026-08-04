// metrics-check.ts
import { readFileSync } from "node:fs";

// src/lib/compute.ts
var START_CAPITAL = 100;
var median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};
var average = (values) => values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
function computeSeries(trades2) {
  let capital = START_CAPITAL;
  let peak = START_CAPITAL;
  return trades2.map((trade, index) => {
    const before = capital;
    const contribution = before * trade.roe / 100;
    capital = before + contribution;
    peak = Math.max(peak, capital);
    return {
      ...trade,
      index,
      before,
      contribution,
      after: capital,
      peak,
      drawdown: (capital / peak - 1) * 100
    };
  });
}
function computeMetrics(series2) {
  const roes = series2.map((row) => row.roe);
  const winRoes = roes.filter((roe) => roe >= 0);
  const lossRoes = roes.filter((roe) => roe < 0);
  const roeSum = roes.reduce((sum, roe) => sum + roe, 0);
  const finalCapital = series2.at(-1)?.after ?? START_CAPITAL;
  const peakCapital = series2.reduce((max, row) => Math.max(max, row.peak), START_CAPITAL);
  let maxDrawdown = 0;
  let peakBeforeDrawdown = START_CAPITAL;
  for (const row of series2) {
    if (row.drawdown < maxDrawdown) {
      maxDrawdown = row.drawdown;
      peakBeforeDrawdown = row.peak;
    }
  }
  const dates = series2.map((row) => row.tradeDate).filter((date) => date !== null).sort();
  return {
    count: series2.length,
    wins: winRoes.length,
    losses: lossRoes.length,
    winRate: series2.length === 0 ? null : winRoes.length / series2.length * 100,
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
    lastDate: dates.at(-1) ?? null
  };
}

// metrics-check.ts
var seed = JSON.parse(readFileSync("../seed/trades.json", "utf8"));
var trades = seed.map((row, index) => ({
  id: index + 1,
  seq: row.seq,
  ticker: row.ticker,
  title: row.title,
  roe: row.roe,
  tradeDate: row.date
}));
var series = computeSeries(trades);
var metrics = computeMetrics(series);
var expected = {
  finalCapital: 213.522,
  netReturn: 113.522,
  peakCapital: 223.095,
  wins: 85,
  losses: 10,
  roeSum: 80.498,
  maxDrawdown: -23.104,
  winRate: 89.47,
  medianRoe: 0.628,
  avgRoe: 0.847,
  avgWin: 1.291,
  avgLoss: -2.922,
  bestRoe: 10.702,
  worstRoe: -22.44,
  peakBeforeDrawdown: 223.095
};
var failures = 0;
for (const [key, want] of Object.entries(expected)) {
  const got = metrics[key];
  const ok = Math.abs(got - want) < 5e-3;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${key}: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ~${want}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${got.toFixed(4)}`);
}
console.log(`\u043F\u0435\u0440\u0438\u043E\u0434: ${metrics.firstDate} \u2026 ${metrics.lastDate}, \u0441\u0434\u0435\u043B\u043E\u043A: ${metrics.count}`);
console.log(failures === 0 ? "\u0420\u0430\u0441\u0447\u0451\u0442\u044B \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442 \u0441 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u043C \u0434\u0430\u0448\u0431\u043E\u0440\u0434\u043E\u043C" : `\u0420\u0430\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0439: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
