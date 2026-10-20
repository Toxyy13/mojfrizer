#!/usr/bin/env bash
# Manual database export: bash scripts/backup.sh  ->  backups/mojfrizer-YYYY-MM-DD-HHMM.dump
# Needs pg_dump (PostgreSQL client tools) and DATABASE_URL_UNPOOLED (or DATABASE_URL) in the environment.
set -euo pipefail
url="${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}"
[ -n "$url" ] || { echo "Postavi DATABASE_URL_UNPOOLED (Neon -> Connect, bez 'pooler' u adresi)."; exit 1; }
mkdir -p backups
file="backups/mojfrizer-$(date +%F-%H%M).dump"
pg_dump --format=custom --no-owner --no-privileges "$url" --file "$file"
echo "Gotovo: $file (sadrži lične podatke, čuvaj ga privatno)"
