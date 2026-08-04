import { pool } from '../db.js';
import { conflict, notFound } from '../errors.js';

const UNIQUE_VIOLATION = '23505';

// trade_date отдаём строкой: драйвер превратил бы DATE в Date в локальной зоне
// и день мог бы съехать на сутки.
const COLUMNS = `id, seq, ticker, title, roe,
                 to_char(trade_date, 'YYYY-MM-DD') AS trade_date`;

const mapRow = (row) => ({
  id: Number(row.id),
  seq: Number(row.seq),
  ticker: row.ticker,
  title: row.title,
  roe: Number(row.roe),
  tradeDate: row.trade_date,
});

export async function listTrades() {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM trades ORDER BY seq, id`);
  return rows.map(mapRow);
}

async function nextSeq() {
  const { rows } = await pool.query('SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM trades');
  return Number(rows[0].seq);
}

export async function createTrade(input) {
  const seq = input.seq ?? (await nextSeq());
  const { rows } = await pool.query(
    `INSERT INTO trades (seq, ticker, title, roe, trade_date)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING ${COLUMNS}`,
    [seq, input.ticker, input.title, input.roe, input.tradeDate],
  );

  if (rows.length === 0) {
    throw conflict('Сделка с такой датой, тикером и ROE уже есть в базе');
  }
  return mapRow(rows[0]);
}

export async function updateTrade(id, input) {
  try {
    const { rows } = await pool.query(
      `UPDATE trades
          SET seq = COALESCE($2, seq),
              ticker = $3,
              title = $4,
              roe = $5,
              trade_date = $6,
              updated_at = now()
        WHERE id = $1
      RETURNING ${COLUMNS}`,
      [id, input.seq, input.ticker, input.title, input.roe, input.tradeDate],
    );

    if (rows.length === 0) throw notFound('Сделка не найдена');
    return mapRow(rows[0]);
  } catch (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw conflict('Сделка с такой датой, тикером и ROE уже есть в базе');
    }
    throw error;
  }
}

export async function deleteTrade(id) {
  const { rowCount } = await pool.query('DELETE FROM trades WHERE id = $1', [id]);
  if (rowCount === 0) throw notFound('Сделка не найдена');
}
