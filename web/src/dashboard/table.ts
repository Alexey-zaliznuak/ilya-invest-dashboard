import { escapeHtml } from '../lib/dom';
import { datePart, fmt, formatDateTime, pluralize, signed } from '../lib/format';
import type { ComputedTrade } from '../lib/types';

type SignFilter = 'all' | 'positive' | 'negative';
type SortMode = 'order' | 'date-desc' | 'date-asc' | 'roe-desc' | 'roe-asc' | 'capital-desc';

const COLUMN_COUNT = 8;

const comparators: Record<SortMode, (a: ComputedTrade, b: ComputedTrade) => number> = {
  order: (a, b) => a.index - b.index,
  'roe-desc': (a, b) => b.roe - a.roe,
  'roe-asc': (a, b) => a.roe - b.roe,
  'capital-desc': (a, b) => b.after - a.after,
  // ISO datetime сравниваем как строки; сделки без даты уходят в конец списка.
  'date-desc': (a, b) =>
    (b.tradeDatetime ?? '').localeCompare(a.tradeDatetime ?? '') || a.index - b.index,
  'date-asc': (a, b) =>
    (a.tradeDatetime ?? '9999').localeCompare(b.tradeDatetime ?? '9999') || a.index - b.index,
};

const renderRow = (row: ComputedTrade): string => `<tr>
  <td class="muted">${row.index + 1}</td>
  <td><span class="ticker">#${escapeHtml(row.ticker)}</span></td>
  <td class="muted nowrap">${formatDateTime(row.tradeDatetime)}</td>
  <td>${escapeHtml(row.title)}</td>
  <td><span class="delta-chip ${row.roe >= 0 ? 'up' : 'down'}">${signed(row.roe)}</span></td>
  <td class="hide-mobile">${fmt(row.before)}%</td>
  <td class="${row.contribution >= 0 ? 'positive' : 'negative'}">${signed(row.contribution)}</td>
  <td><strong>${fmt(row.after)}%</strong></td>
</tr>`;

const emptyRow = (message: string): string =>
  `<tr><td colspan="${COLUMN_COUNT}"><div class="state-message">${escapeHtml(message)}</div></td></tr>`;

export interface TradesTableElements {
  tbody: HTMLElement;
  search: HTMLInputElement;
  signFilter: HTMLSelectElement;
  sort: HTMLSelectElement;
  dateFrom: HTMLInputElement;
  dateTo: HTMLInputElement;
  counter: HTMLElement;
}

export function createTradesTable(elements: TradesTableElements): { setData(series: ComputedTrade[]): void } {
  let series: ComputedTrade[] = [];

  function render(): void {
    const query = elements.search.value.trim().toLowerCase();
    const sign = elements.signFilter.value as SignFilter;
    const from = elements.dateFrom.value;
    const to = elements.dateTo.value;

    const rows = series
      .filter((row) => {
        const matchesQuery =
          query === '' || `${row.ticker} ${row.title}`.toLowerCase().includes(query);
        const matchesSign =
          sign === 'all' || (sign === 'positive' ? row.roe >= 0 : row.roe < 0);
        const day = datePart(row.tradeDatetime);
        // Сделку без даты нельзя отнести к периоду, поэтому фильтр её отсекает.
        const matchesPeriod =
          (from === '' && to === '') ||
          (day !== null && (from === '' || day >= from) && (to === '' || day <= to));
        return matchesQuery && matchesSign && matchesPeriod;
      })
      .sort(comparators[elements.sort.value as SortMode] ?? comparators.order);

    elements.counter.textContent = `${rows.length} ${pluralize(rows.length, ['строка', 'строки', 'строк'])}`;

    if (rows.length === 0) {
      elements.tbody.innerHTML = emptyRow(
        series.length === 0 ? 'В базе пока нет сделок' : 'Под фильтры ничего не подошло',
      );
      return;
    }

    elements.tbody.innerHTML = rows.map(renderRow).join('');
  }

  elements.search.addEventListener('input', render);
  elements.signFilter.addEventListener('change', render);
  elements.sort.addEventListener('change', render);
  elements.dateFrom.addEventListener('change', render);
  elements.dateTo.addEventListener('change', render);

  return {
    setData(next) {
      series = next;
      render();
    },
  };
}
