/**
 * Public type vocabulary of the product Artifact record: the `ArtifactId`
 * brand and the `Artifact`/`ArtifactVersion` consumer interfaces. Types only,
 * matching the `@monolith/product-workspace` convention, so a browser
 * consumer reads this vocabulary without the Host cordis merges.
 *
 * An Artifact is a versioned output with evidence (plan §3). "Evidence" is
 * the concrete part: each version records which Run produced it and the
 * digest of the bytes at the moment it was registered, so a later read can
 * say whether what is on disk is still what was produced.
 *
 * @module @monolith/product-artifacts/src/types
 */

import type { Branded } from '@monolith/brand'
import type { SessionId } from '@monolith/session'
import type { TaskId } from '@monolith/product-workspace/types'

/** Identifies one Artifact across its versions. A generated uuid. */
export type ArtifactId = Branded<'ArtifactId'>

/** One registered version of an Artifact's bytes. */
export interface ArtifactVersion {
  /** 1-based, contiguous, and never reused: the Nth registration of this name. */
  readonly version: number

  /** The Run that produced these bytes. */
  readonly runId: SessionId

  /** Path relative to the owning Project's directory. */
  readonly path: string

  /** Lowercase hex sha256 of the bytes as registered. */
  readonly sha256: string

  /** Byte length as registered. */
  readonly bytes: number

  /** ISO-8601 registration instant. */
  readonly createdAt: string
}

/**
 * One Artifact: a named output of one Task, and every version of it. The name
 * is the identity a caller re-registers against, so producing the same
 * deliverable twice appends a version instead of overwriting the first —
 * §5.3's "default to versioned copies" as a storage rule rather than a UI
 * convention.
 */
export interface Artifact {
  readonly id: ArtifactId

  /** The Task that owns this output; also the authorization boundary. */
  readonly taskId: TaskId

  /** Caller-supplied name, unique within its Task. */
  readonly name: string

  /** ISO-8601 instant the first version was registered. */
  readonly createdAt: string

  /** ISO-8601 instant the newest version was registered. */
  readonly updatedAt: string

  /** Every version in registration order, oldest first. */
  readonly versions: readonly ArtifactVersion[]
}
