---
description: "The MONOLITH product Task registry and Run-status projection for product packages that group engine Sessions into reviewable Tasks under a Workspace."
kind: "package-reference"
---

# @monolith/product-workspace

## Summary

`monolith-product-workspace` owns the product records the agent harness has no concept of: a **Task** — a requested outcome and its review history — grouping the **Run** attempts that produced it, where each Run is one existing engine Session and the owning **Project** is one existing `@monolith/workspace` record. It contributes two things: a durable registry (`ctx.productTasks`) for Task records, and the `taskRunStatus` projection unit that folds a Run's session log into the status a user sees. It creates no session, runs no agent, and never becomes a second conversation store; execution, cancellation and history stay the engine's.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

### When to use it

Mount it wherever the product needs a Task identity that outlives any single Run: a retry, a reload, or a review decision made after the agent stopped. Code that only needs one conversation's state wants `@monolith/session` directly — a Task exists to hold the *second* attempt, the pinned policy, and the outcome a user still has to accept.

### Record a Task and its Runs

`ctx.productTasks` creates Task records and appends Run attempts. A Run id is an engine `SessionId`; appending never rewrites an earlier entry, because a retry is always a new forked Session rather than a mutation of the attempt that failed:

```ts
const task = await ctx.productTasks.createTask({
  workspaceId,
  mode: 'code',
  title: 'Fix failing tests',
  policy: { sandboxMode: 'workspace-write', approvalPresetId: 'default', allowNetwork: false },
})

await ctx.productTasks.appendRun(task.id, sessionId)
```

`getTask` and `listTasksForWorkspace` read synchronously from memory; both reflect every durable write, so a reopened process serves the same records.

### Read a Run's status

The `taskRunStatus` projection unit serves one Run's current status through the ordinary projection seam — `ctx.sessionProjections.snapshot(session)` or the change feed — so a carrier never folds the log itself:

```ts
const { status, endReason, pendingApprovals } = ctx.sessionProjections.snapshot(session).values.taskRunStatus
```

`status` is one of `queued`, `running`, `waiting-for-input`, `completed`, `failed`, `cancelled` or `interrupted`. `endReason` carries the exact `turn/end` reason behind a coarse status, so a caller can distinguish output truncated at the token ceiling from a clean finish, or a policy rejection from a crash.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design concept

The package adds records to the engine rather than layers over it. A Project is not a new table: it is the `Workspace` record the engine already persists. A Run is not a new execution concept: it is one Session, with its own durable log, its own `AgentHandle` and its own cancellation. Only the Task is new, because the engine has no grouping above a single conversation.

Task status is therefore derived, never stored. The registry writes no status field; the projection unit folds `turn/start`, `turn/end`, `approval/asked` and `approval/decided` into the current value, so the status a browser renders after a reload is recomputed from the durable log rather than restored from live process state. Two states in the product's status vocabulary are deliberately absent from the unit: a Draft Task has no Run to project, and a review decision outlives any single Session, so neither is reconstructable from session events and both belong to the Task record instead.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | `TaskRegistry` (`ctx.productTasks`): durable Task records, Run append, projection registration |
| [`src/run-status.ts`](src/run-status.ts) | The `taskRunStatus` projection unit: session events folded into a Run's status |
| [`src/spec.ts`](src/spec.ts) | Storage-domain declaration and the schemas validating records at the durability boundary |
| [`src/types.ts`](src/types.ts) | `TaskId`, `Task` and `TaskPolicy` — the consumer-facing type vocabulary |
| — | No runtime invariant companion is published because no two independent observations of a Task can diverge: the registry is the single writer, and the projection is a pure fold of the log. |
| [`tests/task-registry.spec.ts`](tests/task-registry.spec.ts) | Create, read, list, Run append and reopened-backend coverage |
| [`tests/run-status.spec.ts`](tests/run-status.spec.ts) | Every turn-end reason mapping, approval pairing and log-replay determinism |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [`@monolith/workspace`](../../workspace/workspace/README.md) — the Workspace record this package treats as a Project.
- [`@monolith/session-projection`](../../session/session-projection/README.md) — the seam that drives the `taskRunStatus` unit and serves it to carriers.
- ADR 0002, Task/Project/Run ownership on `engine/core`, in the MONOLITH repository's root `docs/adr` directory — the decisions this package implements.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers nothing model-facing.

#### KV Cache effect

Nothing here enters a model request, so provider cache reuse is unaffected.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No controller surface yet** — Task operations are a Host service only; the typed Remote commands (`startTask`, `cancelRun`, `resumeTask`, `submitDecision`, `inspectTask`) and their idempotency keys are not implemented, so nothing enforces double-submit protection at the command boundary.
- **A Task record and its display order are not jointly crash-recoverable** — a process crash between the two writes can leave a record absent from the order list, recoverable by table scan but not yet recovered automatically.
- **Task-level status is not assembled** — the projection serves one Run's status; resolving a Task's status across its Run attempts, including `Draft` and `Waiting for review`, belongs to the controller that does not exist yet.
- **`expertVersion` is unvalidated** — the field is a pinned string until an expert-pack registry exists to resolve it.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
