# Контекст сборки — корень репозитория.
# slim, не alpine: telethon/psycopg binary колёса под musl часто отсутствуют.
FROM python:3.13-slim

WORKDIR /app/tg-sync
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY tg-sync/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY tg-sync/main.py ./
COPY tg-sync/tg_sync ./tg_sync

RUN mkdir -p /data/session /data/backups /data/work

ENTRYPOINT ["python", "main.py"]
CMD ["worker"]
