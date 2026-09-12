#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${PROD_DB_SYNC_LAUNCHD_LABEL:-com.novell-reader.prod-db-sync}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HOUR="${PROD_DB_SYNC_DAILY_HOUR:-4}"
MINUTE="${PROD_DB_SYNC_DAILY_MINUTE:-0}"
LOG_DIR="$ROOT_DIR/local-db-dumps"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$LOG_DIR"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT_DIR/scripts/sync-prod-db.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>$HOUR</integer>
    <key>Minute</key>
    <integer>$MINUTE</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/prod-db-sync.launchd.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/prod-db-sync.launchd.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL"

echo "Installed daily prod DB sync: $PLIST"
echo "Schedule: $HOUR:$MINUTE"
