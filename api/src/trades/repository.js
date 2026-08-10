import { pool } from '../db.js';
import { conflict, notFound } from '../errors.js';

const UNIQUE_VIOLATION = '23505';

// timestamptz отдаём ISO-строкой в UTC, чтобы фронт не зависел от TZ сервера.
const COLUMNS = `id, ticker, title, roe,
                 CASE
                   WHEN trade_datetime IS NULL THEN NULL
                   ELSE to_char(trade_datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                 END AS trade_datetime`;

const mapRow = (row) => ({
  id: Number(row.id),
  ticker: row.ticker,
  title: row.title,
  roe: Number(row.roe),
  tradeDatetime: row.trade_datetime,
});

export async function listTrades() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM trades ORDER BY trade_datetime NULLS FIRST, id`,
  );
  return rows.map(mapRow);
}

export async function createTrade(input) {
  const { rows } = await pool.query(
    `INSERT INTO trades (ticker, title, roe, trade_datetime)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING ${COLUMNS}`,
    [input.ticker, input.title, input.roe, input.tradeDatetime],
  );

  if (rows.length === 0) {
    throw conflict('Сделка с такими датой/временем, тикером и ROE уже есть в базе');
  }
  return mapRow(rows[0]);
}

export async function updateTrade(id, input) {
  try {
    const { rows } = await pool.query(
      `UPDATE trades
          SET ticker = $2,
              title = $3,
              roe = $4,
              trade_datetime = $5,
              updated_at = now()
        WHERE id = $1
      RETURNING ${COLUMNS}`,
      [id, input.ticker, input.title, input.roe, input.tradeDatetime],
    );

    if (rows.length === 0) throw notFound('Сделка не найдена');
    return mapRow(rows[0]);
  } catch (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw conflict('Сделка с такими датой/временем, тикером и ROE уже есть в базе');
    }
    throw error;
  }
}

export async function deleteTrade(id) {
  const { rowCount } = await pool.query('DELETE FROM trades WHERE id = $1', [id]);
  if (rowCount === 0) throw notFound('Сделка не найдена');
}
