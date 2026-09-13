#!/usr/bin/env bash
set -euo pipefail

SQLITE_DATABASE_PATH="${SQLITE_DATABASE_PATH:-/app/data/prod.db}"
PGDATABASE_URL="${PGDATABASE_URL:-${DATABASE_URL:-}}"

if [[ -z "$PGDATABASE_URL" ]]; then
  echo "PGDATABASE_URL or DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ "$PGDATABASE_URL" == *\?* ]]; then
    export DATABASE_URL="${PGDATABASE_URL}&schema=public"
  else
    export DATABASE_URL="${PGDATABASE_URL}?schema=public"
  fi
fi

if [[ ! -f "$SQLITE_DATABASE_PATH" ]]; then
  echo "SQLite database not found at $SQLITE_DATABASE_PATH" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

tables=(
  TelegramUser
  Book
  Chapter
  ReadingProgress
  UserAccess
  Payment
  AnalyticsEvent
  BotStartEvent
  TelegramAdsSnapshot
  TelegramAdMetric
  TelegramAdActionDelta
  UserAttribution
  PaywallWinbackImpression
)

echo "Preparing PostgreSQL schema"
pnpm --filter @novell-reader/server exec prisma db push

sqlite_datetime_expr() {
  local column="$1"
  printf 'CASE WHEN "%s" IS NULL THEN NULL WHEN typeof("%s") IN ('\''integer'\'','\''real'\'') THEN strftime('\''%%Y-%%m-%%d %%H:%%M:%%f'\'', "%s" / 1000.0, '\''unixepoch'\'') ELSE "%s" END AS "%s"' \
    "$column" "$column" "$column" "$column" "$column"
}

export_table() {
  local table="$1"
  local query

  case "$table" in
    TelegramUser)
      query="SELECT \"id\", \"username\", \"firstName\", \"lastName\", $(sqlite_datetime_expr createdAt), $(sqlite_datetime_expr updatedAt) FROM \"$table\";"
      ;;
    Book)
      query="SELECT \"id\", \"title\", \"author\", \"description\", \"tagsJson\", \"coverPath\", \"chapterCount\", \"freeChapterLimit\", \"sourceEpubFile\", \"status\", $(sqlite_datetime_expr createdAt), $(sqlite_datetime_expr updatedAt) FROM \"$table\";"
      ;;
    Chapter)
      query="SELECT \"id\", \"bookId\", \"number\", \"title\", \"contentPath\", \"wordCount\" FROM \"$table\";"
      ;;
    ReadingProgress)
      query="SELECT \"id\", \"userId\", \"bookId\", \"chapterNumber\", \"position\", \"percent\", $(sqlite_datetime_expr startedAt), $(sqlite_datetime_expr updatedAt) FROM \"$table\";"
      ;;
    UserAccess)
      query="SELECT \"userId\", $(sqlite_datetime_expr subscriptionUntil), $(sqlite_datetime_expr updatedAt) FROM \"$table\";"
      ;;
    Payment)
      query="SELECT \"id\", \"userId\", \"providerPayload\", \"planId\", \"starsAmount\", \"accessDays\", \"status\", \"rawPayload\", $(sqlite_datetime_expr createdAt), $(sqlite_datetime_expr paidAt) FROM \"$table\";"
      ;;
    AnalyticsEvent)
      query="SELECT \"id\", \"userId\", \"username\", \"source\", \"label\", \"metadata\", $(sqlite_datetime_expr occurredAt), $(sqlite_datetime_expr flushedAt) FROM \"$table\";"
      ;;
    BotStartEvent)
      query="SELECT \"id\", \"userId\", \"username\", $(sqlite_datetime_expr occurredAt), \"isFirstStart\" FROM \"$table\";"
      ;;
    TelegramAdsSnapshot)
      query="SELECT \"id\", $(sqlite_datetime_expr collectedAt), \"status\", \"errorMessage\", \"rawPayload\" FROM \"$table\";"
      ;;
    TelegramAdMetric)
      query="SELECT \"id\", \"snapshotId\", \"adKey\", \"adTitle\", \"views\", \"clicks\", \"actions\", \"spent\" FROM \"$table\";"
      ;;
    TelegramAdActionDelta)
      query="SELECT \"id\", \"adKey\", \"adTitle\", \"delta\", $(sqlite_datetime_expr observedFrom), $(sqlite_datetime_expr observedTo), \"fromSnapshotId\", \"toSnapshotId\" FROM \"$table\";"
      ;;
    UserAttribution)
      query="SELECT \"id\", \"userId\", \"botStartEventId\", \"status\", \"primarySource\", \"candidatesJson\", $(sqlite_datetime_expr matchedWindowFrom), $(sqlite_datetime_expr matchedWindowTo), $(sqlite_datetime_expr createdAt) FROM \"$table\";"
      ;;
    PaywallWinbackImpression)
      query="SELECT \"id\", \"userId\", \"offerId\", $(sqlite_datetime_expr shownAt) FROM \"$table\";"
      ;;
    *)
      echo "No export query configured for $table" >&2
      exit 1
      ;;
  esac

  sqlite3 "$SQLITE_DATABASE_PATH" <<SQL
.headers on
.mode csv
.once $tmp_dir/$table.csv
$query
SQL
}

echo "Exporting SQLite tables from $SQLITE_DATABASE_PATH"
for table in "${tables[@]}"; do
  export_table "$table"
done

echo "Importing rows into PostgreSQL"
psql "$PGDATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
TRUNCATE TABLE
  "PaywallWinbackImpression",
  "UserAttribution",
  "TelegramAdActionDelta",
  "TelegramAdMetric",
  "TelegramAdsSnapshot",
  "BotStartEvent",
  "AnalyticsEvent",
  "Payment",
  "UserAccess",
  "ReadingProgress",
  "Chapter",
  "Book",
  "TelegramUser"
RESTART IDENTITY CASCADE;
\\copy "TelegramUser" ("id","username","firstName","lastName","createdAt","updatedAt") FROM '$tmp_dir/TelegramUser.csv' WITH (FORMAT csv, HEADER true)
\\copy "Book" ("id","title","author","description","tagsJson","coverPath","chapterCount","freeChapterLimit","sourceEpubFile","status","createdAt","updatedAt") FROM '$tmp_dir/Book.csv' WITH (FORMAT csv, HEADER true)
\\copy "Chapter" ("id","bookId","number","title","contentPath","wordCount") FROM '$tmp_dir/Chapter.csv' WITH (FORMAT csv, HEADER true)
\\copy "ReadingProgress" ("id","userId","bookId","chapterNumber","position","percent","startedAt","updatedAt") FROM '$tmp_dir/ReadingProgress.csv' WITH (FORMAT csv, HEADER true)
\\copy "UserAccess" ("userId","subscriptionUntil","updatedAt") FROM '$tmp_dir/UserAccess.csv' WITH (FORMAT csv, HEADER true)
\\copy "Payment" ("id","userId","providerPayload","planId","starsAmount","accessDays","status","rawPayload","createdAt","paidAt") FROM '$tmp_dir/Payment.csv' WITH (FORMAT csv, HEADER true)
\\copy "AnalyticsEvent" ("id","userId","username","source","label","metadata","occurredAt","flushedAt") FROM '$tmp_dir/AnalyticsEvent.csv' WITH (FORMAT csv, HEADER true)
\\copy "BotStartEvent" ("id","userId","username","occurredAt","isFirstStart") FROM '$tmp_dir/BotStartEvent.csv' WITH (FORMAT csv, HEADER true)
\\copy "TelegramAdsSnapshot" ("id","collectedAt","status","errorMessage","rawPayload") FROM '$tmp_dir/TelegramAdsSnapshot.csv' WITH (FORMAT csv, HEADER true)
\\copy "TelegramAdMetric" ("id","snapshotId","adKey","adTitle","views","clicks","actions","spent") FROM '$tmp_dir/TelegramAdMetric.csv' WITH (FORMAT csv, HEADER true)
\\copy "TelegramAdActionDelta" ("id","adKey","adTitle","delta","observedFrom","observedTo","fromSnapshotId","toSnapshotId") FROM '$tmp_dir/TelegramAdActionDelta.csv' WITH (FORMAT csv, HEADER true)
\\copy "UserAttribution" ("id","userId","botStartEventId","status","primarySource","candidatesJson","matchedWindowFrom","matchedWindowTo","createdAt") FROM '$tmp_dir/UserAttribution.csv' WITH (FORMAT csv, HEADER true)
\\copy "PaywallWinbackImpression" ("id","userId","offerId","shownAt") FROM '$tmp_dir/PaywallWinbackImpression.csv' WITH (FORMAT csv, HEADER true)
COMMIT;
SQL

echo "SQLite to PostgreSQL migration complete"
