import { escapeHtml } from '../lib/dom';
import { formatDateTime, pluralize, signed } from '../lib/format';
import type { Trade } from '../lib/types';

const COLUMN_COUNT = 5;

const renderRow = (trade: Trade, editingId: number | null): string => `<tr${
  trade.id === editingId ? ' class="editing"' : ''
}>
  <td class="muted nowrap">${formatDateTime(trade.tradeDatetime)}</td>
  <td><span class="ticker">#${escapeHtml(trade.ticker)}</span></td>
  <td>${escapeHtml(trade.title) || '<span class="muted">—</span>'}</td>
  <td><span class="delta-chip ${trade.roe >= 0 ? 'up' : 'down'}">${signed(trade.roe)}</span></td>
  <td>
    <div class="row-actions">
      <button class="g-button small" type="button" data-action="edit" data-id="${trade.id}">Править</button>
      <button class="g-button small danger" type="button" data-action="delete" data-id="${trade.id}">Удалить</button>
    </div>
  </td>
</tr>`;

export interface AdminTableElements {
  tbody: HTMLElement;
  search: HTMLInputElement;
  counter: HTMLElement;
}

export interface AdminTableHandlers {
  onEdit(id: number): void;
  onDelete(id: number): void;
}

export interface AdminTable {
  setData(trades: Trade[]): void;
  setEditing(id: number | null): void;
  setMessage(message: string): void;
}

export function createAdminTable(
  elements: AdminTableElements,
  handlers: AdminTableHandlers,
): AdminTable {
  let trades: Trade[] = [];
  let editingId: number | null = null;

  function render(): void {
    const query = elements.search.value.trim().toLowerCase();
    const rows = trades.filter(
      (trade) => query === '' || `${trade.ticker} ${trade.title}`.toLowerCase().includes(query),
    );

    elements.counter.textContent = `${rows.length} ${pluralize(rows.length, ['сделка', 'сделки', 'сделок'])}`;

    if (rows.length === 0) {
      table.setMessage(trades.length === 0 ? 'В базе пока нет сделок' : 'Ничего не найдено');
      return;
    }

    elements.tbody.innerHTML = rows.map((trade) => renderRow(trade, editingId)).join('');
  }

  const table: AdminTable = {
    setData(next) {
      trades = next;
      render();
    },
    setEditing(id) {
      editingId = id;
      render();
    },
    setMessage(message) {
      elements.tbody.innerHTML = `<tr><td colspan="${COLUMN_COUNT}"><div class="state-message">${escapeHtml(
        message,
      )}</div></td></tr>`;
    },
  };

  elements.tbody.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;

    const id = Number(button.dataset.id);
    if (button.dataset.action === 'edit') handlers.onEdit(id);
    if (button.dataset.action === 'delete') handlers.onDelete(id);
  });

  elements.search.addEventListener('input', render);

  return table;
}
