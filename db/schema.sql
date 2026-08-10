-- Схема хранилища сделок и настроек tg-sync.
-- Файл идемпотентный: применяется при инициализации контейнера Postgres,
-- при старте API и питоновским скриптом сидирования.

CREATE TABLE IF NOT EXISTS trades (
    id              BIGSERIAL PRIMARY KEY,
    ticker          TEXT           NOT NULL,
    title           TEXT           NOT NULL DEFAULT '',
    roe             NUMERIC(12, 4) NOT NULL,
    trade_datetime  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Миграция со старой схемы (seq + trade_date → trade_datetime).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'trades'
       AND column_name = 'trade_date'
  ) THEN
    ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_datetime TIMESTAMPTZ;
    UPDATE trades
       SET trade_datetime = (trade_date::timestamp AT TIME ZONE 'Europe/Moscow')
     WHERE trade_date IS NOT NULL
       AND trade_datetime IS NULL;
    DROP INDEX IF EXISTS trades_natural_key_idx;
    DROP INDEX IF EXISTS trades_seq_idx;
    ALTER TABLE trades DROP COLUMN IF EXISTS trade_date;
    ALTER TABLE trades DROP COLUMN IF EXISTS seq;
  END IF;
END $$;

-- Сделка уникальна по тройке (момент, тикер, ROE). NULL сводится к -infinity,
-- иначе Postgres считал бы каждую строку с NULL уникальной.
DROP INDEX IF EXISTS trades_natural_key_idx;
CREATE UNIQUE INDEX trades_natural_key_idx
    ON trades (COALESCE(trade_datetime, '-infinity'::timestamptz), ticker, roe);

DROP INDEX IF EXISTS trades_seq_idx;
CREATE INDEX IF NOT EXISTS trades_datetime_idx
    ON trades (trade_datetime NULLS FIRST, id);

-- Настройки автосбора из Telegram (одна строка).
CREATE TABLE IF NOT EXISTS tg_sync_settings (
    id               SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled          BOOLEAN      NOT NULL DEFAULT false,
    cron             TEXT         NOT NULL DEFAULT '0 * * * *',
    chat_id          TEXT         NOT NULL DEFAULT '',
    topic_id         INTEGER,
    parse_from       TIMESTAMPTZ,
    timezone         TEXT         NOT NULL DEFAULT 'Europe/Moscow',
    rescan_all       BOOLEAN      NOT NULL DEFAULT false,
    run_requested    BOOLEAN      NOT NULL DEFAULT false,
    last_run_at      TIMESTAMPTZ,
    last_run_status  TEXT         NOT NULL DEFAULT 'idle',
    last_run_error   TEXT         NOT NULL DEFAULT '',
    last_run_stats   JSONB        NOT NULL DEFAULT '{}'::jsonb,
    last_run_log     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    last_run_messages JSONB       NOT NULL DEFAULT '{"used":[],"unused":[]}'::jsonb,
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE tg_sync_settings ADD COLUMN IF NOT EXISTS topic_id INTEGER;
ALTER TABLE tg_sync_settings ADD COLUMN IF NOT EXISTS last_run_log JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tg_sync_settings ADD COLUMN IF NOT EXISTS last_run_messages JSONB NOT NULL DEFAULT '{"used":[],"unused":[]}'::jsonb;

INSERT INTO tg_sync_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
