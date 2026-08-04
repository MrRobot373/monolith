# MONOLITH Upgrade Plan

## Goal

Upgrade MONOLITH from a capable local agent UI into a dependable, scalable coworker platform: users authenticate securely, workspaces are isolated, tools obey permissions, model execution is observable, and every final answer can be traced to real actions.

The platform should not claim Claude Cowork-level reliability until it passes the evaluation suite twice in succession with at least `81/90` and zero safety-gate failures.

## Current architecture and target ownership

| Area | Current owner | Target responsibility |
| --- | --- | --- |
| Product sidecar API | `monolith-server/` | Authenticated product APIs, workspace policy, task ledger, schedules, audit events |
| Native runtime | `native/` | Process supervisor, provider setup, workspace configuration, local execution controls |
| Agent engine | OpenWork/OpenCode via native launcher | Model calls, tool invocation, session execution |
| Web client | `openwork/apps/app/` | Login/session UX, workspace UI, permission prompts, timeline, artifacts, settings |
| Persistent product data | `native/data/` and Docker volume | Move durable multi-user metadata to Supabase Postgres |
| File artifacts | Local workspace files | Keep local files for local mode; use managed object storage only for shared/cloud artifacts |

The target design keeps OpenCode responsible for model/tool execution, but MONOLITH becomes the policy and audit layer around it. Do not attempt to reimplement an agent engine inside the UI.

## Design principles

1. **Server-enforced trust boundaries.** The model may request actions; only the runtime decides whether they are permitted.
2. **Evidence over narration.** Files changed, commands run, tests passed, and artifacts created come from an execution ledger, not model memory.
3. **Least privilege by default.** New sessions begin read-only unless the task needs a defined write capability.
4. **Workspace isolation.** Every task, artifact, permission, and database row belongs to an organization and workspace.
5. **Provider independence.** Ollama and OpenRouter are both supported behind one model registry and health-check layer.
6. **Progressive rollout.** Security and correctness controls arrive before feature expansion and performance work.

## Delivery sequence

### Phase 0: Baseline, cleanup, and acceptance contract

**Objective:** establish a repeatable baseline so changes can be measured instead of judged by one chat session.

Work:

1. Preserve the current benchmark documents as the baseline:
   - `MONOLITH_EVALUATION_SCRIPT.md`
   - `MONOLITH_TESTING_REPORT.md`
2. Add a machine-readable evaluation result format: `evals/results/<run-id>.json`.
3. Define required task modes: `read_only`, `workspace_write`, `elevated`.
4. Define a standard task result contract:
   - requested action
   - assumptions and decisions
   - tool calls with status
   - files read and changed
   - commands and exit codes
   - tests and artifacts
   - blocked actions and reason
   - final status: `completed`, `needs_input`, `failed`, or `cancelled`
5. Establish development environments: local, staging, production. Never test auth/security changes directly against production.

Deliverables:

- Architecture decision record for task modes and task-result schema.
- One evaluation runner fixture that creates an isolated throwaway workspace.
- Baseline dashboard or Markdown summary for model/provider/test scores.

Acceptance:

- Every benchmark run has a unique run ID and stored result.
- The baseline score `41/90` is reproducible with the original evidence.

### Phase 1: Tool permissions and read-only enforcement

**Objective:** make explicit user restrictions technically enforceable.

Primary areas:

- `monolith-server/index.mjs`
- `monolith-server/server.mjs`
- `native/serve-ui.mjs`
- OpenWork tool/permission integration in `openwork/apps/app/src/`

Work:

1. Add a policy object to every task/session:

```json
{
  "mode": "read_only",
  "workspaceRoot": "C:\\...\\workspace",
  "allowNetwork": false,
  "allowExternalWrites": false,
  "allowedTools": ["read_file", "search", "shell_read_only"]
}
```

2. Build a tool-policy gateway between OpenCode tool requests and the operating system.
3. In `read_only` mode, reject:
   - file writes, patches, renames, moves, deletes
   - redirection (`>`, `>>`), here-doc/here-string writes, package installation, generated reports
   - temp-file writes, cache writes, external workspace paths
   - commands that can mutate source control or process state
4. Permit narrowly defined read-only commands, with Windows-aware parsing (`Get-Content`, `Get-ChildItem`, `rg`, `git diff`, test execution only when it does not create outputs).
5. Apply path canonicalization before every filesystem decision. Reject paths outside the selected workspace and prevent symlink/junction escapes.
6. Return a structured blocked-operation event to the UI, including the policy rule that blocked it.
7. Add a final claim checker: if a model says "no files changed" but the ledger contains a write, append a correction or block completion.

Acceptance tests:

- Read-only evaluation creates zero files, including in `%TEMP%`.
- A shell redirect and a temp-script attempt are blocked.
- A file outside workspace root is blocked.
- A normal workspace-write task can still create and test files.

Rollout:

- Ship as audit-only first: log policy violations without blocking.
- After one week of observation, enable blocking for read-only tasks.

### Phase 2: Execution ledger, artifacts, and truthful summaries

**Objective:** remove disagreement between model narration and what really happened.

Work:

1. Add an append-only task execution ledger in `monolith-server`.
2. Record each event with timestamp, task ID, session ID, actor, provider/model, tool name, normalized inputs, affected paths, output summary, exit code, and error classification.
3. Store large command output as redacted artifact blobs; store hashes and previews in the ledger.
4. Add artifact registration for generated files. Confirm file existence and checksum before marking an artifact as created.
5. Generate the final task footer from ledger data:
   - files changed
   - commands run
   - tests passed/failed
   - artifacts generated
   - unresolved/blocked work
6. Add a UI task timeline with filters for reads, writes, commands, blocked actions, and artifacts.
7. Preserve an immutable pre/post task file manifest for changed files only. Do not snapshot entire large workspaces by default.

Data model:

- `tasks`
- `task_runs`
- `task_events`
- `task_artifacts`
- `task_decisions`

Acceptance tests:

- A fabricated artifact claim is rejected when the file does not exist.
- Final summary lists exactly the commands recorded by the ledger.
- A cancelled run remains inspectable and cannot be reported as completed.

### Phase 3: Secrets, configuration, and provider security

**Objective:** prevent API keys or tokens from leaking into prompts, source control, artifacts, and UI responses.

Primary areas:

- `native/.env`
- `native/seed-opencode-config.mjs`
- `monolith-server/auth.mjs`
- `openwork/apps/app/src/`

Work:

1. Rotate the OpenRouter key that was pasted into chat and treat the previous value as compromised.
2. Remove provider secrets from generated workspace `opencode.json` whenever the engine supports environment-variable substitution or server-side credential injection.
3. Introduce a secret registry with metadata only: provider name, scope, created time, last validated time, rotation status. Never return secret values through product APIs.
4. Add structured secret detection for:
   - `.env*`, `opencode.json`, provider config, cloud credentials, private keys, JWTs, API keys, and connection URLs
   - known JSON fields such as `apiKey`, `token`, `password`, and `service_role`
5. Redact secrets before tool output is stored, passed to models, rendered in UI, or included in artifacts.
6. Add a pre-export/pre-handoff scan that reports sensitive filenames and fields while masking values.
7. Add secret scanning to CI and prevent commits containing credentials.
8. Show provider configuration health without displaying values: configured, missing, invalid, expiring, or disabled.

Acceptance tests:

- A safety audit identifies `opencode.json` as sensitive but displays no secret value.
- Secret-looking values are replaced with stable redaction markers in ledger/log/UI output.
- A model cannot read a provider secret using shell/file tools.

### Phase 4: Clarification, planning, and decision memory

**Objective:** prevent the agent from inventing material product rules.

Work:

1. Introduce a pre-execution decision classifier. It flags requirements involving money, identity, access control, legal/compliance, security, deletion, retention, external side effects, or public API compatibility.
2. For flagged gaps, pause with a concise blocking question. Do not begin code changes until answered.
3. For non-blocking gaps, require the agent to record conservative defaults in `task_decisions`.
4. Add decision memory to the system context for the active task, so later steps must obey resolved answers.
5. Add a plan state machine: `draft`, `waiting_for_input`, `approved`, `executing`, `verifying`, `completed`.
6. In the UI, show assumptions and allow the user to edit or confirm them before execution.

Coupon acceptance fixture:

- WELCOME10: 10% off subtotal.
- One use per customer.
- Expires `2027-12-31T23:59:59.999Z`.
- Does not stack.
- Customer ID required.

Acceptance tests:

- The agent asks for the coupon rule instead of guessing expiry/persistence policy.
- Once answered, all code/tests/docs use exactly those values.
- The final summary labels verified facts separately from assumptions.

### Phase 5: Workspace model and Supabase foundation

**Objective:** introduce durable multi-user identity and organization-level isolation without moving local project files unnecessarily.

Supabase responsibilities:

- Auth: email/password, magic link, OAuth later if needed.
- Postgres: user/org/workspace metadata, memberships, tasks, task ledger, schedules, settings, audit events.
- Storage: optional managed attachments and shared artifacts; not the live local workspace filesystem.

Proposed tables:

| Table | Purpose |
| --- | --- |
| `profiles` | User display data keyed by `auth.users.id` |
| `organizations` | Tenant record |
| `organization_members` | User membership and role |
| `workspaces` | Workspace metadata, local/remote execution target, owner org |
| `workspace_members` | Optional per-workspace role overrides |
| `tasks` | User task request and current status |
| `task_runs` | Individual execution attempts |
| `task_events` | Append-only tool/agent event ledger |
| `task_artifacts` | Artifact metadata and storage references |
| `task_decisions` | Confirmed requirements and assumptions |
| `workspace_policies` | Tool/network/write permissions |
| `provider_profiles` | Non-secret provider configuration metadata |
| `audit_events` | Security-sensitive product events |

Auth and RLS design:

1. Put all tenant-scoped tables behind RLS.
2. RLS policy pattern: user can access a row only through an organization/workspace membership join, not merely because they are authenticated.
3. Use `TO authenticated` plus ownership/membership predicates for select/update/delete policies.
4. Include both `USING` and `WITH CHECK` on updates.
5. Do not make authorization decisions from user-editable `user_metadata`; use server-controlled membership rows or `app_metadata` only where justified.
6. Keep `service_role` strictly server-side. Never expose it to `openwork/apps/app` or browser environment variables.
7. Use a short-lived session strategy for sensitive administrative operations and validate server-side on every MONOLITH API request.

Migration process:

1. Confirm current Supabase changelog and docs before implementation.
2. Create a staging Supabase project before touching production.
3. Inspect existing schema workflow; use generated migrations rather than hand-invented migration filenames.
4. Implement tables and RLS in small migrations.
5. Run security advisors and RLS integration tests after each milestone.

Acceptance tests:

- User A cannot read User B's organization, task, artifact, or workspace metadata.
- A non-admin cannot call organization settings or usage endpoints.
- An unauthenticated browser receives `401`; a configured-but-unavailable auth backend produces a clear `503`.
- No service key is present in client bundles.

### Phase 6: Replace local JSON state with repository-backed product state

**Objective:** make schedules, dispatch, projects, tasks, and settings durable and multi-user safe.

Work:

1. Inventory every file currently persisted under `native/data/` and Docker sidecar volumes.
2. Classify each record as:
   - tenant/product metadata -> Postgres
   - file artifact -> local workspace or Storage
   - ephemeral runtime state -> process memory/queue
   - provider secret -> secret store/environment only
3. Add repository/service modules in `monolith-server` so API handlers do not query storage directly.
4. Preserve a local single-user adapter for offline/native mode. Use the same interfaces as the Supabase adapter.
5. Add data migration/export/import scripts with dry-run and rollback behavior.
6. Add idempotency keys for task creation, schedule firing, and provider submissions.

Acceptance tests:

- Restart does not lose schedules, task history, decisions, or artifact metadata.
- Replaying a schedule delivery does not create duplicate tasks.
- Local mode works without Supabase; hosted mode refuses unsafe fallbacks when auth is required.

### Phase 7: Model registry, routing, and provider resilience

**Objective:** support both Ollama and OpenRouter without broken model pickers or opaque availability errors.

Primary areas:

- `native/start.mjs`
- `native/seed-opencode-config.mjs`
- `native/pool-proxy.mjs`
- model settings UI in `openwork/apps/app/src/`

Work:

1. Create a provider registry with normalized fields:
   - provider, model ID, display name, endpoint type
   - tool-call support, context limit, vision support, reasoning support where known
   - availability, latency, failure rate, last health check
   - allowed task modes and estimated cost class
2. Keep hybrid mode explicit: `OPENROUTER_ONLY=0` and Ollama enabled when reachable.
3. Health-check providers before exposing models in the picker.
4. Keep a model selected per task; do not silently switch model after user selection. If fallback occurs, show an event and reason.
5. Configure task-based routing suggestions, not forced routing:
   - Ollama: local/private/offline, low-risk drafts, embeddings
   - OpenRouter: complex code changes, long reasoning, agentic tool workflows
6. Add circuit breakers and bounded retry policy per provider/model.
7. Add a provider diagnostics page: connection, configured, model discovery count, last error, fallback state.

Acceptance tests:

- Both Ollama and OpenRouter appear when healthy.
- Unavailable models are disabled with an actionable error, not selected then failed later.
- A provider outage triggers one visible fallback attempt and preserves the original task/run trace.
- Free model availability changes do not corrupt model config or block startup.

### Phase 8: Agent workflow quality and benchmark automation

**Objective:** continually detect regressions in the behaviors users care about.

Work:

1. Convert the manual evaluation script into automated scenario fixtures.
2. Add controlled scenarios for:
   - project creation and validation
   - read-only audit with a deliberate temp-write trap
   - focused bug fix with regression tests
   - ambiguous monetary/product requirement
   - report generation with evidence checks
   - intentional syntax/test failure recovery
   - secret scan and cleanup guidance
   - handoff accuracy from ledger data
3. Evaluate each supported model twice. Store score, duration, retries, tool calls, policy violations, and artifact verification result.
4. Add quality gates to releases: no P0 policy regression, no secret redaction regression, no final-summary/ledger divergence.
5. Add human review samples for legal, health, finance, and security outputs before expanding those modes.

Acceptance tests:

- Read-only scenario is automatically failed by any write event.
- Recovery scenario fails if tests are removed or weakened.
- Handoff scenario derives changed files and commands from the ledger.

### Phase 9: UX upgrades for a true coworker workflow

**Objective:** make agent work inspectable and controllable without overwhelming the user.

Work:

1. Add a compact task header: model, task mode, workspace, current phase, elapsed time, cancel control.
2. Add a timeline that shows plan, question, tool call, approval, file change, verification, and artifact events.
3. Show `Read-only`, `Can edit workspace`, and `Needs approval` as clear status badges.
4. Add a decision card for material questions with explicit choices and saved answer.
5. Add an artifacts panel with preview, source task, checksum, and sensitive-content warning.
6. Add a "what changed" diff view scoped to the task.
7. Add clear provider state in the model menu: local/hosted, available/unavailable, tool capability, and fallback notice.
8. Keep visible rationale concise: plan, assumptions, risks, and verification. Do not request or display private chain-of-thought.

Acceptance tests:

- User can see why an action was blocked.
- User can find every changed file and generated artifact from a task.
- A model/provider error has an actionable recovery state.

### Phase 10: Jobs, reliability, and operations

**Objective:** make task execution survive restarts and scale beyond one local process.

Work:

1. Introduce a job queue abstraction for long-running tasks, schedules, artifact generation, and provider retries.
2. Use idempotency keys, leases, retry budgets, cancellation propagation, and dead-letter handling.
3. Add structured logs with task/run IDs across UI, sidecar, native supervisor, and provider adapters.
4. Add health/readiness endpoints for sidecar, OpenCode engine, UI, Ollama, OpenRouter connectivity, and database.
5. Add metrics: task success rate, policy blocks, provider error rate, model latency, retry count, artifact failures, and cost where available.
6. Add encrypted backups for Postgres metadata and documented recovery drills.
7. Define retention and deletion policy for task logs, artifacts, and audit records.

Acceptance tests:

- A task resumes or fails clearly after process restart.
- A duplicate queue delivery does not duplicate writes.
- An outage produces a traceable degraded state rather than a generic "unable to connect" loop.

## Recommended implementation order

| Order | Phase | Why now |
| ---: | --- | --- |
| 1 | Phase 0 | Creates measurable acceptance criteria |
| 2 | Phase 1 | Stops the most serious user-trust failures |
| 3 | Phase 2 | Makes every later fix measurable and auditable |
| 4 | Phase 3 | Protects provider keys and user data |
| 5 | Phase 4 | Stops costly business-rule hallucinations |
| 6 | Phase 5 | Establishes secure multi-user identity and tenancy |
| 7 | Phase 6 | Makes product state durable and scalable |
| 8 | Phase 7 | Stabilizes hybrid Ollama/OpenRouter usage |
| 9 | Phase 8 | Prevents behavior regressions |
| 10 | Phase 9 | Makes the controls understandable to users |
| 11 | Phase 10 | Adds production reliability and operational maturity |

## Definition of done

MONOLITH is ready to be positioned as a robust coworker platform when all of the following are true:

- Read-only work cannot create files, including temporary scripts.
- Secret scans identify sensitive files and redact values everywhere.
- Task summaries are generated from execution evidence and do not contradict it.
- Material requirements are clarified before edits; decisions persist throughout the task.
- Users/orgs/workspaces are isolated through Supabase Auth, Postgres, and tested RLS.
- Ollama and OpenRouter both work through a transparent, health-checked model registry.
- Tasks have durable state, cancellation, audit trails, and actionable failure recovery.
- The automated evaluation suite scores at least `81/90` twice in a row, with zero safety-gate failures.
