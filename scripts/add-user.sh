#!/usr/bin/env bash
# Provision an ISOLATED per-user OpenWork workspace.
#   - own backend container + own /workspace and /data volumes
#   - own LiteLLM virtual key with a monthly budget (per-user cost control)
#   - own web UI (baked with the user's subdomain) + own login
#   - a Caddy route on  http://<user>.<MONOLITH_BASE_DOMAIN>
#
# Usage:  scripts/add-user.sh <username> [monthly_budget_usd] [password]
set -euo pipefail
cd "$(dirname "$0")/.."

U="${1:?usage: scripts/add-user.sh <username> [budget_usd] [password]}"
BUDGET="${2:-20}"
PASS="${3:-}"
NET="monolith_default"

getenv() { grep -m1 "^$1=" .env | cut -d= -f2- | tr -d '\r'; }
OPENWORK_TOKEN="$(getenv OPENWORK_TOKEN)"
OPENWORK_HOST_TOKEN="$(getenv OPENWORK_HOST_TOKEN)"
LITELLM_MASTER_KEY="$(getenv LITELLM_MASTER_KEY)"
BASE="$(getenv MONOLITH_BASE_DOMAIN)"; BASE="${BASE:-localhost}"
HOST="${U}.${BASE}"

echo "[add-user] '$U'  ->  http://$HOST   (budget \$$BUDGET/mo)"

# 1) Per-user LiteLLM virtual key with a monthly budget.
KEY_JSON="$(docker run --rm --network "$NET" curlimages/curl:latest -s -X POST \
  http://litellm:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H "Content-Type: application/json" \
  -d "{\"max_budget\": $BUDGET, \"budget_duration\": \"30d\", \"key_alias\": \"user-$U\"}")"
KEY="$(printf '%s' "$KEY_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).key||'')}catch{}})")"
[ -n "$KEY" ] || { echo "  ! could not mint LiteLLM key: $KEY_JSON" >&2; exit 1; }
echo "  - gateway key minted (budget \$$BUDGET / 30d)"

# 2) Per-user backend container (isolated workspace + data).
docker rm -f "monolith-ws-$U" >/dev/null 2>&1 || true
docker run -d --name "monolith-ws-$U" --network "$NET" --restart unless-stopped \
  -v "openwork_ws_$U:/workspace" -v "openwork_data_$U:/data" \
  -e OPENWORK_WORKSPACE=/workspace \
  -e OPENWORK_DATA_DIR=/data/openwork-orchestrator -e OPENWORK_SIDECAR_DIR=/data/sidecars \
  -e OPENWORK_TOKEN="$OPENWORK_TOKEN" -e OPENWORK_HOST_TOKEN="$OPENWORK_HOST_TOKEN" \
  -e OPENWORK_APPROVAL_MODE=manual \
  -e MONOLITH_GATEWAY_URL="http://litellm:4000/v1" -e MONOLITH_GATEWAY_KEY="$KEY" \
  monolith-openwork-host >/dev/null
echo "  - backend container: monolith-ws-$U"

# 3) Per-user web UI baked with the user's subdomain (same-origin API).
echo "  - building web UI (baked for http://$HOST) ..."
docker build -q -t "monolith-webui-$U" -f webui/Dockerfile \
  --build-arg VITE_OPENWORK_URL="http://$HOST" \
  --build-arg VITE_OPENWORK_TOKEN="$OPENWORK_TOKEN" \
  --build-arg VITE_OPENWORK_HOST_TOKEN="$OPENWORK_HOST_TOKEN" . >/dev/null
docker rm -f "monolith-webui-c-$U" >/dev/null 2>&1 || true
docker run -d --name "monolith-webui-c-$U" --network "$NET" --restart unless-stopped "monolith-webui-$U" >/dev/null
echo "  - web UI container: monolith-webui-c-$U"

# 4) Per-user login + Caddy route.
[ -n "$PASS" ] || PASS="$U-$(node -e "console.log(require('crypto').randomBytes(3).toString('hex'))")"
HASH="$(docker run --rm caddy:2 caddy hash-password --plaintext "$PASS")"
mkdir -p caddy/users
cat > "caddy/users/${U}.caddy" <<EOF
http://${HOST} {
	header {
		-Server
		X-Content-Type-Options nosniff
	}
	@api path /health* /workspaces* /workspace/* /opencode/* /event* /files* /session* /host/*
	handle @api {
		reverse_proxy monolith-ws-${U}:8787
	}
	handle {
		basic_auth {
			${U} ${HASH}
		}
		reverse_proxy monolith-webui-c-${U}:80
	}
}
EOF
docker restart monolith-caddy-1 >/dev/null 2>&1 || true

echo "[add-user] done."
echo "  URL:   http://$HOST"
echo "  Login: $U / $PASS"
