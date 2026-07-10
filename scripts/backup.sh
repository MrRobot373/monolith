#!/usr/bin/env bash
# Back up ALL MONOLITH data (named volumes + .env) into one timestamped archive.
# Usage:  scripts/backup.sh            -> backups/monolith-<timestamp>.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="monolith"
VOLUMES=(openwork_workspace openwork_data litellm_pg ollama_models caddy_data)
TS="$(date +%Y%m%d-%H%M%S)"
STAGE="backups/${PROJECT}-${TS}"
mkdir -p "$STAGE"

echo "[backup] staging -> $STAGE"
for v in "${VOLUMES[@]}"; do
  vol="${PROJECT}_${v}"
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    echo "  - $vol"
    docker run --rm -v "${vol}:/data:ro" -v "$PWD/$STAGE:/backup" alpine \
      tar czf "/backup/${v}.tar.gz" -C /data . 2>/dev/null || echo "    (empty)"
  fi
done

[ -f .env ] && cp .env "$STAGE/env.backup"
ARCHIVE="backups/${PROJECT}-${TS}.tar.gz"
tar czf "$ARCHIVE" -C backups "${PROJECT}-${TS}"
rm -rf "$STAGE"
echo "[backup] done -> $ARCHIVE"
