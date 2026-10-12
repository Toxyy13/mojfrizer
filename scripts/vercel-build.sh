#!/usr/bin/env bash
# Build command on Vercel (package.json "vercel-build").
# Only the production deployment touches the database: preview builds of unmerged branches
# must not apply their migrations to the shared database.
set -euo pipefail

npx prisma generate

if [ "${VERCEL_ENV:-}" = "production" ]; then
  # Migrations need a direct (unpooled) connection; Neon on Vercel provides DATABASE_URL_UNPOOLED.
  export MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
  DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy
  DATABASE_URL="$MIGRATE_URL" npx prisma db seed
fi

npx next build
