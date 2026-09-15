---
description: "The product Task Remote namespace for browser callers that start, cancel, retry and inspect a Task over the transport the session and workspace namespaces already use."
kind: "package-reference"
---

# @monolith/api-product-task-controller

## Summary

`monolith-api-product-task-controller` serves the `productTask` Remote namespace: `startTask`, `cancelRun`, `resumeTask`, `inspectTask` and `listTasks`. It owns Task identity, the ordered Run account and the policy pinned at creation; it owns no execution. Every verb that starts, forks, prompts or stops a Run delegates to `ctx.sessionController`, because a Run is one engine Session and that lifecycle already has an owner. Mutating verbs take a caller-minted idempotency key, so a browser that retransmits over a reconnect gets its first result back instead of a second Run.

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

Reach for this namespace when a caller wants an *outcome* tracked across attempts — started, watched, retried, reviewed. A caller that only wants one conversation wants the `session` namespace directly; a Task exists to hold the second attempt and the policy both attempts share.

### Start, cancel and retry

`startTask` creates the Task and its first Run in one call. The idempotency key is the caller's, and resending it returns the original result with `started: false`:

```ts
const { task, runId } = await ctx.remote.productTask.startTask({
  idempotencyKey: crypto.randomUUID(),
  workspaceId,
  mode: 'code',
  request: 'Fix the failing tests',
  policy: { sandboxMode: 'workspace-write', approvalPresetId: 'default', allowNetwork: false },
})
```

`cancelRun` stops the Task's active Run. `resumeTask` retries: it forks the last attempt into a new Session and appends it, so the failed Run stays in the account as the record of what already happened.

### Read current state

`inspectTask` returns the Task record plus the status derived from its active Run's session log — `draft` for a Task that has started nothing, and otherwise whatever the `taskRunStatus` projection folds. Because the status is derived rather than stored, a reloading caller reads the same value the previous one saw.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design concept

The package is deliberately thin. `ProductTaskCommands` holds three responsibilities: which Task a request belongs to, which Runs that Task has attempted, and which policy was pinned. Everything else is delegation. Driving `ctx.agents` from here would recreate the parallel run-execution concept ADR 0002 Decision 2 rules out, and would put two owners on one Session's lifecycle.

Idempotency stores the in-flight Promise rather than the settled result, so two concurrent retransmissions of one request await a single execution instead of racing to create two Tasks. A start that *fails* releases its key: the caller received no Task, so the request never took effect and may be made again.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | `ProductTaskController`: the `@Remote` surface and its service registration |
| [`src/commands.ts`](src/commands.ts) | Task identity, the Run account, idempotency, and stable Remote failure mapping |
| [`src/types.ts`](src/types.ts) | Browser-safe request/result vocabulary and the namespace's error details |
| — | No runtime invariant companion is published because the Task registry is the single writer and the status it reports is a pure fold of the session log; no two independent observations can diverge. |
| [`tests/commands.host.spec.ts`](tests/commands.host.spec.ts) | Delegation, idempotency in all three shapes, retry-forks-a-new-Run, and status resolution |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [`@monolith/product-workspace`](../../monolith/product-workspace/README.md) — the Task registry and the `taskRunStatus` projection this namespace reads.
- [`@monolith/api-workspace-controller`](../workspace-controller/README.md) — the controller shape this package mirrors.
- ADR 0002, Task/Project/Run ownership on `engine/core`, in the MONOLITH repository's root `docs/adr` directory — Decision 4 specifies this surface.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers nothing model-facing.

#### KV Cache effect

Nothing here enters a model request, so provider cache reuse is unaffected.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No `submitDecision` verb** — ADR 0002 Decision 4 splits it in two: a tool-level approval routes through the existing `ui-approval` waterfall, and a task-level review is a product decision record that outlives any single Session. That record does not exist yet, so neither half is served.
- **No `follow` stream** — callers poll `inspectTask`. The projection's change feed already carries what a stream would publish; wiring it to a baseline-plus-increments generation is the next slice.
- **Idempotency is process-lifetime** — the key map guards a browser retransmitting to the same Host, not a duplicate that spans a Host restart. Surviving a restart needs the key on the durable Task record.
- **`cancelRun` and `resumeTask` act on the newest Run only** — a Task whose earlier attempt is somehow still live has no verb addressing it; nothing today can produce that state.
- **Policy is recorded, not enforced** — the pinned `sandboxMode`/`approvalPresetId`/`allowNetwork` triple is stored on the Task and passed to nothing. Resolving it onto `sandboxPolicy` and `permission-presets` at Run start is F05.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
