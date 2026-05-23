#!/bin/sh

if [ -f /data/data.sqlite ]; then
    cp /data/data.sqlite /tmp/data.sqlite
fi

export SCRAPER_DB_FILE=/tmp/data.sqlite

/app/.venv/bin/python /app/scraper.py
exit_code=$?

if [ "$exit_code" -eq 0 ]; then
    cp /tmp/data.sqlite /data/data.sqlite
fi

exit "$exit_code"
