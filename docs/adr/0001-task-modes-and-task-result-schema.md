# ADR 0001: Task modes and the task-result contract

- Status: accepted
- Date: 2026-07-18
- Phase: Upgrade Plan Phase 0 (see `MONOLITH_UPGRADE_PLAN.md`)

## Context

The 2026-07-18 baseline evaluation (`MONOLITH_TESTING_REPORT.md`, 41/90) showed that the
platform's worst failures are not coding ability but discipline: a read-only instruction was
violated by a temp-script write, and final summaries contradicted the tool trace. Both problems
require *server-enforced* concepts that today exist only as prose in prompts:

1. a machine-checkable definition of what a task is allowed to do (task mode), and
2. a machine-readable record of what a task actually did (task result).

Every later phase (policy gateway, execution ledger, claim checker, benchmark automation)
consumes these two definitions, so they are fixed here first.

## Decision 1: Task modes

Every task/session carries exactly one mode. The mode is chosen at task creation, is visible in
the UI, and can only be widened by an explicit user action (never by the model).

| Mode | Intent | Filesystem | Shell | Network |
| --- | --- | --- | --- | --- |
| `read_only` | Inspection, audit, review, Q&A | Read only. **Zero writes anywhere** — including `%TEMP%`, caches, and the workspace itself | Allowlisted read-only commands only (`Get-Content`, `Get-ChildItem`, `rg`, `git diff`, `git log`, `git status`, …) | Denied unless policy sets `allowNetwork: true` |
| `workspace_write` | Normal implementation work | Create/modify/delete **inside the canonicalized workspace root only**. Temp files must live under a task-scoped subdirectory of the workspace | General commands whose write effects stay inside the workspace; package installs allowed only when policy permits | Denied unless policy sets `allowNetwork: true` |
| `elevated` | Anything touching paths outside the workspace, system state, process control, or source-control mutation beyond the workspace | Outside-workspace paths allowed **per-action with explicit user approval** | Same per-action approval | Same per-action approval |

Notes:

- Path decisions are made **after canonicalization** (resolve `..`, symlinks, junctions,
  8.3 short names, drive-relative forms). A path is "inside the workspace" only if its
  canonical form is a descendant of the canonical workspace root.
- In `read_only`, test execution is permitted only when it demonstrably creates no outputs;
  when in doubt, it is blocked.
- Mode enforcement lives in the runtime (policy gateway, Phase 1), not in the model prompt.
  The model may *request* anything; the runtime decides.

### Policy object

Every task/session carries this policy object (serialized with the session, shown in the UI):

```json
{
  "mode": "read_only",
  "workspaceRoot": "C:\\Users\\example\\workspace",
  "allowNetwork": false,
  "allowExternalWrites": false,
  "allowedTools": ["read_file", "search", "shell_read_only"]
}
```

`allowedTools` is an allowlist evaluated by the gateway; unknown or unlisted tools are denied
with a structured blocked-operation event that names the policy rule.

## Decision 2: Task-result contract

Every finished run — regardless of outcome — produces one task-result document. Phase 2's
execution ledger becomes the source of truth for the factual fields; until then the fields are
populated best-effort but the *shape* is fixed now so evals, UI, and handoffs can build on it.

```jsonc
{
  "requestedAction": "string — the user's request, normalized",
  "mode": "read_only | workspace_write | elevated",
  "assumptions": [{ "text": "string", "material": false }],
  "decisions": [{ "question": "string", "answer": "string", "source": "user | default" }],
  "toolCalls": [{ "tool": "string", "status": "ok | error | blocked" }],
  "filesRead": ["workspace-relative path"],
  "filesChanged": [{ "path": "string", "change": "created | modified | deleted | renamed" }],
  "commands": [{ "command": "string", "exitCode": 0 }],
  "tests": [{ "suite": "string", "passed": 0, "failed": 0, "ran": true }],
  "artifacts": [{ "path": "string", "sha256": "string", "verifiedExists": true }],
  "blockedActions": [{ "action": "string", "rule": "policy rule id", "reason": "string" }],
  "finalStatus": "completed | needs_input | failed | cancelled"
}
```

Rules:

- `finalStatus` has exactly four values. "Cancelled" runs stay inspectable and can never be
  re-reported as `completed`.
- An artifact may be listed only with `verifiedExists: true` after an on-disk existence +
  checksum check (Phase 2 acceptance: fabricated artifact claims are rejected).
- The final chat summary's "files changed" / "commands run" sections must be *generated from*
  this document, not model memory. A claim checker (Phase 1 item 7) compares narration against
  it, e.g. "no files changed" vs a non-empty `filesChanged`.

## Decision 3: Evaluation result format and environments

- Benchmark runs are recorded as `evals/results/<run-id>.json`; the shape is defined by
  `evals/schema/eval-result.schema.json` and checked by `node evals/validate-result.mjs`.
- Run ID convention: `<yyyy-mm-dd>-<slug>-<nn>` (e.g. `2026-07-18-baseline-01`), unique per run.
- Each run executes in an **isolated throwaway workspace** created by `node evals/new-run.mjs`
  (never in a real project workspace).
- Environments are separated: `local` (this machine, native or Docker), `staging` (a separate
  Supabase project + stack instance once Phase 5 lands), `production`. Auth and security
  changes are never tested directly against production; Supabase work always goes to a staging
  project first.

## Consequences

- Phase 1 implements enforcement of Decision 1; Phase 2 implements the ledger behind
  Decision 2; Phase 8 automates the benchmark around Decision 3.
- The platform does not claim coworker-level reliability until the automated suite scores
  ≥ 81/90 twice consecutively with zero safety-gate failures (see `evals/README.md`).
