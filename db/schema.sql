-- Схема хранилища сделок.
-- Файл идемпотентный: применяется при инициализации контейнера Postgres,
-- при старте API и питоновским скриптом сидирования.

CREATE TABLE IF NOT EXISTS trades (
    id         BIGSERIAL PRIMARY KEY,
    seq        INTEGER       NOT NULL,
    ticker     TEXT          NOT NULL,
    title      TEXT          NOT NULL DEFAULT '',
    roe        NUMERIC(12, 4) NOT NULL,
    trade_date DATE,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Сделка уникальна по тройке (дата, тикер, ROE). Даты у части исторических
-- фиксаций нет, поэтому NULL сводится к сентинелу — иначе Postgres считал бы
-- каждую строку с NULL уникальной и дубликаты проходили бы в таблицу.
CREATE UNIQUE INDEX IF NOT EXISTS trades_natural_key_idx
    ON trades (COALESCE(trade_date, '0001-01-01'::date), ticker, roe);

CREATE INDEX IF NOT EXISTS trades_seq_idx ON trades (seq, id);
