#!/usr/bin/env bash
# MONOLITH workspace entrypoint.
# 1) Seeds a project-scope opencode.json that points the OpenCode engine at the
#    MONOLITH LiteLLM gateway (a custom OpenAI-compatible provider), unless the
#    user already configured one.
# 2) Launches the OpenWork host (server + engine); UI is served at :8787/ui.
set -euo pipefail

WS="${OPENWORK_WORKSPACE:-/workspace}"
export CFG="$WS/opencode.json"
mkdir -p "$WS"

# Idempotently ensure the MONOLITH gateway provider + a sensible DEFAULT model are
# configured, without clobbering any other opencode.json settings. Making the local
# model the default stops the app from pushing users to OpenWork's cloud sign-in.
if [ -n "${MONOLITH_GATEWAY_URL:-}" ]; then
  echo "[monolith] ensuring OpenCode provider + default model -> $CFG (gateway: $MONOLITH_GATEWAY_URL)"
  node -e '
    const fs = require("fs");
    const p = process.env.CFG;
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
    cfg["$schema"] = "https://opencode.ai/config.json";
    cfg.provider = cfg.provider || {};
    cfg.provider.monolith = {
      npm: "@ai-sdk/openai-compatible",
      name: "MONOLITH Gateway",
      options: {
        baseURL: process.env.MONOLITH_GATEWAY_URL,
        apiKey: process.env.MONOLITH_GATEWAY_KEY || ""
      },
      // These ids must match the model_name aliases in litellm/config.yaml
      models: {
        "claude":      { name: "Claude (cloud)" },
        "gpt":         { name: "GPT (cloud)" },
        "gemini":      { name: "Gemini (cloud)" },
        "ollama-pool": { name: "Ollama Pool (round-robin)" },
        "local-qwen":  { name: "Qwen (local)" }
      }
    };
    // Default new sessions to the free local model (change to monolith/claude once a key is set).
    if (!cfg.model) cfg.model = process.env.MONOLITH_DEFAULT_MODEL || "monolith/local-qwen";
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  '
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

exec openwork serve \
  --workspace "$WS" \
  --remote-access \
  --openwork-port 8787 \
  --opencode-host 127.0.0.1 \
  --opencode-port 4096 \
  --connect-host "${OPENWORK_CONNECT_HOST:-127.0.0.1}" \
  --cors "*" \
  --approval "${OPENWORK_APPROVAL_MODE:-manual}" \
  --no-opencode-router
