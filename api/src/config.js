const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана обязательная переменная окружения ${name}`);
  }
  return value;
};

const positiveNumber = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Переменная окружения ${name} должна быть положительным числом`);
  }
  return value;
};

export const config = {
  port: positiveNumber('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  admin: {
    login: required('ADMIN_LOGIN'),
    password: required('ADMIN_PASSWORD'),
  },
  session: {
    secret: required('SESSION_SECRET'),
    ttlMs: positiveNumber('SESSION_TTL_HOURS', 12) * 60 * 60 * 1000,
  },
};
