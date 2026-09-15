# ADR 0002: Task/Project/Run ownership on `engine/core`

- Status: accepted
- Date: 2026-09-09
- Phase: Master Plan Phase 1, Day 3 (see `MONOLITH_PROJECT_MASTER_PLAN.md` §§3-4, 6.1, 11, §17)

## Context

`MONOLITH_PROJECT_MASTER_PLAN.md` retargets the product onto `engine/core`'s Cordis runtime
(superseding the OpenCode-oriented `MONOLITH_UPGRADE_PLAN.md`; see
[[monolith-master-plan-verified]] / [[monolith-master-plan-phase0]]). Phase 0 confirmed the
engine boots reproducibly (commit `653868e`). Before any Phase 1 code lands (F03/F04/F05), this
ADR resolves how the plan's vocabulary — Project, Task, Run, Artifact — maps onto what
`engine/core` already provides, per its own extension map (`docs/architecture.md` §"Where new
behavior goes"). Guessing this wrong is expensive: it decides where every later controller,
projection, and storage row lives.

Survey of existing primitives (read, not assumed):

- **`@monolith/session`** (`packages/core/session`) — the durable, append-only per-conversation
  event log. `ctx.agents.create()` / `.resume()` return an `AgentHandle`; `agent.cancel(cause,
  options)` cancels in flight. Forking is native: `ctx.agents.create({ sessionId, seed, meta: {
  parentSession, seedLength } })`. There is no multi-run "task" grouping above a session.
- **`@monolith/workspace`** (`packages/workspace/workspace`, `ctx.workspaceRegistry`) — a
  persisted record that is *already* the plan's Project shape: stable id, canonical directory
  path, display title, timestamps, and an ordered, durable list of member session ids
  (`attachSession`/`detachSession`/`insertSessionBefore`). Removal never deletes sessions or the
  directory.
- **`@monolith/session-projection`** (`ctx.sessionProjections`) — the seam built exactly for
  "derive current per-session state from the log without re-folding it downstream": a domain
  registers `{ key, stateSchema, init, apply, wire }`; carriers read `snapshot(session)` or
  subscribe via `onChanged`. This is the mechanism the plan's §6.1 ("map task status from
  durable events") asks for — it isn't something to build, only to use.
- **`api/session-controller`, `api/workspace-controller`** (`packages/api/*`) — the "typed
  controller/RPC" system §4 says to reuse. Shape: a Host `ctx.<x>Controller` service exposing
  unary Remote mutations (`commands.ts`) plus a `follow()` stream that emits one full baseline
  then ordered increments, with newer-`updatedAt`-wins and stream-beats-stale-unary-response
  conflict resolution — precisely the reload/reconnect semantics §6.1's acceptance criteria ask
  for (reload doesn't lose the task; a stale proposal needs rebase).
- **`@monolith/sandbox-policy`** (`ctx.sandboxPolicy`) — a session-scoped, restart-durable
  `SandboxMode` with a **closed two-value vocabulary**: `read-only` and `workspace-write`. It
  governs file effects only; network and process policy are explicitly out of its vocabulary
  ("File-effect modes only" — Known Limitations). This is narrower than
  `docs/adr/0001-task-modes-and-task-result-schema.md` Decision 1's three-tier
  `read_only`/`workspace_write`/`elevated` model, which also bundled network and shell-command
  policy into one "mode."
- **`@monolith/client-ui-approval`** + **`@monolith/permission-presets`** — a live, already-wired
  waterfall that pauses a Host operation and returns the browser's accept/deny decision to it.
  Presets already bundle a `SandboxMode` with an approval policy.

## Decision 1: Project = the engine's Workspace, not a new record

Do not create a new `Project` table. `packages/monolith/product-workspace` (new package, see
Decision 5) treats an `engine/core` `Workspace` record as the Project record the plan describes
in §11, adding only the fields `Workspace` doesn't carry: owner/organization id (needed ahead of
the team-mode gate in Phase 6) and an instructions revision pointer. Both attach as a
product-owned sidecar row keyed by `WorkspaceId`, not by widening the engine's own type — the
engine package stays product-agnostic per its "no privileged core" rule.

This directly satisfies §3's "a project maps to one workspace, but use distinct IDs so a future
remote workspace doesn't force a domain rewrite": `WorkspaceId` already *is* that distinct id.

## Decision 2: Run = one engine Session; Task = a new product record grouping Runs

A **Run** (§3: "one execution attempt for a task") is exactly one `engine/core` Session: one
continuous agent conversation with its own durable log, its own `AgentHandle`, its own
cancellation. Do not invent a parallel run-execution concept.

A **Task** (§3: "requested outcome and review history") is a new product record — it has no
engine analog — that:

- pins mode, expert version, workspace id, effective tool access, model policy, and source
  revisions **at run start**, per §6.1's acceptance criteria;
- owns an ordered list of Run attempts, each a `SessionId`;
- a retry creates a **new** Session forked from the failed one (`ctx.agents.create({ sessionId:
  <new>, seed: <from prior>, meta: { parentSession: <prior SessionId> } })`), never reuses or
  mutates a Run in place — this is what makes "retry identifies which actions already completed"
  (§5.5) and idempotent `startTask`/`resumeTask` calls (§6.1) tractable: a duplicate start
  request is a duplicate-key write against the Task's run list, not a second live agent.

Task records live in the new `product-workspace` package's own storage domain (Decision 5),
addressed by a generated `TaskId`, referencing `WorkspaceId` and an ordered `SessionId[]`.

## Decision 3: Task status is a session-projection unit, not a polled or hand-rolled state machine

Register one `ProjectionDefinition` per the active Run's
session, folding durable session events (`turn/start`, `turn/end`, `tool/result`,
`agent/turn-stopping`'s durable trace, session-end/error facts) into the closed status
vocabulary from §5.5: `Draft | Queued | Running | Waiting for input | Waiting for review |
Completed | Failed | Cancelled | Interrupted`. The `wire.view` becomes the Task/Run controller's
`follow()` payload (Decision 4). This is a straight application of the existing seam — no new
polling loop, no product-side event bus, and it inherits the seam's own reload guarantee: a
carrier reads a consistent `snapshot()` cut keyed by `asOfSeq`, so a reloading browser gets the
current state rather than replaying the whole log itself.

**Implemented** as `packages/monolith/product-workspace/src/run-status.ts`, registered by
`TaskRegistry` on start. Two corrections to this decision's sketch, made against the code rather
than the plan:

- The key is `taskRunStatus`, not `product/task-run-status`: every projection key the engine
  registers is a camelCase identifier, and a product key that alone carried a slash would read as
  a different kind of thing rather than as one more unit on the same registry.
- The unit derives the seven states a session log proves — `queued`, `running`,
  `waiting-for-input`, `completed`, `failed`, `cancelled`, `interrupted` — and deliberately not
  `Draft` or `Waiting for review`. A Draft Task has no Run to project, and a review decision is a
  product record that outlives any single Session (Decision 4's own `submitDecision` split says
  so). Both are Task-level, assembled by the controller over this unit's value; deriving them here
  would mean inventing facts the log does not carry.

`waiting-for-input` folds the `approval/asked`/`approval/decided` pair, whose ids pair one to one,
rather than observing the live approval waterfall: a status that only a running process knows is a
status a reload loses.

## Decision 4: Command surface = a new `api/product-task-controller` package, shaped like `workspace-controller`

Add `packages/api/product-task-controller`, mounted the same way `workspace-controller` is:
a Host `ctx.productTaskController` service plus a generated Client `ctx.remote.productTask`
namespace. `commands.ts` exposes the plan's §6.1 vocabulary as unary Remote methods —
`startTask`, `cancelRun`, `resumeTask`, `submitDecision`, `inspectTask` — each taking an
idempotency key on the mutating ones. `feed.ts` exposes `follow(taskId)`, backed by Decision 3's
projection plus the Task record's own durable fields (mode/expert/workspace pin).

`submitDecision` for a **tool-level** approval (a pending sandboxed operation) routes through
the existing `ui-approval` waterfall unchanged — it is not reimplemented. `submitDecision` for a
**task-level** review (accept/reject a proposed artifact or fix, §11's `Finding`/
`ReviewDecision`) is a new product-owned decision record; it does not reuse the tool-approval
event vocabulary, because a review decision must survive independently of any single live
Session and outlives the approval waterfall's request/response pairing.

No new HTTP API, no second WebSocket: this rides the existing Connection/Gateway transport
`api/README.md` already documents, per §4's explicit instruction.

## Decision 5: Mode/policy — reframe ADR 0001 Decision 1 around the engine's real vocabulary

ADR 0001's three-tier mode table does not survive contact with `engine/core` as a single
"mode" switch, because the engine already splits the concern the way §6.2 of the new plan
independently argues for ("classify operations as read, workspace mutation, external mutation,
process execution and network access... resolve policy on the host"):

| ADR 0001 concept | `engine/core` seam it now maps to |
| --- | --- |
| `read_only` / `workspace_write` file rules | `ctx.sandboxPolicy`'s native `read-only` / `workspace-write` `SandboxMode` — used as-is, not reimplemented |
| `elevated` (outside-workspace paths, system state) | Per-action approval through the existing `ui-approval` waterfall + `permission-presets`, **not** a third `SandboxMode` value — the engine's mode vocabulary is closed and file-effect-only by design |
| Network allow/deny | A separate policy axis outside `SandboxMode`'s vocabulary (confirmed: "network and process policy are outside its vocabulary") — Task's pinned policy carries its own `allowNetwork` flag enforced at the tool-registration/MCP layer, not folded into sandbox mode |
| `allowedTools` allowlist | A trusted agent-preset selection (§7) resolved to concrete tool composition at Task/Run start, per Decision 2's "pin ... effective tool access ... at run start" |

A Task's policy snapshot (§6.1) is therefore a triple — `{ sandboxMode, approvalPreset,
allowNetwork }` — resolved once at run start from a trusted preset, not a single mode enum.
ADR 0001's task-result JSON shape (files/commands/tests/artifacts/blockedActions) is retained
conceptually as the shape a Run's projection view should expose, but its authority moves from
"model-adjacent JSON someone writes" to "derived from the session log via Decision 3's
projection," matching this plan's "every model-visible fact must be reconstructable from the
log" invariant.

## Decision 6: New product code lives under `packages/monolith/`, composed as another patch layer

`packages/monolith/product-workspace` (Task/Run/Project sidecar storage + domain logic) and
`packages/api/product-task-controller` (the Remote surface) are ordinary Cordis packages,
mounted by adding rows to the existing `packages/monolith/bundle/cordis.patch.yml` — the same
single-file product delta the de-brand work already established as "the whole product delta"
(per that file's own header comment). No parallel server, no second patch mechanism. Both new
packages need a `package.json` with a real `monolith` field or they hit the build trap already
recorded in [[monolith-engine-debrand]] (`packages/*/*` glob treats any directory there as
buildable).

## Typed design sketch

```ts
// packages/monolith/product-workspace/src/types.ts
type TaskId = Branded<'TaskId'>

interface Task {
  readonly id: TaskId
  readonly workspaceId: WorkspaceId       // Decision 1: engine Workspace = Project
  readonly mode: 'cowork' | 'code'
  readonly expertVersion: string          // ExpertPackVersion id, pinned at first run
  readonly title: string
  readonly createdAt: string
  readonly runs: readonly SessionId[]     // Decision 2: append-only, oldest first
  readonly policy: TaskPolicy             // Decision 5
}

interface TaskPolicy {
  readonly sandboxMode: 'read-only' | 'workspace-write'  // engine-native, not reinvented
  readonly approvalPresetId: string
  readonly allowNetwork: boolean
}

// packages/api/product-task-controller/src/commands.ts
interface ProductTaskCommands {
  startTask(input: { workspaceId: WorkspaceId; mode: Task['mode']; expertVersion: string
    prompt: string; policy: TaskPolicy; idempotencyKey: string }): Promise<{ taskId: TaskId }>
  cancelRun(input: { taskId: TaskId; runId: SessionId }): Promise<void>
  resumeTask(input: { taskId: TaskId }): Promise<{ runId: SessionId }>
  submitDecision(input: { taskId: TaskId; decisionId: string
    outcome: 'accept' | 'reject'; note?: string }): Promise<void>
  inspectTask(input: { taskId: TaskId }): Promise<TaskSnapshot>
}

// packages/api/product-task-controller/src/feed.ts
declare function follow(taskId: TaskId): AsyncIterable<
  | { type: 'baseline'; task: TaskSnapshot }
  | { type: 'status'; runId: SessionId; status: TaskRunStatus }   // Decision 3's projection view
  | { type: 'decision-needed'; decisionId: string; kind: 'approval' | 'review' }
>
```

## Consequences

- Phase 1 tickets get concrete targets: **F03** = `product-workspace` package (Decision 1+2);
  **F04** = the `taskRunStatus` projection unit (Decision 3); **F05** = wiring Task
  policy resolution onto `sandboxPolicy` + `permission-presets` (Decision 5); the controller
  half of F03/F04 = `api/product-task-controller` (Decision 4).
- ADR 0001's mode table is superseded for anything running on `engine/core`; its task-result
  JSON shape survives as a *view* over Decision 3's projection, not an independently-authored
  document.
- Day 4 (verify bundle composition and product shell extension points) now has a concrete
  answer to verify against: two new packages, one new `cordis.patch.yml` insert block, mounted
  the same way `monolith-ui-brand` already is.
- Not decided here (deferred to their own tickets): the storage backend for `product-workspace`
  records (§11 says prefer `storage-domain` over SQLite directly — needs its own short spike),
  and the exact `ExpertPackVersion` resolution mechanism (Phase 4/E01 territory).
