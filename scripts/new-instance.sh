#!/usr/bin/env bash
# Provision a fresh MONOLITH instance for a new client/org:
# generates a .env with strong random secrets from .env.example.
# Usage:  scripts/new-instance.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo "Refusing to overwrite existing .env. Move it aside first for a fresh instance." >&2
  exit 1
fi
cp .env.example .env

gen() { node -e "console.log(require('crypto').randomBytes(${1:-24}).toString('hex'))"; }
set_kv() { # key value  — replace the KEY=... line in .env
  local k="$1" v="$2"
  if grep -q "^${k}=" .env; then
    node -e "const fs=require('fs');const f='.env';let s=fs.readFileSync(f,'utf8');s=s.replace(new RegExp('^'+process.argv[1]+'=.*','m'),process.argv[1]+'='+process.argv[2]);fs.writeFileSync(f,s)" "$k" "$v"
  else
    echo "${k}=${v}" >> .env
  fi
}

set_kv MONOLITH_TOKEN       "$(gen 24)"
set_kv MONOLITH_HOST_TOKEN  "$(gen 24)"
set_kv LITELLM_MASTER_KEY   "sk-$(gen 24)"
set_kv LITELLM_SALT_KEY     "$(gen 24)"
set_kv LITELLM_DB_PASSWORD  "$(gen 18)"

echo "[new-instance] .env created with fresh secrets."
echo "Next:"
echo "  1) add a provider key in .env (ANTHROPIC_API_KEY or GEMINI_API_KEY)"
echo "  2) set MONOLITH_SITE_ADDRESS=your.domain for HTTPS (or leave :80 for local)"
echo "  3) docker compose up -d --build"
