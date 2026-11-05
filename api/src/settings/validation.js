import { badRequest } from '../errors.js';

const PRIVATE_LINK =
  /(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/c\/(\d+)(?:\/(\d+))?(?:\/(\d+))?/i;
const PUBLIC_LINK =
  /(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([A-Za-z][\w\d_]{3,})(?:\/(\d+))?/i;

const parseBool = (value, field) => {
  if (typeof value !== 'boolean') throw badRequest(`${field} должен быть boolean`);
  return value;
};

const parseCron = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest('cron обязателен');
  }
  const cron = value.trim();
  if (cron.length > 64) throw badRequest('cron слишком длинный');
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) {
    throw badRequest('cron должен быть в формате «м ч д мес день_недели», например 0 * * * *');
  }
  return cron;
};

const parseChatId = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw badRequest('chatId должен быть строкой или числом');
  }
  const chatId = String(value).trim();
  if (chatId.length > 128) throw badRequest('chatId длиннее 128 символов');
  return chatId;
};

const parseTopicId = (value, field = 'topicId') => {
  if (value === undefined || value === null || value === '') return null;
  const topicId = Number(value);
  if (
    !['string', 'number'].includes(typeof value) ||
    !Number.isInteger(topicId) || topicId < 1 || topicId > 2147483647
  ) {
    throw badRequest(`${field} должен быть целым числом от 1 до 2147483647`);
  }
  return topicId;
};

const parseTimezone = (value) => {
  if (value === undefined || value === null || value === '') return 'Europe/Moscow';
  if (typeof value !== 'string') throw badRequest('timezone должен быть строкой');
  const timezone = value.trim();
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw badRequest('Некорректный timezone');
  }
  return timezone;
};

const parseParseFrom = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('parseFrom должен быть строкой');
  const trimmed = value.trim();
  let candidate = trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    candidate = `${trimmed}T00:00:00+03:00`;
  }
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) throw badRequest('parseFrom должен быть ISO-датой/временем');
  return date.toISOString();
};

export function parseTgSyncSettingsInput(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Ожидается JSON-объект настроек');
  }

  return {
    enabled: parseBool(body.enabled, 'enabled'),
    cron: parseCron(body.cron),
    chatId: parseChatId(body.chatId),
    topicId: parseTopicId(body.topicId),
    secondTopicId: parseTopicId(body.secondTopicId, 'secondTopicId'),
    parseFrom: parseParseFrom(body.parseFrom),
    timezone: parseTimezone(body.timezone),
    rescanAll: parseBool(body.rescanAll, 'rescanAll'),
  };
}

export function parseTelegramLink(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    throw badRequest('Нужна ссылка Telegram');
  }
  const text = url.trim();

  const privateMatch = text.match(PRIVATE_LINK);
  if (privateMatch) {
    const internal = privateMatch[1];
    const second = privateMatch[2];
    const third = privateMatch[3];
    const chatId = `-100${internal}`;
    if (third) {
      return {
        chatId,
        topicId: Number(second),
        messageId: Number(third),
        kind: 'private_topic',
      };
    }
    if (second) {
      return {
        chatId,
        topicId: null,
        messageId: Number(second),
        kind: 'private',
      };
    }
    return { chatId, topicId: null, messageId: null, kind: 'private' };
  }

  const publicMatch = text.match(PUBLIC_LINK);
  if (publicMatch) {
    const username = publicMatch[1];
    if (['c', 's', 'addstickers', 'share', 'proxy', 'socks'].includes(username.toLowerCase())) {
      throw badRequest('Не похоже на ссылку на чат/сообщение');
    }
    return {
      chatId: `@${username}`,
      topicId: null,
      messageId: publicMatch[2] ? Number(publicMatch[2]) : null,
      kind: 'public',
    };
  }

  throw badRequest('Не удалось разобрать ссылку Telegram');
}
