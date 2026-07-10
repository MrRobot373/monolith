#!/usr/bin/env bash
# Set the MONOLITH login credentials (regenerates the bcrypt hash in caddy/Caddyfile).
# Usage:  scripts/set-admin-password.sh <username> <password>
set -euo pipefail
cd "$(dirname "$0")/.."
U="${1:?usage: set-admin-password.sh <username> <password>}"
P="${2:?usage: set-admin-password.sh <username> <password>}"
HASH="$(docker run --rm caddy:2 caddy hash-password --plaintext "$P")"
node -e "const fs=require('fs');const f='caddy/Caddyfile';let s=fs.readFileSync(f,'utf8');s=s.replace(/basic_auth \{[\s\S]*?\n\t\}/, 'basic_auth {\n\t\t'+process.argv[1]+' '+process.argv[2]+'\n\t}');fs.writeFileSync(f,s);" "$U" "$HASH"
echo "Login set to user '$U'. Apply it:  docker compose restart caddy"
