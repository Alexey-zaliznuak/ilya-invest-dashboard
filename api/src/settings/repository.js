import { pool } from '../db.js';

const COLUMNS = `
  enabled,
  cron,
  chat_id,
  topic_id,
  CASE
    WHEN parse_from IS NULL THEN NULL
    ELSE to_char(parse_from AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  END AS parse_from,
  timezone,
  rescan_all,
  run_requested,
  CASE
    WHEN last_run_at IS NULL THEN NULL
    ELSE to_char(last_run_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  END AS last_run_at,
  last_run_status,
  last_run_error,
  last_run_stats,
  last_run_log,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
`;

const mapLog = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    at: typeof item?.at === 'string' ? item.at : '',
    level: typeof item?.level === 'string' ? item.level : 'info',
    message: typeof item?.message === 'string' ? item.message : String(item ?? ''),
  }));
};

const mapRow = (row) => ({
  enabled: row.enabled,
  cron: row.cron,
  chatId: row.chat_id,
  topicId: row.topic_id === null || row.topic_id === undefined ? null : Number(row.topic_id),
  parseFrom: row.parse_from,
  timezone: row.timezone,
  rescanAll: row.rescan_all,
  runRequested: row.run_requested,
  lastRunAt: row.last_run_at,
  lastRunStatus: row.last_run_status,
  lastRunError: row.last_run_error,
  lastRunStats: row.last_run_stats ?? {},
  lastRunLog: mapLog(row.last_run_log),
  updatedAt: row.updated_at,
});

export async function getTgSyncSettings() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM tg_sync_settings WHERE id = 1`,
  );
  if (rows.length === 0) {
    await pool.query(`INSERT INTO tg_sync_settings (id) VALUES (1) ON CONFLICT DO NOTHING`);
    const retry = await pool.query(`SELECT ${COLUMNS} FROM tg_sync_settings WHERE id = 1`);
    return mapRow(retry.rows[0]);
  }
  return mapRow(rows[0]);
}

export async function updateTgSyncSettings(input) {
  const { rows } = await pool.query(
    `UPDATE tg_sync_settings
        SET enabled = $1,
            cron = $2,
            chat_id = $3,
            topic_id = $4,
            parse_from = $5,
            timezone = $6,
            rescan_all = $7,
            updated_at = now()
      WHERE id = 1
      RETURNING ${COLUMNS}`,
    [
      input.enabled,
      input.cron,
      input.chatId,
      input.topicId,
      input.parseFrom,
      input.timezone,
      input.rescanAll,
    ],
  );
  return mapRow(rows[0]);
}

export async function requestTgSyncRun() {
  const { rows } = await pool.query(
    `UPDATE tg_sync_settings
        SET run_requested = true,
            updated_at = now()
      WHERE id = 1
      RETURNING ${COLUMNS}`,
  );
  return mapRow(rows[0]);
}

const mapMessageTrade = (raw) => ({
  ticker: typeof raw?.ticker === 'string' ? raw.ticker : '',
  title: typeof raw?.title === 'string' ? raw.title : '',
  roe: typeof raw?.roe === 'number' ? raw.roe : Number(raw?.roe ?? 0),
});

const mapRunMessage = (raw) => ({
  id: Number(raw?.id ?? 0),
  datetime: typeof raw?.datetime === 'string' ? raw.datetime : '',
  text: typeof raw?.text === 'string' ? raw.text : '',
  edited: Boolean(raw?.edited),
  trades: Array.isArray(raw?.trades) ? raw.trades.map(mapMessageTrade) : undefined,
});

export async function getTgSyncMessages() {
  const { rows } = await pool.query(
    `SELECT last_run_messages FROM tg_sync_settings WHERE id = 1`,
  );
  const raw = rows[0]?.last_run_messages ?? {};
  const used = Array.isArray(raw.used) ? raw.used.map(mapRunMessage) : [];
  const unused = Array.isArray(raw.unused) ? raw.unused.map(mapRunMessage) : [];
  return { used, unused };
}
