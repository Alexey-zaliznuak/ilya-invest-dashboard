import { createApp } from './app.js';
import { config } from './config.js';
import { applySchema, pool, waitForDatabase } from './db.js';

await waitForDatabase();
await applySchema();

const server = createApp().listen(config.port, () => {
  console.log(`API слушает порт ${config.port}`);
});

const shutdown = async (signal) => {
  console.log(`Получен ${signal}, останавливаюсь`);
  server.close();
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
