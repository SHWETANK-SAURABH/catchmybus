#!/usr/bin/env sh
# Daily database backup (NFR12). Keeps the last 7 dumps in ./backups.
#
#   sh scripts/backup.sh                 # run once
#   crontab: 0 2 * * * cd /path/to/catchmybus && sh scripts/backup.sh
#
# Postgres (docker-compose): pg_dump inside the db container.
# SQLite (DATABASE_URL=sqlite:///...): copies the database file.
set -eu

cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env
BACKUP_DIR=${BACKUP_DIR:-backups}
KEEP=${BACKUP_KEEP:-7}
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

case "${DATABASE_URL:-}" in
  sqlite*)
    DB_FILE="backend/${DATABASE_URL#sqlite:///./}"
    cp "$DB_FILE" "$BACKUP_DIR/catchmybus-$STAMP.db"
    OUT="$BACKUP_DIR/catchmybus-$STAMP.db"
    ;;
  *)
    OUT="$BACKUP_DIR/catchmybus-$STAMP.sql.gz"
    docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT"
    ;;
esac
echo "backup written: $OUT"

# Rotate: keep only the newest $KEEP backups.
ls -1t "$BACKUP_DIR"/catchmybus-* 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old" && echo "removed old backup: $old"
done
