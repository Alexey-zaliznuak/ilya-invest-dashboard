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

export const formatDate = (iso: string | null): string => {
  if (!iso) return dash;
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
};

/** Короткий вариант для подписей оси: там не хватает места на полный год. */
export const formatShortDate = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year.slice(2)}`;
};

export const formatPeriod = (from: string | null, to: string | null): string => {
  if (!from || !to) return dash;
  return from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`;
};

export const pluralize = (count: number, forms: [string, string, string]): string => {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
};
