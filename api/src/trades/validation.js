import { badRequest } from '../errors.js';

const ROE_SCALE = 4;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

const parseTradeDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw badRequest('Дата должна быть в формате ГГГГ-ММ-ДД');
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(value)) {
    throw badRequest('Такой даты не существует');
  }
  return value;
};

const parseSeq = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const seq = Number(value);
  if (!Number.isInteger(seq) || seq < 1 || seq > 1_000_000) {
    throw badRequest('Порядковый номер должен быть целым числом от 1 до 1 000 000');
  }
  return seq;
};

export function parseTradeInput(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Ожидается JSON-объект со сделкой');
  }

  return {
    seq: parseSeq(body.seq),
    ticker: parseTicker(body.ticker),
    title: parseTitle(body.title),
    roe: parseRoe(body.roe),
    tradeDate: parseTradeDate(body.tradeDate),
  };
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw badRequest('Некорректный идентификатор сделки');
  return id;
}
