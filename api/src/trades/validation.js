import { badRequest } from '../errors.js';

const ROE_SCALE = 4;

const parseTicker = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest('Тикер обязателен');
  }
  const ticker = value.trim().replace(/^#/, '');
  if (ticker.length > 32) throw badRequest('Тикер длиннее 32 символов');
  return ticker;
};

const parseTitle = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw badRequest('Событие должно быть строкой');
  const title = value.trim();
  if (title.length > 300) throw badRequest('Описание события длиннее 300 символов');
  return title;
};

/** ROE округляется до масштаба колонки, иначе проверка дублей разойдётся с тем, что легло в базу. */
const parseRoe = (value) => {
  const roe = typeof value === 'string' ? Number(value.replace(',', '.').trim()) : Number(value);
  if (!Number.isFinite(roe)) throw badRequest('ROE должен быть числом');
  if (roe < -100) throw badRequest('ROE не может быть меньше −100%');
  if (roe > 100000) throw badRequest('ROE выглядит нереалистично большим');
  return Number(roe.toFixed(ROE_SCALE));
};

/**
 * Принимает ISO-8601 datetime (с TZ или без). Без TZ считаем Europe/Moscow.
 * Для совместимости допускает голую дату ГГГГ-ММ-ДД → полночь MSK.
 */
const parseTradeDatetime = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('Дата/время должны быть строкой');

  const trimmed = value.trim();
  let candidate = trimmed;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    candidate = `${trimmed}T00:00:00+03:00`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    candidate = `${trimmed}${trimmed.length === 16 ? ':00' : ''}+03:00`;
  }

  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    throw badRequest('Дата/время должны быть в формате ISO-8601');
  }
  return date.toISOString();
};

export function parseTradeInput(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Ожидается JSON-объект со сделкой');
  }

  const rawDatetime = body.tradeDatetime ?? body.datetime ?? body.tradeDate ?? body.date;

  return {
    ticker: parseTicker(body.ticker),
    title: parseTitle(body.title),
    roe: parseRoe(body.roe),
    tradeDatetime: parseTradeDatetime(rawDatetime),
  };
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw badRequest('Некорректный идентификатор сделки');
  return id;
}
