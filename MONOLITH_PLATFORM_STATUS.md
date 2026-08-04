# MONOLITH Platform Status, Pending Work, and Opportunity Analysis

> Date: 2026-07-20
> Companion documents: `MONOLITH_UPGRADE_PLAN.md` (reliability), `MONOLITH_CHAT_RAG_PLAN.md`,
> `MONOLITH_CODE_IDE_PLAN.md`, `MONOLITH_TOOLS_INTEGRATION_GUIDE.md`, `MONOLITH_TESTING_REPORT.md`
> (baseline 41/90), `evals/` (benchmark harness).

---

## 1. What MONOLITH is today

A self-hosted, Claude-style AI agent workspace built by integrating open-source projects
(OpenWork MIT core + OpenCode engine), with MONOLITH acting as the **policy, product, and audit
layer** around the engine. Two deployment paths, both working:

- **Native Windows** (`native/`): no Docker; Ollama local models + OpenRouter + pooled cloud,
  live-probed model picker, sidecar embedded in `serve-ui.mjs`.
- **Docker Compose**: caddy (auth/routing), openwork-host, webui, litellm(+db), ollama, vane
  (Perplexica cited search), searxng, monolith-server sidecar; per-user workspace containers
  (`scripts/add-user.sh`), backups, branding, domain-mode Hub.

**Benchmark reality check:** 41/90 on the 8-test coworker evaluation, with one safety-gate
failure (read-only violation). The platform is a capable assistant, not yet a trustworthy
autonomous coworker. Target: ≥ 81/90 twice consecutively, zero safety gates.

## 2. Platform inventory (what exists, and its verification state)

### Sidecar product APIs (`monolith-server/`, dep-free, native + Docker)

| Module | What it does | Verified by |
| --- | --- | --- |
| `index.mjs` | Scheduler (cron-like tasks → engine sessions), Dispatch thread, Org/usage | E2E in earlier sessions |
| `auth.mjs` | Supabase bearer-token verification, admin gating (**uncommitted**) | Manual only — no test suite |
| `workspace-files.mjs` | Code-plan P0: tree/read/write/create/move/trash/restore/search + JSONL ledger; canonical paths, junction-escape rejection, sha256 revisions (409 conflicts), protected files | 9/9 `node --test` incl. real junction escape |
| `chat.mjs` | Chat-plan P0: persistent conversations, user-msg-persisted-before-generation, sliding-window context, SSE streaming, stop, regenerate-as-branch, run telemetry; Ollama + OpenRouter | 8/8 tests + live smoke (gemma4:e4b) |
| `mcp-catalog.mjs` + `-data.mjs` | 60-server curated MCP catalog, **per-user** store, secret masking, `{key}` templating | 7/7 tests incl. cross-user isolation |

### Agent tools (Tools guide tiers)

| Tier | Status |
| --- | --- |
| T1 core tools (bash/read/write/edit/glob/grep) | Engine-native (OpenCode). Enforcement wrapper = upgrade Phase 1 (not started) |
| T2 runtime (sub-agents, todos, skills, Cron) | Engine + sidecar scheduler. PythonRun container deferred |
| T3 web | `native/mcp/web-tools.mjs` (search + fetch, SSRF-guarded, SearXNG or DDG) — live-verified |
| T4 cloud MCPs | Catalog (60 servers) + seeder merge into workspace `opencode.json` — e2e verified |

### Web client (`openwork/apps/app/`)

Cowork-style UI complete (design system, mode tabs Chat/Cowork/Code, task rail, projects,
Supabase account page, Notifications/Usage settings, per-mode UI differences) — all
screenshot-verified in prior passes. **New this session:** Settings → MCP Servers page
(typecheck + build + bundle-verified; not yet pixel-verified).

### Evaluation infrastructure (`evals/`, upgrade Phase 0 — DONE)

Run-ID'd machine-readable results, isolated sandbox workspaces, validator, baseline transcribed,
`BASELINE.md` dashboard. ADR 0001 fixes task modes + task-result contract.

## 3. Pending work — the complete list

### 3.0 Hygiene (do first, cheap)

| Item | Why it matters |
| --- | --- |
| **Commit the 4 uncommitted work streams** (Supabase auth; Phase 0 evals; Chat/Code P0 backends + MCP layer; settings UI) | ~60 files uncommitted; unreviewable and one `git clean` from disaster. Needs user go-ahead |
| **Rotate the OpenRouter API key** | It was pasted into a chat once → treat as compromised (upgrade Phase 3 item 1). 5 minutes |
| Clean root cruft: `chat_dump.txt`, `check_db.py`, `check_env.py`, `dump_chat.py`, `set_wal.py`, `native/start-*.err` | Repo clarity; some may contain data that shouldn't be committed |
| Decide fate of `.agents/`, `.mcp.json`, `skills-lock.json` (assistant-tooling artifacts) | Commit or ignore explicitly |
| Supabase MCP authorization (interactive `/mcp` session) | Needed before Phase 5 schema work |

### 3.1 Upgrade plan (reliability) — Phases 1–10, all pending

| Phase | Content | Status |
| ---: | --- | --- |
| 1 | **Tool-policy gateway, read-only enforcement**, claim checker | Not started — the single highest-trust fix (caused the 0/10 safety gate). Ship audit-only first |
| 2 | Execution ledger, artifact verification, truthful summaries | Partial seed exists (workspace-files ledger); engine tool-call events not captured |
| 3 | Secrets: rotation, registry, redaction everywhere, stop writing keys into `opencode.json` | Not started. Provider keys currently serialized into every workspace config — biggest leak surface |
| 4 | Clarification gate, decision memory (coupon fixture) | Not started (caused 2/15 on Test D) |
| 5 | Supabase tenancy: orgs/workspaces/members, RLS | Auth verification exists (auth.mjs); no schema/RLS yet |
| 6 | Replace JSON state with repo-backed adapters (Postgres or local) | All sidecar state is JSON files today |
| 7 | Model registry, health checks, circuit breakers, no silent fallback | Live probing exists in seeder; no runtime registry/fallback events |
| 8 | Benchmark automation (scenario fixtures, quality gates) | Manual script + harness only |
| 9 | UX: task header, timeline, mode badges, decision cards, diff view | Task rail exists; no policy/timeline surfaces |
| 10 | Job queue, resumable tasks, metrics, backups/retention | Scheduler is a 30s in-process tick; nothing survives restart mid-task |

### 3.2 Chat & RAG plan

| Piece | Status |
| --- | --- |
| Chat P0 backend (store, streaming, stop, regenerate) | **DONE**, tested |
| **Chat P0 UI** — conversation sidebar, streaming view, model picker on `/__monolith/chats` | Pending — the Chat mode still uses engine sessions; the orchestrator has no UI |
| Chat P1 — token-budget profiles per model, rolling summaries, context preview drawer, pins | Pending (backend has char-budget window only) |
| Chat P2 — RAG: upload → extract → chunk → embed → retrieve → cite; org/workspace scoping | Pending. Local embeddings ready (`mxbai-embed-large` installed); pgvector needs Phase 5 |
| Chat P3 — hybrid retrieval, rerank, retrieval diagnostics, gold-set eval (50 questions) | Pending |
| Chat P4 — shared chats, collections, quotas, exports | Pending (needs Phase 5/6) |

### 3.3 Code IDE plan

| Piece | Status |
| --- | --- |
| Code P0 backend (WorkspaceFileService + ledger + trash) | **DONE**, tested |
| **Code P1 UI** — Monaco editor, explorer tree, tabs/dirty state, find/replace, conflict UX, agent diff review | Pending — biggest single frontend build |
| Backend gaps for P1 | `watch`/SSE file events, `getDiff`, problems surface |
| Code P2 — policy-scoped terminal, git status/stage/commit, trash UI, large files | Pending |
| Code P3 — splits, symbols, worktrees, collab | Pending |

### 3.4 MCP / tools follow-ups

- Pixel-verify Settings → MCP page (rebuild headless-Edge screenshot tooling — old scratchpad gone).
- Docker: `docker compose build webui` to ship the page; add catalog merge to
  `workspace-image/seed-models.mjs` so catalog entries reach Docker workspaces.
- Hosted per-user seeding (each user's servers → only their container) — lands with Phase 5/6.
- "Test connection" button per enabled server (spawn, MCP handshake, report tools count).
- Auto re-seed active workspace on enable/disable (today: manual re-open/restart).
- Catalog maintenance: entries pinned to package names — add a CI job that dry-runs `npx -y <pkg> --help`
  weekly to detect bit-rot; surface OAuth-remote compatibility once engine behavior is confirmed.
- Optional: Cloudflare bindings MCP (OAuth), a finance-data MCP (needs vendor pick), PythonRun/E2B
  self-hosted equivalent.

### 3.5 UI polish backlog (carried from Cowork pass)

- Task-rail Progress should derive from last `todowrite` part (engine clears todos post-run).
- `hub/modes.json` + onboarding welcome page still say "OpenWork" (rebrand pending); welcome page dark-only.
- Dark-mode audit for Account/Usage/Notifications (+ new MCP page).
- Scheduled/Dispatch/Admin panels are built but unreachable (sidebar entries removed on request) —
  decide whether they return under Settings or stay hidden.

## 4. Security & trust debt (ranked)

1. **No read-only enforcement** — the model can write during "don't modify anything" tasks (proven
   by the benchmark). Phase 1 is the fix. Everything else is second to this.
2. **Provider API keys inside every workspace `opencode.json`** — any file-read tool call, export,
   or handoff can leak them; the benchmark showed the agent *denying* they exist while they sat on
   disk. Phase 3: server-side injection/env substitution + redaction layer + rotate the exposed key.
3. **Summaries can contradict the tool trace** — ledger exists only for the new file API; engine
   tool calls aren't captured, so the claim checker can't exist yet (Phase 2).
4. **Native mode ships unauthenticated by default** — fine for localhost single-user, but the
   sidecar APIs (files! chats! MCP tokens!) are open to anything on 127.0.0.1; Supabase auth
   activates only when configured. Document loudly, or default `MONOLITH_REQUIRE_AUTH=1` once
   sign-in UX is smooth.
5. **MCP tokens stored plaintext in `native/data/mcp-servers.json`** — gitignored and masked in
   APIs, but consider DPAPI/OS-keychain encryption at rest, and never include `data/` in backups
   without noting it contains secrets.
6. **No rate limiting / quotas** on chat or file APIs (matters from Phase 5 multi-user onward).

## 5. Deep analysis — what more the platform can become

### A. Close the loop on trust (highest leverage, unlocks the product claim)

The single differentiator MONOLITH is chasing vs "a chat UI over Ollama" is **provable
reliability**: modes enforced by the runtime, summaries generated from evidence, benchmark gates
on every release. Phases 1–3 + 8 are that story. Nothing else on this list markets as well as
"read-only means read-only, and we can prove it."

- Concrete next brick: an **OpenCode permission-hook bridge** — the engine supports permission
  prompts; route them through the sidecar policy object (ADR 0001) so `read_only` maps to
  deny-writes at the engine level, with blocked-op events into the ledger and UI. Audit-only for a
  week, then enforce.

### B. Product surfaces that are 80% built — finish them

1. **Chat P0 UI** (sidebar + streaming view over `/__monolith/chats`): converts the verified
   backend into a visible ChatGPT-style experience; ~1 focused session.
2. **Code P1 Monaco workbench**: the file API is ready; Monaco + tree + tabs + conflict dialog
   makes Code mode a real IDE; 2–3 sessions, the most user-visible upgrade available.
3. **MCP page test-connection + auto-reseed**: turns the catalog from "configured" to "trusted."

### C. RAG as the knowledge moat (after Chat P0 UI)

Local-first RAG is very reachable: `mxbai-embed-large` is already pulled; a dep-free local vector
index (cosine over float32 arrays in SQLite/JSONL, thousands of chunks) covers single-user native
mode without any new infra, with pgvector as the hosted upgrade path in Phase 5. The plan's gold-set
evaluation (50 questions, recall@k + citation precision) should land *with* the first index, not
after — retrieval without measurement rots silently.

### D. Differentiators worth considering (not yet in any plan)

| Idea | Why | Effort |
| --- | --- | --- |
| **Voice mode** | ElevenLabs MCP is already in the catalog; add browser STT → hands-free coworker | S–M |
| **Artifact gallery** | Ledger already verifies artifacts; a browsable per-workspace gallery with checksums/provenance beats digging in folders | S |
| **Agent team templates** | Package domain agents + skills + MCP sets ("Legal analyst" = agent.md + law skills + docs MCPs) as one-click workspace presets — the Hub already points this direction | M |
| **Observability dashboard** | Sidecar already collects run telemetry (chat runs, schedules, probes); one settings page: success rates, latency, spend, policy blocks | M |
| **Windows tray app / installer** | `native/` is a launcher away from double-click install (NSIS/winget + tray icon); removes the last setup friction | M |
| **PWA/mobile pass** | The web UI + push notifications already exist; a responsive audit + manifest makes it pocketable | S–M |
| **Per-user budgets** | LiteLLM per-user keys exist in Docker; surface limits + alerts in Usage | S |
| **Prompt-injection defenses for MCP/web content** | Tool outputs go straight to the model today; wrap web/MCP results with source-tagging and instruction-stripping heuristics before context | M, rising urgency as MCP adoption grows |

### E. Operational maturity (before inviting a second real user)

- Job queue + resumable tasks (Phase 10) — today a restart mid-task loses everything.
- Structured logs with task/run IDs across UI ↔ sidecar ↔ engine; health endpoints for each.
- Automated backup for the native path (Docker has `scripts/backup.sh`; native has nothing).
- A release checklist: typecheck + all `node --test` suites + benchmark quality gates (Phase 8)
  before any tagged build — the suites now exist to enforce this.
- Docs: `README.md` is stale relative to reality; one honest "install → first task" doc per path.

### F. Explicit non-goals (keep saying no)

- No second agent engine (OpenCode stays the engine; MONOLITH stays policy/UI/audit).
- No OpenWork FSL `ee/den` code — MIT core only (licensing constraint).
- No key-pooling/ToS-violating provider tricks — legit keys only.
- No hidden chain-of-thought display/storage.

## 6. Recommended sequence (next five moves)

| # | Move | Rationale |
| --- | --- | --- |
| 1 | Commit everything (4 clean commits) + rotate OpenRouter key + root cleanup | Stop accruing risk; unblock review |
| 2 | **Phase 1: policy gateway (audit-only), wired to ADR 0001 modes** | Kills the safety-gate failure class; enables Phase 2 |
| 3 | Chat P0 UI + Code P1 Monaco workbench | Converts two verified backends into the product users see |
| 4 | Phase 2 ledger (engine tool events) + Phase 3 secrets (config de-secreting + redaction) | Truthful summaries + closes the top leak |
| 5 | Re-run the benchmark twice (`evals/new-run.mjs`), publish scores in `BASELINE.md` | Measure the climb from 41/90; decide next phase by data, not vibes |

---

*Everything in sections 2–3 marked "tested/verified" has a runnable proof: `node --test
monolith-server/` (24 tests across 3 suites), `node evals/validate-result.mjs`, and the live
smokes described in the session logs. Claims without a proof path are labeled pending.*
