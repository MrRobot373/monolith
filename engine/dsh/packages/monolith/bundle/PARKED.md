# Parked overlay rows

These two blocks appeared in `cordis.patch.yml` at 2026-09-04 01:52 and were not
written by the session that authored the rest of the file. They are preserved
here verbatim because they are plausible and worth keeping — but they break boot
on this machine:

    failed to apply loader entry skill-filesystem
    (@deepseek-ai/dsh-skill-filesystem): require is not defined

They also point at container paths (`/opt/monolith/skills`,
`/opt/monolith/mcp/web-tools.mjs`) that exist only inside the Docker image, so
they cannot work on a local source run without `MONOLITH_SKILL_DIR` and
`MONOLITH_MCP_WEB` being set.

Decide whether to keep them, then fix the boot failure before re-adding.
The full pre-removal file is at `cordis.patch.yml.injected-0152.bak`.

```yaml
# ── MONOLITH skills ──────────────────────────────────────────────────

# dsh ships no document production of any kind — no pptx, docx, or xlsx anywhere
# in the tree. Asked for a presentation, the agent writes an outline in chat and
# says "I cannot output an actual .pptx file" (observed live). These skills close
# that gap; they are ordinary SKILL.md bundles, so they hot-reload.
# The web profile ships this provider DISABLED, so filesystem skills reach no
# agent at all until it is turned back on.
- id: skill-filesystem
  disabled: false
  config:
    customSkillDirs:
      # `require` is NOT in the !!js sandbox (only `process` and the harness-home
      # resolver), so the launcher passes the packaged skills directory instead.
      - !!js process.env.MONOLITH_SKILL_DIR ?? '/opt/monolith/skills'

# ── web reach ──────────────────────────────────────────────────────

# `web_search` and `web_fetch` already exist as first-class tools, but the
# shipped search provider is deepseek-official, which needs DEEPSEEK_API_KEY —
# every shipped provider (deepseek, exa, perplexity) is keyed. MONOLITH's own
# stdio MCP server does keyless search (DuckDuckGo, or a self-hosted SearXNG
# when SEARXNG_URL is set) plus URL fetch, so it is mounted here. MCP tools are
# namespaced `mcp__monolithweb__*`, so they never collide with the native pair.
- insert:
    - id: mcp-web
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        transport: stdio
        serverName: monolithweb
        command: !!js process.execPath
        args:
          - !!js process.env.MONOLITH_MCP_WEB ?? '/opt/monolith/mcp/web-tools.mjs'
        env:
          SEARXNG_URL: !!js process.env.SEARXNG_URL ?? ''
        cwd: !!js process.env.DSH_CWD ?? process.cwd()
        toolCallTimeoutMs: 60000

```
