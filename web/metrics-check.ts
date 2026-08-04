import { readFileSync } from 'node:fs';

import { computeMetrics, computeSeries } from './src/lib/compute';
import type { Trade } from './src/lib/types';

interface SeedRow {
  seq: number;
  date: string;
  ticker: string;
  title: string;
  roe: number;
}

const seed: SeedRow[] = JSON.parse(readFileSync('../seed/trades.json', 'utf8'));
const trades: Trade[] = seed.map((row, index) => ({
  id: index + 1,
  seq: row.seq,
  ticker: row.ticker,
  title: row.title,
  roe: row.roe,
  tradeDate: row.date,
}));

const series = computeSeries(trades);
const metrics = computeMetrics(series);

const expected: Record<string, number> = {
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
  peakBeforeDrawdown: 223.095,
};

let failures = 0;
for (const [key, want] of Object.entries(expected)) {
  const got = (metrics as unknown as Record<string, number>)[key];
  const ok = Math.abs(got - want) < 0.005;
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${key}: ожидалось ~${want}, получено ${got.toFixed(4)}`);
}
console.log(`период: ${metrics.firstDate} … ${metrics.lastDate}, сделок: ${metrics.count}`);
console.log(failures === 0 ? 'Расчёты совпадают с исходным дашбордом' : `Расхождений: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
