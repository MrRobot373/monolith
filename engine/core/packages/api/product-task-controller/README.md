---
description: "The product Task Remote namespace for browser callers that start, cancel, retry and inspect a Task over the transport the session and workspace namespaces already use."
kind: "package-reference"
---

# @monolith/api-product-task-controller

## Summary

`monolith-api-product-task-controller` serves the `productTask` Remote namespace: `startTask`, `cancelRun`, `resumeTask`, `inspectTask`, `listTasks`, and the artifact verbs `registerArtifact`, `listArtifacts`, `inspectArtifact` and `downloadArtifact`. It owns Task identity, the ordered Run account and the policy pinned at creation, and it binds that policy to the engine's own enforcement seams so a `read-only` Task is actually refused writes; it owns no execution. Every verb that starts, forks, prompts or stops a Run delegates to `ctx.sessionController`, because a Run is one engine Session and that lifecycle already has an owner. Mutating verbs take a caller-minted idempotency key, so a browser that retransmits over a reconnect gets its first result back instead of a second Run.

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
  policy: { sandboxMode: 'workspace-write', approvalPresetId: 'workspace-write', allowNetwork: false },
})
```

The policy binds before the Run is prompted: `sandboxMode` becomes a durable `sandbox/mode` event every confining capability resolves, `approvalPresetId` must name a preset the deployment defines, and a Task denying network loses the configured reaching tools on its agent.

`cancelRun` stops the Task's active Run. `resumeTask` retries: it forks the last attempt into a new Session and appends it, so the failed Run stays in the account as the record of what already happened.

### Read current state

`inspectTask` returns the Task record plus the status derived from its active Run's session log — `draft` for a Task that has started nothing, and otherwise whatever the `taskRunStatus` projection folds. Because the status is derived rather than stored, a reloading caller reads the same value the previous one saw.

It also returns `effectivePolicy`: what the Run is actually executing under, read back from the session's own knobs rather than echoed from the Task record. A Task pinning `read-only` whose approval preset bundles `workspace-write` reports `sandboxMode: 'read-only'` with `approvalPreset: 'custom'`, because the Task's file policy outranks the preset's and the resulting knobs match no table entry.

### Register and download outputs

An Artifact belongs to a Task, and the Task's Project supplies the directory its bytes must live inside — so an artifact id from another Project reaches nothing, and a path escaping the Project is refused at registration and again at read:

```ts
const { artifact } = await ctx.remote.productTask.registerArtifact({ taskId, name: 'report', path: 'out/report.md' })
const { data, verified } = await ctx.remote.productTask.downloadArtifact({ artifactId: artifact.artifactId })
```

`downloadArtifact` returns base64 bytes plus `verified`, which is false when the file changed after it was registered. The bytes still come back: the caller asked for the deliverable and is told what it is, rather than being refused.

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
| [`src/policy.ts`](src/policy.ts) | Binding a Task's pinned triple to `sandboxPolicy`, `permission-presets`, and the Run's tool scope |
| [`src/artifacts.ts`](src/artifacts.ts) | Artifact verbs, authorized through the owning Task's Project |
| [`src/types.ts`](src/types.ts) | Browser-safe request/result vocabulary and the namespace's error details |
| — | No runtime invariant companion is published because the Task registry is the single writer and the status it reports is a pure fold of the session log; no two independent observations can diverge. |
| [`tests/commands.host.spec.ts`](tests/commands.host.spec.ts) | Delegation, idempotency in all three shapes, retry-forks-a-new-Run, and status resolution |
| [`tests/policy.host.spec.ts`](tests/policy.host.spec.ts) | Policy binding asserted through `sandboxPolicy.resolve()`, with a negative control proving the assertion measures this package |
| [`tests/network-policy.host.spec.ts`](tests/network-policy.host.spec.ts) | Network denial per Run, including re-application to a second agent for the same Run |
| [`tests/artifacts.host.spec.ts`](tests/artifacts.host.spec.ts) | Artifact ownership, Project containment, provenance refusal, and the download ceiling |

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
- **Artifacts are registered by name, never derived** — nothing watches a Run's file writes, so an output exists only because a caller registered it.
- **A download is one base64 RPC response** — capped by `maxDownloadBytes` (25 MiB by default) because the whole file is encoded into a single reply. A streaming or ranged read is what a large deliverable needs.
- **No `follow` stream** — callers poll `inspectTask`. The projection's change feed already carries what a stream would publish; wiring it to a baseline-plus-increments generation is the next slice.
- **Idempotency is process-lifetime** — the key map guards a browser retransmitting to the same Host, not a duplicate that spans a Host restart. Surviving a restart needs the key on the durable Task record.
- **`cancelRun` and `resumeTask` act on the newest Run only** — a Task whose earlier attempt is somehow still live has no verb addressing it; nothing today can produce that state.
- **The network axis depends on a configured tool list** — `networkTools` defaults to empty, so a deployment that mounts reaching tools without listing them grants network access to every Run regardless of what its Task pinned. A name the composition does not mount is logged and skipped rather than failing the Run.
- **A cold Run reports no effective policy** — `inspectTask` reads the knobs from a live session, so a Task whose Run is not loaded returns `status` without `effectivePolicy` rather than replaying the log for it.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
