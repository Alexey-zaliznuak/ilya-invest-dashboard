const formatters = new Map<number, Intl.NumberFormat>();

const formatterFor = (digits: number): Intl.NumberFormat => {
  let formatter = formatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatters.set(digits, formatter);
  }
  return formatter;
};

export const fmt = (value: number, digits = 3): string => formatterFor(digits).format(value);

export const percent = (value: number, digits = 3): string => `${fmt(value, digits)}%`;

/** Знак ставим сами: минус — типографский, как в исходном дашборде. */
export const signed = (value: number, digits = 3): string =>
  `${value >= 0 ? '+' : '−'}${fmt(Math.abs(value), digits)}%`;

export const dash = '—';

export const orDash = (value: number | null, render: (value: number) => string): string =>
  value === null ? dash : render(value);

/** Дата (день) из ISO datetime или голой даты. */
export const datePart = (iso: string | null): string | null => {
  if (!iso) return null;
  return iso.slice(0, 10);
};

export const formatDate = (iso: string | null): string => {
  const day = datePart(iso);
  if (!day) return dash;
  const [year, month, dayNum] = day.split('-');
  return `${dayNum}.${month}.${year}`;
};

export const formatDateTime = (iso: string | null): string => {
  if (!iso) return dash;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return formatDate(iso);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/** Короткий вариант для подписей оси: там не хватает места на полный год. */
export const formatShortDate = (iso: string): string => {
  const day = datePart(iso) ?? iso;
  const [year, month, dayNum] = day.split('-');
  return `${dayNum}.${month}.${year.slice(2)}`;
};

export const formatPeriod = (from: string | null, to: string | null): string => {
  if (!from || !to) return dash;
  const fromDay = datePart(from) ?? from;
  const toDay = datePart(to) ?? to;
  return fromDay === toDay ? formatDate(fromDay) : `${formatDate(fromDay)} — ${formatDate(toDay)}`;
};

export const pluralize = (count: number, forms: [string, string, string]): string => {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
};

/** Значение для input[type=datetime-local] в Europe/Moscow. */
export const toDatetimeLocalValue = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};

/** datetime-local → ISO с +03:00 (MSK). */
export const fromDatetimeLocalValue = (value: string): string | null => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00+03:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
    return `${value}+03:00`;
  }
  return value;
};
