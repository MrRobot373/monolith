# MONOLITH workspace image — extends OpenWork's MIT-licensed orchestrator container.
# One container serves a full, working OpenWork workspace UI at :8787/ui.
# (Runtime uses the published `openwork-orchestrator` npm package — no fork needed
#  for Phase 1. Branding that changes the UI itself comes later and builds from source.)
FROM node:22-bookworm-slim

# Pinned to the current published `latest` on npm (matches OpenWork app 0.17.8).
ARG OPENWORK_ORCHESTRATOR_VERSION=0.17.8

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl git tar unzip \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g "openwork-orchestrator@${OPENWORK_ORCHESTRATOR_VERSION}"

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

ENV OPENWORK_DATA_DIR=/data/openwork-orchestrator \
    OPENWORK_SIDECAR_DIR=/data/sidecars \
    OPENWORK_WORKSPACE=/workspace

# --- Phase 5: domain agents + skills (seeded into each workspace on boot) ----
# Agent personas (Legal/Finance/Health/Research/Code) come from the repo; the
# Legal & Finance skills come from Anthropic's open-source knowledge-work-plugins.
COPY seed/ /opt/monolith-seed/
COPY seed-models.mjs /opt/monolith-seed/seed-models.mjs
RUN git clone --depth 1 https://github.com/anthropics/knowledge-work-plugins.git /tmp/kwp \
 && mkdir -p /opt/monolith-seed/.opencode/skills \
 && cp -r /tmp/kwp/legal/skills/.   /opt/monolith-seed/.opencode/skills/ 2>/dev/null || true \
 && cp -r /tmp/kwp/finance/skills/. /opt/monolith-seed/.opencode/skills/ 2>/dev/null || true \
 && rm -rf /tmp/kwp \
 || echo "[warn] knowledge-work-plugins clone failed; domain agents still work without their skills"
# ----------------------------------------------------------------------------

EXPOSE 8787
VOLUME ["/workspace", "/data"]

COPY entrypoint.sh /usr/local/bin/monolith-entrypoint
RUN chmod +x /usr/local/bin/monolith-entrypoint

ENTRYPOINT ["/usr/local/bin/monolith-entrypoint"]
