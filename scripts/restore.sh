#!/usr/bin/env bash
# Restore a MONOLITH backup archive produced by backup.sh.
# Usage:  scripts/restore.sh backups/monolith-<timestamp>.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."

ARCHIVE="${1:?usage: scripts/restore.sh <backups/monolith-TIMESTAMP.tar.gz>}"
PROJECT="monolith"
VOLUMES=(openwork_workspace openwork_data litellm_pg ollama_models caddy_data)

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
tar xzf "$ARCHIVE" -C "$TMP"
DIR="$TMP/$(ls "$TMP" | head -1)"

echo "[restore] stopping stack (data volumes are preserved until overwritten)"
docker compose down

for v in "${VOLUMES[@]}"; do
  f="$DIR/${v}.tar.gz"
  [ -f "$f" ] || { echo "  - skip $v (not in archive)"; continue; }
  vol="${PROJECT}_${v}"
  echo "  - restoring $vol"
  docker volume create "$vol" >/dev/null
  docker run --rm -v "${vol}:/data" -v "$DIR:/backup:ro" alpine \
    sh -c "rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null; tar xzf /backup/${v}.tar.gz -C /data"
done

echo "[restore] done. Bring the stack back up:  docker compose up -d"
