# MONOLITH workspace image — our OWN orchestrator on vendored opencode (MIT),
# not the closed prebuilt openwork-orchestrator binary. One container serves a
# full, working OpenWork workspace UI at :8787/ui.
# MONOLITH_ENGINE=legacy (entrypoint.sh) can still fall back to the old
# openwork-orchestrator binary installed below, kept as a rollback path for one
# release per the independence-program plan — not used by default.
FROM node:22-bookworm-slim

# Legacy-fallback pin only; MONOLITH_ENGINE=own (the default) ignores this.
ARG MONOLITH_LEGACY_ENGINE_VERSION=0.17.8
# Pinned opencode release we vendor from source (MIT, github.com/sst/opencode).
ARG MONOLITH_ENGINE_VERSION=v1.18.10

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl git tar unzip \
 && rm -rf /var/lib/apt/lists/*

# Legacy-fallback binary (best-effort — MONOLITH_ENGINE=own never touches this).
RUN npm install -g "openwork-orchestrator@${MONOLITH_LEGACY_ENGINE_VERSION}" \
 || echo "[warn] legacy engine install failed (non-fatal; MONOLITH_ENGINE=own doesn't need it)"

# Our own engine: bun + opencode vendored from source (same recipe as
# native/setup.mjs). --ignore-scripts skips node-gyp native-module builds the
# server doesn't need (mirrors a real Windows dev-time gotcha; harmless here too).
RUN npm install -g bun
RUN git clone --depth 1 --branch "${MONOLITH_ENGINE_VERSION}" https://github.com/sst/opencode /opt/engine/opencode \
 && cd /opt/engine/opencode \
 && bun install --ignore-scripts

# Our orchestrator (monolith-server/orchestrator.mjs + orchestrator/*.mjs).
COPY monolith-server/orchestrator.mjs /app/monolith-server/orchestrator.mjs
COPY monolith-server/orchestrator/ /app/monolith-server/orchestrator/

# --- Phase 3: agent capabilities --------------------------------------------
# open-claude-code: a Claude Code-compatible coding agent (available as a CLI).
RUN npm install -g @ruvnet/open-claude-code || echo "[warn] open-claude-code install failed (non-fatal)"

# Web-reach tools for the agent (web pages, YouTube transcripts, RSS, GitHub).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip git ffmpeg \
 && rm -rf /var/lib/apt/lists/*
# Reliable, keyless fetch tools (guaranteed):
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp feedparser
# Agent-Reach (not on PyPI; install from git). Best-effort — the tools above remain if it fails.
RUN pip3 install --no-cache-dir --break-system-packages \
      "git+https://github.com/Panniantong/agent-reach.git" \
    || echo "[warn] agent-reach git install failed; yt-dlp/feedparser web-reach still available"
# ----------------------------------------------------------------------------

ENV MONOLITH_ENGINE_DATA_DIR=/data/orchestrator \
    MONOLITH_SIDECAR_DIR=/data/sidecars \
    MONOLITH_WORKSPACE=/workspace

# --- Phase 5: domain agents + skills (seeded into each workspace on boot) ----
# Agent personas (Chat/Research/Code) come from the repo.
COPY workspace-image/seed/ /opt/monolith-seed/
COPY workspace-image/seed-models.mjs /opt/monolith-seed/seed-models.mjs
# Tools guide Tier 3/4: the built-in web-search MCP server + the MCP catalog
# module (for reading the sidecar's per-user enabled-servers store). Shared
# source with the native path — copied, not duplicated by hand.
COPY native/mcp/web-tools.mjs /opt/monolith-seed/mcp/web-tools.mjs
COPY monolith-server/mcp-catalog.mjs /opt/monolith-seed/mcp-catalog.mjs
COPY monolith-server/mcp-catalog-data.mjs /opt/monolith-seed/mcp-catalog-data.mjs
# ----------------------------------------------------------------------------

EXPOSE 8787
VOLUME ["/workspace", "/data"]

COPY workspace-image/entrypoint.sh /usr/local/bin/monolith-entrypoint
RUN chmod +x /usr/local/bin/monolith-entrypoint

ENTRYPOINT ["/usr/local/bin/monolith-entrypoint"]
