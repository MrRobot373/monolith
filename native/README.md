# MONOLITH — native Windows launcher (no Docker)

Runs **OpenWork's real web UI + agent engine natively on Windows**, pointed at **Ollama**
(local by default, with an optional pooled cloud fallback). Nothing calls back to
openworklabs.com / OpenWork Cloud. This lives alongside the Docker stack — that stack is untouched.

## How it works
```
Browser  →  OpenWork SPA (openwork/apps/app, built)  →  openwork-server :8787  →  opencode engine
                                                              ├─ provider "ollama"        → localhost:11434  (local)
                                                              └─ provider "ollama-cloud"  → 127.0.0.1:11435  (pool proxy → ollama.com)
```
All pieces are plain Node/Ollama processes — no Docker, no Electron, no Rust.

## Prerequisites
- **Node 24** and **Ollama for Windows** installed (`node -v`, `ollama --version`).
- Internet for first run (fetches pnpm, the orchestrator, and the pinned `opencode` binary once).

## Quick start
```bat
native\setup.cmd     REM one-time: pnpm + orchestrator + build the UI (a few minutes)
REM then edit native\.env  (pick OLLAMA_MODEL; paste OLLAMA_KEY_1.. only if using the cloud pool)
native\start.cmd     REM starts everything and opens the browser
```
Leave the `start` window open; **Ctrl+C** stops the whole stack. If you closed it abruptly,
`native\stop.cmd` force-frees the ports.

## Ollama modes
- **Local (default):** set `OLLAMA_MODEL` in `.env` to a model your PC can run (e.g. `qwen2.5-coder:7b`,
  or `qwen2.5:0.5b` to test fast). No keys needed. Fully private/offline.
- **Cloud pool (optional):** paste your keys as `OLLAMA_KEY_1..N` in `.env`. `pool-proxy.mjs`
  round-robins them to `OLLAMA_POOL_BASE` (default `https://ollama.com/v1`) so big models like
  `gpt-oss:120b` appear in the model picker as **Ollama Cloud (pooled)**.
  Keys stay in `native/.env` (gitignored) and never leave this machine.

## No-phone-home (baked in at build time)
`build-ui.mjs` compiles the UI with PostHog analytics disabled (`VITE_OPENWORK_POSTHOG_KEY=""`),
the cloud "OpenWork Models" upsell off (`VITE_DISABLE_OPENWORK_MODELS=1`), web deployment mode, and
the engine pointed at `127.0.0.1:8787`. `start.mjs` runs the engine with
`OPENCODE_MODELS_URL=https://models.dev/` (off OpenWork's mirror). Forced cloud sign-in is never
enabled, so the app stays fully local. The remaining Docs/Feedback links only open on explicit click.

## Files
| File | Role |
|---|---|
| `setup.cmd` / `setup.mjs` | one-time install + UI build |
| `start.cmd` / `start.mjs` | supervisor: Ollama → pool → seed config → engine → UI → browser |
| `stop.cmd` / `stop.mjs` | force-stop by port |
| `build-ui.mjs` | build `openwork/apps/app` → static SPA (neutralized) |
| `serve-ui.mjs` | static server for the built SPA (SPA-fallback routing) |
| `seed-opencode-config.mjs` | writes `<workspace>/opencode.json` (Ollama providers, local default) |
| `pool-proxy.mjs` | OpenAI-compatible round-robin proxy over the cloud keys |
| `.env.example` | copy to `.env` and fill in |

## Later: native .exe
Phase E of the plan packages this as a real Electron installer from `openwork/apps/desktop`
(`pnpm --filter @openwork/desktop build:electron` → NSIS), with the updater/telemetry stripped.
Do the browser path first; the `.exe` is an add-on, not a prerequisite.
