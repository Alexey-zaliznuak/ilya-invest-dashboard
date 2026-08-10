import type { ComputedTrade } from '../lib/types';

const HEADERS = [
  '№',
  'Тикер',
  'Дата',
  'Событие',
  'ROE %',
  'Капитал до %',
  'Вклад %',
  'Капитал после %',
];

const quote = (value: unknown): string => `"${String(value).replaceAll('"', '""')}"`;

export function downloadCsv(series: ComputedTrade[]): void {
  const rows = series.map((row) => [
    row.index + 1,
    row.ticker,
    row.tradeDatetime ?? '',
    row.title,
    row.roe,
    row.before,
    row.contribution,
    row.after,
  ]);

  // BOM нужен, чтобы Excel не ломал кириллицу.
  const csv = `\ufeff${[HEADERS, ...rows].map((row) => row.map(quote).join(';')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));

  const link = document.createElement('a');
  link.href = url;
  link.download = 'roe-capital-growth.csv';
  link.click();
  URL.revokeObjectURL(url);
}
