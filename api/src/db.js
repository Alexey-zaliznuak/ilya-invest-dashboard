import { readFile } from 'node:fs/promises';
import pg from 'pg';

import { config } from './config.js';

const SCHEMA_PATH = new URL('../../db/schema.sql', import.meta.url);

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForDatabase({ attempts = 30, delayMs = 1000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`База недоступна (попытка ${attempt}/${attempts}): ${error.message}`);
      await sleep(delayMs);
    }
  }
}

export async function applySchema() {
  const sql = await readFile(SCHEMA_PATH, 'utf8');
  await pool.query(sql);
}
