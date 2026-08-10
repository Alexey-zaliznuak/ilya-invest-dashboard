import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/format';
import { requireElement } from '../lib/dom';
import type { Trade, TradeDraft } from '../lib/types';

export interface TradeFormElements {
  form: HTMLFormElement;
  tradeDatetime: HTMLInputElement;
  ticker: HTMLInputElement;
  title: HTMLInputElement;
  roe: HTMLInputElement;
  submit: HTMLButtonElement;
  cancel: HTMLButtonElement;
  mode: HTMLElement;
}

export interface TradeForm {
  /** id редактируемой сделки либо null, если форма создаёт новую. */
  readonly editingId: number | null;
  startEdit(trade: Trade): void;
  reset(): void;
  setBusy(busy: boolean): void;
}

export function collectDraft(elements: TradeFormElements): TradeDraft {
  return {
    ticker: elements.ticker.value.trim(),
    title: elements.title.value.trim(),
    roe: Number(elements.roe.value.replace(',', '.')),
    tradeDatetime: fromDatetimeLocalValue(elements.tradeDatetime.value),
  };
}

export function bindTradeForm(
  elements: TradeFormElements,
  onSubmit: (draft: TradeDraft, editingId: number | null) => Promise<void>,
): TradeForm {
  let editingId: number | null = null;

  const applyMode = (): void => {
    elements.mode.textContent = editingId === null ? 'Новая сделка' : `Правка сделки #${editingId}`;
    elements.submit.textContent = editingId === null ? 'Добавить' : 'Сохранить';
    elements.cancel.hidden = editingId === null;
  };

  const form: TradeForm = {
    get editingId() {
      return editingId;
    },
    startEdit(trade) {
      editingId = trade.id;
      elements.tradeDatetime.value = toDatetimeLocalValue(trade.tradeDatetime);
      elements.ticker.value = trade.ticker;
      elements.title.value = trade.title;
      elements.roe.value = String(trade.roe);
      applyMode();
      elements.form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      elements.ticker.focus();
    },
    reset() {
      editingId = null;
      elements.form.reset();
      applyMode();
    },
    setBusy(busy) {
      elements.submit.disabled = busy;
    },
  };

  elements.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    form.setBusy(true);
    try {
      await onSubmit(collectDraft(elements), editingId);
    } finally {
      form.setBusy(false);
    }
  });

  elements.cancel.addEventListener('click', () => form.reset());
  applyMode();

  return form;
}

export const readFormElements = (): TradeFormElements => ({
  form: requireElement<HTMLFormElement>('#tradeForm'),
  tradeDatetime: requireElement<HTMLInputElement>('#fieldDatetime'),
  ticker: requireElement<HTMLInputElement>('#fieldTicker'),
  title: requireElement<HTMLInputElement>('#fieldTitle'),
  roe: requireElement<HTMLInputElement>('#fieldRoe'),
  submit: requireElement<HTMLButtonElement>('#tradeSubmit'),
  cancel: requireElement<HTMLButtonElement>('#tradeCancel'),
  mode: requireElement<HTMLElement>('#formMode'),
});
