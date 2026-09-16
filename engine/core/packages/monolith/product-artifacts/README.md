---
description: "The MONOLITH artifact registry for product packages that need a Task's outputs versioned, contained inside their Project, and checkable against the bytes that were produced."
kind: "package-reference"
---

# @monolith/product-artifacts

## Summary

`monolith-product-artifacts` records the outputs a Task produced: a named **Artifact** owned by one Task, and a version for each time that name was registered. Every version carries the Run that produced it, the file's path inside the Project, and the sha256 of the bytes at that moment. Reading a version re-hashes the file and reports whether it still matches, which is what lets a caller say a deliverable is verified instead of merely present. The registry stores metadata only — never a copy of the bytes.

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

Reach for it when a file is an *outcome* rather than a working file: something a user will open, download or review, and will want again after the next run changes it. Ordinary files a Run reads and writes are the filesystem's business; an Artifact exists because someone will ask "is this still the report the agent produced?".

### Register a produced file

Registration hashes what is on disk right now and appends a version. Re-using a name is the normal case, not a conflict:

```ts
const artifact = await ctx.productArtifacts.registerVersion({
  taskId, runId, name: 'report', projectRoot, path: 'out/report.md',
})
```

`projectRoot` is the boundary: a path resolving outside it is refused, symlinks included. The returned record carries every version, oldest first.

### Read one back

```ts
const { bytes, verified } = await ctx.productArtifacts.readVersion(artifact.id, projectRoot, undefined, maxBytes)
```

`verified` is false when the file changed after registration. That is an answer, not a failure — the caller still receives the current bytes and can decide what a changed deliverable means.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design concept

The registry deliberately does not own content. Copying bytes into storage would make the registry authoritative and leave the workspace copy free to drift with nobody noticing; keeping a digest instead means the workspace file stays the deliverable and the registry stays the evidence about it.

Containment resolves symlinks on both the root and the target, and is re-checked on every read rather than trusted from registration. A path that was inside the Project when it was registered can be a link pointing out of it by the time it is read, and only the second check catches that.

Versions are append-only. Nothing rewrites or removes one, so a Task's output history survives every later run against the same name — which is what `§5.3`'s "default to versioned copies" means once it reaches storage.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | `ArtifactRegistry` (`ctx.productArtifacts`): registration, listing, containment, and verified reads |
| [`src/spec.ts`](src/spec.ts) | Storage-domain declaration and the schemas validating records at the durability boundary |
| [`src/types.ts`](src/types.ts) | `ArtifactId`, `Artifact` and `ArtifactVersion` — the consumer-facing type vocabulary |
| — | No runtime invariant companion is published because the registry is the single writer and its one derived claim, `verified`, is recomputed from the file at each read rather than stored. |
| [`tests/artifact-registry.spec.ts`](tests/artifact-registry.spec.ts) | Versioning, containment including both symlink directions, and tamper detection over a real temp directory |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [`@monolith/product-workspace`](../product-workspace/README.md) — the Task records these outputs belong to.
- [`@monolith/api-product-task-controller`](../../api/product-task-controller/README.md) — the Remote surface that authorizes access to them.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers nothing model-facing.

#### KV Cache effect

Nothing here enters a model request, so provider cache reuse is unaffected.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Nothing registers artifacts automatically** — a Run producing a file does not create an Artifact; a caller must name the output. Deriving registrations from the session log's file-tool events would make the registry complete without asking, and is not done.
- **No media type or preview support** — a version records bytes and a digest, not what kind of document it is. The viewer registry U04 needs is not here.
- **Deleting a Task leaves its artifacts** — nothing cascades, so records can outlive the Task that owns them and become unreachable through the controller rather than being cleaned up.
- **A version's bytes are not retained** — reading an older version reads today's file at that path, so a superseded version reports `verified: false` rather than returning what it originally held. Retaining content would need a content-addressed store this package deliberately does not have.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
