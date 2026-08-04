import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/admin.css';

import {
  ApiError,
  createTrade,
  deleteTrade,
  fetchTrades,
  updateTrade,
  verifySession,
} from '../lib/api';
import { computeMetrics, computeSeries } from '../lib/compute';
import { requireElement } from '../lib/dom';
import { percent } from '../lib/format';
import { clearSession, loadSession } from '../lib/session';
import { initTheme } from '../lib/theme';
import type { Trade } from '../lib/types';
import { setupLoginForm } from './login';
import { showToast } from './toast';
import { bindTradeForm, readFormElements } from './trade-form';
import { createAdminTable } from './trades-table';

const authView = requireElement<HTMLElement>('#authView');
const appView = requireElement<HTMLElement>('#appView');
const logoutButton = requireElement<HTMLButtonElement>('#logout');
const whoami = requireElement<HTMLElement>('#whoami');
const capitalPreview = requireElement<HTMLElement>('#capitalPreview');

const formElements = readFormElements();
let trades: Trade[] = [];

const table = createAdminTable(
  {
    tbody: requireElement<HTMLElement>('#adminTbody'),
    search: requireElement<HTMLInputElement>('#adminSearch'),
    counter: requireElement<HTMLElement>('#adminCount'),
  },
  {
    onEdit(id) {
      const trade = trades.find((item) => item.id === id);
      if (!trade) return;
      form.startEdit(trade);
      table.setEditing(id);
    },
    onDelete(id) {
      const trade = trades.find((item) => item.id === id);
      if (!trade) return;
      if (!confirm(`Удалить сделку #${trade.ticker} с ROE ${trade.roe}%?`)) return;
      void remove(id);
    },
  },
);

const form = bindTradeForm(formElements, async (draft, editingId) => {
  try {
    if (editingId === null) {
      await createTrade(draft);
      showToast('Сделка добавлена');
    } else {
      await updateTrade(editingId, draft);
      showToast('Сделка обновлена');
    }
    form.reset();
    table.setEditing(null);
    await refresh();
  } catch (error) {
    reportError(error, 'Не удалось сохранить сделку');
  }
});

function reportError(error: unknown, fallback: string): void {
  if (error instanceof ApiError && error.status === 401) {
    showAuth();
    showToast('Сессия истекла, войдите заново', 'error');
    return;
  }
  showToast(error instanceof ApiError ? error.message : fallback, 'error');
}

async function remove(id: number): Promise<void> {
  try {
    await deleteTrade(id);
    if (form.editingId === id) {
      form.reset();
      table.setEditing(null);
    }
    showToast('Сделка удалена');
    await refresh();
  } catch (error) {
    reportError(error, 'Не удалось удалить сделку');
  }
}

async function refresh(): Promise<void> {
  try {
    trades = await fetchTrades();
    table.setData(trades);
    const metrics = computeMetrics(computeSeries(trades));
    capitalPreview.textContent = `Итоговый капитал: ${percent(metrics.finalCapital, 2)}`;
  } catch (error) {
    table.setMessage('Не удалось загрузить сделки');
    reportError(error, 'Не удалось загрузить сделки');
  }
}

function showAuth(): void {
  clearSession();
  authView.hidden = false;
  appView.hidden = true;
  logoutButton.hidden = true;
  whoami.hidden = true;
}

function showApp(adminLogin: string): void {
  authView.hidden = true;
  appView.hidden = false;
  logoutButton.hidden = false;
  whoami.hidden = false;
  whoami.textContent = adminLogin;
  void refresh();
}

initTheme(document.querySelector<HTMLElement>('#themeToggle'));
setupLoginForm(
  {
    form: requireElement<HTMLFormElement>('#loginForm'),
    loginInput: requireElement<HTMLInputElement>('#loginField'),
    passwordInput: requireElement<HTMLInputElement>('#passwordField'),
    submit: requireElement<HTMLButtonElement>('#loginSubmit'),
    error: requireElement<HTMLElement>('#loginError'),
  },
  showApp,
);
logoutButton.addEventListener('click', () => {
  showAuth();
  showToast('Вы вышли из админки');
});

async function bootstrap(): Promise<void> {
  const session = loadSession();
  if (!session) {
    showAuth();
    return;
  }

  try {
    // Токен мог быть выпущен с прежним SESSION_SECRET — проверяем его на сервере.
    const verified = await verifySession();
    showApp(verified.login);
  } catch {
    showAuth();
  }
}

void bootstrap();
