#!/usr/bin/env bash
# MONOLITH workspace entrypoint.
# 1) Seeds a project-scope opencode.json that points the OpenCode engine at the
#    MONOLITH LiteLLM gateway (a custom OpenAI-compatible provider), unless the
#    user already configured one.
# 2) Launches the OpenWork host (server + engine); UI is served at :8787/ui.
set -euo pipefail

WS="${MONOLITH_WORKSPACE:-${OPENWORK_WORKSPACE:-/workspace}}"
export CFG="$WS/opencode.json"
mkdir -p "$WS"

# Ensure the MONOLITH gateway provider is configured with ONLY the models that
# answer a real completion right now (report #16 — a listed-but-dead model,
# e.g. a cloud model with no API key, or local-qwen before it's pulled, is
# worse than not listing it). Probing is cached 12h on the /data volume.
if [ -n "${MONOLITH_GATEWAY_URL:-}" ]; then
  echo "[monolith] probing OpenCode gateway models -> $CFG (gateway: $MONOLITH_GATEWAY_URL)"
  node /opt/monolith-seed/seed-models.mjs || echo "[warn] model probing failed (non-fatal); opencode.json left as-is"
fi

# Seed a web-reach skill so the agent knows it can reach the live web / content.
SKILL_DIR="$WS/.opencode/skills/web-reach"
if [ ! -f "$SKILL_DIR/SKILL.md" ]; then
  echo "[monolith] seeding web-reach skill -> $SKILL_DIR"
  mkdir -p "$SKILL_DIR"
  cat > "$SKILL_DIR/SKILL.md" <<'SKILL'
---
name: web-reach
description: Reach the live web and content platforms — fetch web pages, YouTube transcripts, RSS feeds, GitHub — whenever the user asks about current/online info or gives a URL. Run these via the Bash tool, then summarize and cite.
---

# Web reach

You can access online content directly from the terminal (no API keys needed):

- **Any web page (clean text):** `curl -s https://r.jina.ai/<FULL_URL>`  (Jina Reader returns readable markdown)
- **Raw fetch:** `curl -sL <URL>`
- **YouTube transcript / info:** `yt-dlp --skip-download --write-auto-sub --sub-lang en -o '%(id)s' <URL>` (or `yt-dlp --dump-json <URL>` for metadata)
- **RSS/Atom feeds:** `python3 -c "import feedparser,sys; f=feedparser.parse(sys.argv[1]); [print(e.title,'-',e.link) for e in f.entries[:10]]" <FEED_URL>`
- **GitHub:** fetch raw files via `curl -sL https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`.
- **Richer routing (if present):** `agent-reach doctor` then `agent-reach ...` for Reddit/X/etc.

Always summarize what you found and cite the source URLs.
SKILL
fi

# Seed product-managed domain agents (Legal/Finance/Health/Research/Code) + plugin
# skills into the workspace. Refreshed each boot; user-created files are left intact.
if [ -d /opt/monolith-seed/.opencode ]; then
  echo "[monolith] seeding domain agents + skills -> $WS/.opencode"
  mkdir -p "$WS/.opencode/agent" "$WS/.opencode/skills"
  cp -rf /opt/monolith-seed/.opencode/agent/.  "$WS/.opencode/agent/"  2>/dev/null || true
  cp -rf /opt/monolith-seed/.opencode/skills/. "$WS/.opencode/skills/" 2>/dev/null || true
fi

# Seed/refresh the MONOLITH answer-discipline block in AGENTS.md so the
# engine's DEFAULT (Cowork) agent gets the standing rules too. Managed between
# markers; user content outside the markers is always preserved.
AGENTS_MD="$WS/AGENTS.md"
DISCIPLINE_START="<!-- MONOLITH:answer-discipline:start -->"
DISCIPLINE_END="<!-- MONOLITH:answer-discipline:end -->"
DISCIPLINE_BLOCK=/opt/monolith-seed/agents-discipline.md
if [ -f "$DISCIPLINE_BLOCK" ]; then
  echo "[monolith] seeding answer-discipline block -> $AGENTS_MD"
  if [ -f "$AGENTS_MD" ] && grep -qF "$DISCIPLINE_START" "$AGENTS_MD"; then
    awk -v s="$DISCIPLINE_START" -v e="$DISCIPLINE_END" -v f="$DISCIPLINE_BLOCK" '
      $0==s { print; while ((getline line < f) > 0) print line; skip=1; next }
      $0==e { skip=0; print; next }
      !skip { print }' "$AGENTS_MD" > "$AGENTS_MD.tmp" && mv "$AGENTS_MD.tmp" "$AGENTS_MD"
  else
    { [ -s "$AGENTS_MD" ] && printf '\n'; printf '%s\n' "$DISCIPLINE_START"; cat "$DISCIPLINE_BLOCK"; printf '%s\n' "$DISCIPLINE_END"; } >> "$AGENTS_MD"
  fi
fi

# Engine: our own orchestrator (default) or the legacy prebuilt binary as a
# rollback path. Our orchestrator doesn't have a "remote access sharing link"
# concept (--remote-access/--connect-host were openwork's own cloud-sharing
# feature) — Caddy already owns exposure/auth for MONOLITH, so those flags
# have no equivalent here and aren't needed.
ENGINE_MODE="${MONOLITH_ENGINE:-own}"
if [ "$ENGINE_MODE" = "legacy" ]; then
  echo "[monolith] MONOLITH_ENGINE=legacy -> starting the legacy engine binary"
  # These --openwork-* flag names are the prebuilt legacy binary's own fixed
  # CLI contract — not ours to rename.
  exec openwork serve \
    --workspace "$WS" \
    --remote-access \
    --openwork-port 8787 \
    --opencode-host 127.0.0.1 \
    --opencode-port 4096 \
    --connect-host "${MONOLITH_CONNECT_HOST:-${OPENWORK_CONNECT_HOST:-127.0.0.1}}" \
    --cors "*" \
    --approval "${MONOLITH_APPROVAL_MODE:-${OPENWORK_APPROVAL_MODE:-manual}}" \
    --no-opencode-router
else
  echo "[monolith] starting the MONOLITH orchestrator (our own engine on vendored opencode)"
  export MONOLITH_PORT=8787
  # 0.0.0.0, not 127.0.0.1: other containers (Caddy, webui, monolith-server)
  # reach this over the Docker bridge network, which loopback can't answer.
  export MONOLITH_HOST="${MONOLITH_HOST:-0.0.0.0}"
  export MONOLITH_ENGINE_PORT=4096
  export MONOLITH_ENGINE_DIR="${MONOLITH_ENGINE_DIR:-/opt/engine/opencode}"
  export DATA_DIR="${MONOLITH_ORCH_DATA_DIR:-/data/orchestrator}"
  export MONOLITH_WORKSPACE="$WS"
  exec node /app/monolith-server/orchestrator.mjs
fi
