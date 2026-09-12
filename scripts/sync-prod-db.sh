#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROD_DB_SYNC_ENV_FILE:-$ROOT_DIR/.prod-db-sync.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

HOST="${PROD_DB_SYNC_HOST:-45.14.246.179}"
USER_NAME="${PROD_DB_SYNC_USER:-root}"
PASSWORD="${PROD_DB_SYNC_PASSWORD:-}"
OUTPUT_PATH="${PROD_DB_SYNC_OUTPUT:-local-db-dumps/prod.db}"
REMOTE_TMP_DIR="${PROD_DB_SYNC_REMOTE_TMP_DIR:-/tmp/novell-reader-prod-db-sync}"
KNOWN_HOSTS_FILE="${PROD_DB_SYNC_KNOWN_HOSTS_FILE:-$ROOT_DIR/.prod-db-sync-known-hosts}"
TIMEOUT_SECONDS="${PROD_DB_SYNC_TIMEOUT_SECONDS:-1800}"

if [[ -z "$PASSWORD" ]]; then
  echo "PROD_DB_SYNC_PASSWORD is required. Put it in $ENV_FILE." >&2
  exit 1
fi

if ! command -v expect >/dev/null 2>&1; then
  echo "expect is required for password-based SSH sync." >&2
  exit 1
fi

OUTPUT_ABS="$OUTPUT_PATH"
if [[ "$OUTPUT_ABS" != /* ]]; then
  OUTPUT_ABS="$ROOT_DIR/$OUTPUT_ABS"
fi

OUTPUT_DIR="$(dirname "$OUTPUT_ABS")"
mkdir -p "$OUTPUT_DIR"
find "$OUTPUT_DIR" -maxdepth 1 -type f -name ".prod.db.tmp.*" -delete

LOCK_DIR="$OUTPUT_DIR/.prod-db-sync.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Sync is already running: $LOCK_DIR" >&2
  exit 2
fi

TMP_FILE="$OUTPUT_DIR/.prod.db.tmp.$$"
TMP_ARCHIVE="$TMP_FILE.gz"
REMOTE_FILE="$REMOTE_TMP_DIR/prod.db"
REMOTE_ARCHIVE="$REMOTE_FILE.gz"
SSH_TARGET="$USER_NAME@$HOST"
SSH_OPTIONS=(
  -o "StrictHostKeyChecking=accept-new"
  -o "UserKnownHostsFile=$KNOWN_HOSTS_FILE"
)

run_with_password() {
  PROD_DB_SYNC_PASSWORD="$PASSWORD" expect "$ROOT_DIR/scripts/prod-db-sync.expect" "$TIMEOUT_SECONDS" "$@"
}

REMOTE_CLEANUP_SCRIPT="
rm -f '$REMOTE_FILE' '$REMOTE_ARCHIVE'
rmdir '$REMOTE_TMP_DIR' 2>/dev/null || true
"

cleanup() {
  rm -f "$TMP_FILE" "$TMP_ARCHIVE"
  rm -rf "$LOCK_DIR"
  run_with_password ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" "$REMOTE_CLEANUP_SCRIPT" >/dev/null 2>&1 || true
}

trap cleanup EXIT

REMOTE_PREPARE_SCRIPT="
set -e
mkdir -p '$REMOTE_TMP_DIR'
cid=\$(docker ps --filter 'label=com.docker.compose.service=novell-reader' --format '{{.ID}}' | head -n 1)
if [ -z \"\$cid\" ]; then
  cid=\$(docker ps --filter 'name=novell-reader' --format '{{.ID}}' | head -n 1)
fi
if [ -z \"\$cid\" ]; then
  echo 'novell-reader container not found' >&2
  exit 2
fi
data_dir=\$(docker inspect \"\$cid\" --format '{{range .Mounts}}{{if eq .Destination \"/app/data\"}}{{.Source}}{{end}}{{end}}')
if [ -z \"\$data_dir\" ]; then
  echo 'container /app/data mount not found' >&2
  exit 2
fi
source_db=\"\$data_dir/prod.db\"
test -s \"\$source_db\"
rm -f '$REMOTE_FILE' '$REMOTE_ARCHIVE'
sqlite3 \"\$source_db\" '.timeout 5000' '.backup $REMOTE_FILE'
test -s '$REMOTE_FILE'
gzip -c '$REMOTE_FILE' > '$REMOTE_ARCHIVE'
test -s '$REMOTE_ARCHIVE'
ls -lh '$REMOTE_FILE' '$REMOTE_ARCHIVE' >&2
"

echo "Preparing prod database on $HOST..."
run_with_password ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" "$REMOTE_PREPARE_SCRIPT"

echo "Copying prod database to $OUTPUT_ABS..."
rm -f "$TMP_FILE" "$TMP_ARCHIVE"
run_with_password scp "${SSH_OPTIONS[@]}" "$SSH_TARGET:$REMOTE_ARCHIVE" "$TMP_ARCHIVE"

if [[ ! -s "$TMP_ARCHIVE" ]]; then
  rm -f "$TMP_FILE" "$TMP_ARCHIVE"
  echo "Downloaded database archive is empty." >&2
  exit 3
fi

if ! gzip -dc "$TMP_ARCHIVE" > "$TMP_FILE"; then
  rm -f "$TMP_FILE" "$TMP_ARCHIVE"
  echo "Failed to unpack downloaded database archive." >&2
  exit 3
fi
rm -f "$TMP_ARCHIVE"

if [[ ! -s "$TMP_FILE" ]]; then
  rm -f "$TMP_FILE"
  echo "Unpacked database is empty." >&2
  exit 3
fi

rm -f "$OUTPUT_ABS"
mv "$TMP_FILE" "$OUTPUT_ABS"
chmod 600 "$OUTPUT_ABS"

BYTES="$(wc -c < "$OUTPUT_ABS" | tr -d ' ')"
echo "Synced prod database: $OUTPUT_ABS ($BYTES bytes)"
