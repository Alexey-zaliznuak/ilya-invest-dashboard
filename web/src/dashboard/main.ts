import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/dashboard.css';

import { ApiError, fetchTrades } from '../lib/api';
import { computeMetrics, computeSeries } from '../lib/compute';
import { requireElement } from '../lib/dom';
import { initTheme } from '../lib/theme';
import type { ComputedTrade } from '../lib/types';
import { createEquityChart } from './chart';
import { downloadCsv } from './csv';
import { renderSummary } from './summary';
import { createTradesTable } from './table';

const status = requireElement<HTMLElement>('#loadStatus');
const chart = createEquityChart(
  requireElement<SVGSVGElement>('#equityChart'),
  requireElement<HTMLElement>('#tooltip'),
);
const table = createTradesTable({
  tbody: requireElement<HTMLElement>('#tbody'),
  search: requireElement<HTMLInputElement>('#search'),
  signFilter: requireElement<HTMLSelectElement>('#signFilter'),
  sort: requireElement<HTMLSelectElement>('#sort'),
  dateFrom: requireElement<HTMLInputElement>('#dateFrom'),
  dateTo: requireElement<HTMLInputElement>('#dateTo'),
  counter: requireElement<HTMLElement>('#rowsCount'),
});

initTheme(document.querySelector<HTMLElement>('#themeToggle'), () => chart.redraw());

let series: ComputedTrade[] = [];
requireElement<HTMLButtonElement>('#downloadCsv').addEventListener('click', () => {
  if (series.length > 0) downloadCsv(series);
});

const showStatus = (message: string, isError: boolean): void => {
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.hidden = false;
};

async function load(): Promise<void> {
  showStatus('Загружаю сделки…', false);
  try {
    series = computeSeries(await fetchTrades());
    renderSummary(computeMetrics(series));
    table.setData(series);
    chart.setData(series);
    status.hidden = true;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Неизвестная ошибка загрузки';
    showStatus(`Не удалось загрузить сделки: ${message}`, true);
  }
}

void load();
