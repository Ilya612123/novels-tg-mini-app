#!/usr/bin/env bash
set -euo pipefail

if [[ "${SKIP_LOCAL_SQLITE_MIGRATION:-}" == "1" ]]; then
  echo "[dev] Local SQLite migration skipped by SKIP_LOCAL_SQLITE_MIGRATION=1"
  exit 0
fi

DATABASE_URL="${DATABASE_URL:-postgresql://novell_reader:novell_reader@localhost:5432/novell_reader?schema=public}"
PGDATABASE_URL="${PGDATABASE_URL:-${DATABASE_URL%%\?*}}"
MARKER_PATH="${LOCAL_SQLITE_MIGRATION_MARKER:-local-db-dumps/.dev-sqlite-to-postgres.migrated}"

source_path="${LOCAL_SQLITE_DATABASE_PATH:-}"
if [[ -z "$source_path" ]]; then
  if [[ -f "apps/server/prisma/dev.db" ]]; then
    source_path="apps/server/prisma/dev.db"
  elif [[ -f "local-db-dumps/prod.db" ]]; then
    source_path="local-db-dumps/prod.db"
  fi
fi

if [[ -z "$source_path" || ! -f "$source_path" ]]; then
  echo "[dev] No local SQLite database found to migrate"
  exit 0
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "[dev] sqlite3 is required to migrate $source_path" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[dev] psql is required to migrate $source_path" >&2
  exit 1
fi

if ! psql "$PGDATABASE_URL" -v ON_ERROR_STOP=1 -qAt -c "SELECT 1" >/dev/null 2>&1; then
  echo "[dev] PostgreSQL is not reachable with PGDATABASE_URL=$PGDATABASE_URL" >&2
  echo "[dev] Start local PostgreSQL and set DATABASE_URL/PGDATABASE_URL if needed." >&2
  exit 1
fi

if stat -f "%z:%m" "$source_path" >/dev/null 2>&1; then
  signature="$(cd "$(dirname "$source_path")" && pwd -P)/$(basename "$source_path"):$(stat -f "%z:%m" "$source_path")"
else
  signature="$(cd "$(dirname "$source_path")" && pwd -P)/$(basename "$source_path"):$(stat -c "%s:%Y" "$source_path")"
fi

if [[ "${FORCE_LOCAL_SQLITE_MIGRATION:-}" != "1" && -f "$MARKER_PATH" ]] && grep -Fxq "$signature" "$MARKER_PATH"; then
  echo "[dev] Local SQLite migration already applied for $source_path"
  exit 0
fi

echo "[dev] Migrating local SQLite database $source_path to PostgreSQL"
DATABASE_URL="$DATABASE_URL" \
PGDATABASE_URL="$PGDATABASE_URL" \
SQLITE_DATABASE_PATH="$source_path" \
  bash scripts/migrate-sqlite-to-postgres.sh

mkdir -p "$(dirname "$MARKER_PATH")"
printf '%s\n' "$signature" > "$MARKER_PATH"
echo "[dev] Local SQLite migration marker written to $MARKER_PATH"
