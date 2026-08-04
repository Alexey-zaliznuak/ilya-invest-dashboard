# Контекст сборки — корень репозитория: скрипту нужен ещё и db/schema.sql.
# Образ на slim, а не alpine: у psycopg[binary] нет колёс под musl.
FROM python:3.13-slim

WORKDIR /app/seed
ENV PYTHONUNBUFFERED=1

COPY seed/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY db/schema.sql /app/db/schema.sql
COPY seed/seed_trades.py seed/trades.json ./

USER nobody
ENTRYPOINT ["python", "seed_trades.py"]
