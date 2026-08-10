import {
  fetchTgDialogs,
  fetchTgSyncSettings,
  fetchTgSyncStatus,
  requestTgSyncRun,
  resolveTelegramLink,
  saveTgSyncSettings,
} from '../lib/api';
import { escapeHtml, requireElement } from '../lib/dom';
import {
  formatDateTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../lib/format';
import type { TgDialog, TgSyncSettings, TgSyncStatus } from '../lib/types';

export interface TgSyncFormElements {
  form: HTMLFormElement;
  enabled: HTMLInputElement;
  cron: HTMLInputElement;
  chatId: HTMLInputElement;
  topicId: HTMLInputElement;
  parseFrom: HTMLInputElement;
  timezone: HTMLInputElement;
  rescanAll: HTMLInputElement;
  link: HTMLInputElement;
  resolveLink: HTMLButtonElement;
  loadDialogs: HTMLButtonElement;
  dialogsPanel: HTMLElement;
  dialogsSearch: HTMLInputElement;
  dialogsList: HTMLElement;
  save: HTMLButtonElement;
  run: HTMLButtonElement;
  statusPill: HTMLElement;
  statusText: HTMLElement;
}

export interface TgSyncPanel {
  load(): Promise<void>;
  startPolling(): void;
  stopPolling(): void;
}

const statusLabel = (status: string): string => {
  switch (status) {
    case 'idle':
      return 'ожидание';
    case 'running':
      return 'идёт';
    case 'success':
      return 'успех';
    case 'error':
      return 'ошибка';
    default:
      return status;
  }
};

const renderStatus = (
  elements: TgSyncFormElements,
  settings:
    | Pick<
        TgSyncSettings,
        'runRequested' | 'lastRunAt' | 'lastRunStatus' | 'lastRunError' | 'lastRunStats'
      >
    | TgSyncStatus,
): void => {
  const pending = settings.runRequested ? ' · запрошен запуск' : '';
  elements.statusPill.textContent = `Статус: ${statusLabel(settings.lastRunStatus)}${pending}`;

  const stats = settings.lastRunStats ?? {};
  const statsBits: string[] = [];
  if (typeof stats.weeks === 'number') statsBits.push(`недель: ${stats.weeks}`);
  if (typeof stats.messages === 'number') statsBits.push(`сообщений: ${stats.messages}`);
  if (typeof stats.trades === 'number') statsBits.push(`сделок: ${stats.trades}`);
  if (typeof stats.backupFile === 'string' && stats.backupFile) {
    statsBits.push(`бекап: ${stats.backupFile}`);
  }

  const lines = [
    settings.lastRunAt
      ? `Последний запуск: ${formatDateTime(settings.lastRunAt)}`
      : 'Запусков ещё не было',
    statsBits.length > 0 ? statsBits.join(' · ') : '',
    settings.lastRunError ? `Ошибка: ${settings.lastRunError}` : '',
  ].filter(Boolean);

  elements.statusText.textContent = lines.join('\n');
};

const fillForm = (elements: TgSyncFormElements, settings: TgSyncSettings): void => {
  elements.enabled.checked = settings.enabled;
  elements.cron.value = settings.cron;
  elements.chatId.value = settings.chatId;
  elements.topicId.value = settings.topicId === null ? '' : String(settings.topicId);
  elements.parseFrom.value = toDatetimeLocalValue(settings.parseFrom);
  elements.timezone.value = settings.timezone;
  elements.rescanAll.checked = settings.rescanAll;
  renderStatus(elements, settings);
};

const readTopicId = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Number(trimmed);
};

const renderDialogs = (elements: TgSyncFormElements, dialogs: TgDialog[]): void => {
  const query = elements.dialogsSearch.value.trim().toLowerCase();
  const rows = dialogs.filter((dialog) => {
    if (!query) return true;
    return `${dialog.title} ${dialog.username ?? ''} ${dialog.id}`.toLowerCase().includes(query);
  });

  if (rows.length === 0) {
    elements.dialogsList.innerHTML = `<div class="state-message">Ничего не найдено</div>`;
    return;
  }

  elements.dialogsList.innerHTML = rows
    .map(
      (dialog) => `<button type="button" class="dialog-row" data-id="${escapeHtml(dialog.id)}">
        <span>
          <div class="dialog-title">${escapeHtml(dialog.title)}</div>
          <div class="dialog-meta">${escapeHtml(dialog.kind)}${
            dialog.username ? ` · ${escapeHtml(dialog.username)}` : ''
          }</div>
        </span>
        <span class="dialog-id">${escapeHtml(dialog.id)}</span>
      </button>`,
    )
    .join('');
};

export function bindTgSyncPanel(
  elements: TgSyncFormElements,
  onError: (error: unknown, fallback: string) => void,
  onInfo: (message: string) => void,
): TgSyncPanel {
  let pollTimer: number | null = null;
  let busy = false;
  let dialogs: TgDialog[] = [];

  const setBusy = (next: boolean): void => {
    busy = next;
    elements.save.disabled = next;
    elements.run.disabled = next;
    elements.resolveLink.disabled = next;
    elements.loadDialogs.disabled = next;
  };

  const panel: TgSyncPanel = {
    async load() {
      const settings = await fetchTgSyncSettings();
      fillForm(elements, settings);
    },
    startPolling() {
      panel.stopPolling();
      pollTimer = window.setInterval(() => {
        void fetchTgSyncStatus()
          .then((status) => renderStatus(elements, status))
          .catch(() => {
            /* тихий опрос */
          });
      }, 5000);
    },
    stopPolling() {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    },
  };

  elements.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const settings = await saveTgSyncSettings({
        enabled: elements.enabled.checked,
        cron: elements.cron.value.trim(),
        chatId: elements.chatId.value.trim(),
        topicId: readTopicId(elements.topicId.value),
        parseFrom: fromDatetimeLocalValue(elements.parseFrom.value),
        timezone: elements.timezone.value.trim() || 'Europe/Moscow',
        rescanAll: elements.rescanAll.checked,
      });
      fillForm(elements, settings);
      onInfo('Настройки tg-sync сохранены');
    } catch (error) {
      onError(error, 'Не удалось сохранить настройки tg-sync');
    } finally {
      setBusy(false);
    }
  });

  elements.run.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try {
      const settings = await requestTgSyncRun();
      fillForm(elements, settings);
      onInfo('Запуск tg-sync запрошен');
    } catch (error) {
      onError(error, 'Не удалось запросить запуск');
    } finally {
      setBusy(false);
    }
  });

  elements.resolveLink.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try {
      const resolved = await resolveTelegramLink(elements.link.value.trim());
      elements.chatId.value = resolved.chatId;
      elements.topicId.value = resolved.topicId === null ? '' : String(resolved.topicId);
      onInfo(
        resolved.topicId
          ? `Чат ${resolved.chatId}, топик ${resolved.topicId}`
          : `Чат ${resolved.chatId}`,
      );
    } catch (error) {
      onError(error, 'Не удалось разобрать ссылку');
    } finally {
      setBusy(false);
    }
  });

  elements.loadDialogs.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try {
      dialogs = await fetchTgDialogs();
      elements.dialogsPanel.hidden = false;
      renderDialogs(elements, dialogs);
      onInfo(`Загружено чатов: ${dialogs.length}`);
    } catch (error) {
      onError(error, 'Не удалось загрузить чаты (нужны tg-sync и auth-сессия)');
    } finally {
      setBusy(false);
    }
  });

  elements.dialogsSearch.addEventListener('input', () => renderDialogs(elements, dialogs));

  elements.dialogsList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
    if (!button) return;
    elements.chatId.value = button.dataset.id ?? '';
    onInfo(`Выбран чат ${elements.chatId.value}`);
  });

  return panel;
}

export const readTgSyncElements = (): TgSyncFormElements => ({
  form: requireElement<HTMLFormElement>('#tgSyncForm'),
  enabled: requireElement<HTMLInputElement>('#tgEnabled'),
  cron: requireElement<HTMLInputElement>('#tgCron'),
  chatId: requireElement<HTMLInputElement>('#tgChatId'),
  topicId: requireElement<HTMLInputElement>('#tgTopicId'),
  parseFrom: requireElement<HTMLInputElement>('#tgParseFrom'),
  timezone: requireElement<HTMLInputElement>('#tgTimezone'),
  rescanAll: requireElement<HTMLInputElement>('#tgRescanAll'),
  link: requireElement<HTMLInputElement>('#tgLink'),
  resolveLink: requireElement<HTMLButtonElement>('#tgResolveLink'),
  loadDialogs: requireElement<HTMLButtonElement>('#tgLoadDialogs'),
  dialogsPanel: requireElement<HTMLElement>('#tgDialogsPanel'),
  dialogsSearch: requireElement<HTMLInputElement>('#tgDialogsSearch'),
  dialogsList: requireElement<HTMLElement>('#tgDialogsList'),
  save: requireElement<HTMLButtonElement>('#tgSyncSave'),
  run: requireElement<HTMLButtonElement>('#tgSyncRun'),
  statusPill: requireElement<HTMLElement>('#tgSyncStatusPill'),
  statusText: requireElement<HTMLElement>('#tgSyncStatusText'),
});
