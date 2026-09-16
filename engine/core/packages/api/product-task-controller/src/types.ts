/**
 * Browser-safe request, result, and failure vocabulary for the `productTask`
 * Remote namespace. A Task groups Run attempts; each Run is one engine
 * Session, so every identity here is either a product `TaskId` or an engine
 * `SessionId` — this package mints no third identity for an execution.
 */

import type { SessionId } from '@monolith/session/types'
import type { RunStatus, TaskId } from '@monolith/product-workspace/types'
import type { WorkspaceId } from '@monolith/workspace/types'

export type { TaskId, RunStatus } from '@monolith/product-workspace/types'

/**
 * Caller-minted key making a mutation safe to retransmit. A reconnecting
 * browser that never saw the first response resends the same key and receives
 * the first result, rather than starting a second Run against the same Task.
 */
export type TaskIdempotencyKey = string

/** One Task projected for browser consumers. */
export interface TaskView {
  readonly taskId: TaskId
  /** The Project this Task belongs to. */
  readonly workspaceId: WorkspaceId
  /** How the user is working. */
  readonly mode: 'cowork' | 'code'
  /** Display title. */
  readonly title: string
  /** ISO-8601 creation instant. */
  readonly createdAt: string
  /** ISO-8601 last-mutation instant. */
  readonly updatedAt: string
  /** Run attempts in start order; the last entry is the active Run. */
  readonly runIds: readonly SessionId[]
  /** The access policy pinned at creation. */
  readonly policy: TaskPolicyView
  /** Pinned expert-pack version; absent until an expert registry exists. */
  readonly expertVersion?: string
}

/** A Task's pinned access policy (ADR 0002 Decision 5's resolved triple). */
export interface TaskPolicyView {
  readonly sandboxMode: 'read-only' | 'workspace-write'
  readonly approvalPresetId: string
  readonly allowNetwork: boolean
}

/**
 * A Task's current status: its active Run's projected status, or `draft` when
 * no Run has started. `draft` exists only here and not in the projection unit,
 * because a Task without a Run has no session log to derive anything from.
 */
export type TaskStatus = RunStatus | 'draft'

/** One Task's status and the evidence behind it. */
export interface TaskStatusView {
  readonly status: TaskStatus
  /** The Run this status describes; absent for a `draft` Task. */
  readonly runId?: SessionId
  /** Turn-end reason behind a coarse status; null while running or before the first turn. */
  readonly endReason: string | null
  /** Tool names whose approval questions are awaiting an answer. */
  readonly awaitingApproval: readonly string[]
  /** Operations an approval answerer denied over the active Run's life. */
  readonly blockedActions: number
}

/**
 * What a Run is actually executing under, read back from its own session log.
 *
 * Distinct from the {@link TaskPolicyView} the caller asked for: a Task records
 * the request, and only the folded session knobs say what bound. `read-only`
 * here means the file sandbox will refuse writes, not that someone asked for
 * read-only.
 */
export interface EffectivePolicyView {
  /** The file-effect mode every confining capability resolves for this Run. */
  readonly sandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access'
  /**
   * The preset matching the Run's effective knobs, or `custom` when they match
   * no table entry — which is the normal reading when a Task pins a file mode
   * its approval preset does not carry.
   */
  readonly approvalPreset: string
  /** Whether this Run's agent keeps the deployment's network tools. */
  readonly allowNetwork: boolean
}

declare module '@monolith/typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** No Task record carries the requested identity. */
    'product-task/not-found': { readonly taskId: TaskId }
    /** The verb needs an active Run and the Task has none. */
    'product-task/no-active-run': { readonly taskId: TaskId }
    /** The requested approval preset is not in the deployment's table. */
    'product-task/unknown-preset': { readonly approvalPresetId: string }
    /** No Artifact record carries the requested identity, or the version is absent. */
    'product-artifact/not-found': { readonly artifactId: string }
    /** The path resolves outside the Project directory that owns the Task. */
    'product-artifact/outside-project': { readonly path: string }
    /** The file exceeds the deployment's read ceiling. */
    'product-artifact/too-large': { readonly bytes: number; readonly limit: number }
    /** The Task's Project is no longer a registered Workspace. */
    'product-artifact/no-project': { readonly taskId: TaskId }
  }
}

/** Request to create a Task and start its first Run. */
export interface StartTaskRequest {
  readonly idempotencyKey: TaskIdempotencyKey
  readonly workspaceId: WorkspaceId
  readonly mode: 'cowork' | 'code'
  /** The requested outcome, in the user's words. */
  readonly request: string
  /** Display title; defaults to a normalized prefix of `request`. */
  readonly title?: string
  /** Policy to pin for every Run of this Task. */
  readonly policy: TaskPolicyView
  readonly expertVersion?: string
}

/** The Task after `startTask`, with its first Run accounted. */
export interface StartTaskValue {
  readonly task: TaskView
  readonly runId: SessionId
  /** False when an earlier call with the same idempotency key produced this Task. */
  readonly started: boolean
}

/** Request to cancel a Task's active Run. */
export interface CancelRunRequest {
  readonly taskId: TaskId
}

/** Receipt after cancellation is admitted to the live Agent. */
export interface CancelRunValue {
  readonly cancelled: true
  readonly runId: SessionId
}

/** Request to retry a Task as a new Run forked from its last attempt. */
export interface ResumeTaskRequest {
  readonly idempotencyKey: TaskIdempotencyKey
  readonly taskId: TaskId
  /** Additional instruction for the retry; the forked history carries the rest. */
  readonly request: string
}

/** The Task after `resumeTask`, carrying the newly appended Run. */
export interface ResumeTaskValue {
  readonly task: TaskView
  readonly runId: SessionId
  /** False when an earlier call with the same idempotency key produced this Run. */
  readonly started: boolean
}

/** Request for one Task's record and current status. */
export interface InspectTaskRequest {
  readonly taskId: TaskId
}

/** One Task's record and the status derived from its active Run's log. */
export interface InspectTaskValue {
  readonly task: TaskView
  readonly status: TaskStatusView
  /**
   * What the active Run is actually running under; absent for a `draft` Task,
   * which has no Run whose knobs could be read.
   */
  readonly effectivePolicy?: EffectivePolicyView
}

/** One Artifact version projected for browser consumers. */
export interface ArtifactVersionView {
  readonly version: number
  /** The Run that produced these bytes. */
  readonly runId: SessionId
  /** Path relative to the owning Project's directory. */
  readonly path: string
  /** Lowercase hex sha256 of the bytes as registered. */
  readonly sha256: string
  readonly bytes: number
  readonly createdAt: string
}

/** One Artifact and every version of it. */
export interface ArtifactView {
  readonly artifactId: string
  readonly taskId: TaskId
  /** Name identifying this output within its Task. */
  readonly name: string
  readonly createdAt: string
  readonly updatedAt: string
  /** Versions in registration order, oldest first. */
  readonly versions: readonly ArtifactVersionView[]
}

/** Request to register the current bytes at a path as an output version. */
export interface RegisterArtifactRequest {
  readonly taskId: TaskId
  /** Name identifying the output; re-using it appends a version. */
  readonly name: string
  /** Path to the produced file, absolute or relative to the Project directory. */
  readonly path: string
}

/** The Artifact after registration, including the version just added. */
export interface RegisterArtifactValue {
  readonly artifact: ArtifactView
}

/** Request for every Artifact owned by one Task. */
export interface ListArtifactsRequest {
  readonly taskId: TaskId
}

/** Every Artifact owned by one Task, newest first. */
export interface ListArtifactsValue {
  readonly items: readonly ArtifactView[]
}

/** Request for one Artifact's record. */
export interface InspectArtifactRequest {
  readonly artifactId: string
}

/** One Artifact's record and versions. */
export interface InspectArtifactValue {
  readonly artifact: ArtifactView
}

/** Request for one Artifact version's bytes. */
export interface DownloadArtifactRequest {
  readonly artifactId: string
  /** Version to read; the newest when omitted. */
  readonly version?: number
}

/** One Artifact version's current bytes and whether they match the registration. */
export interface DownloadArtifactValue {
  readonly artifact: ArtifactView
  /** The version read. */
  readonly version: ArtifactVersionView
  /** Base64-encoded current bytes. */
  readonly data: string
  /** Digest of the bytes just read. */
  readonly sha256: string
  /**
   * Whether the file still hashes to what was registered. A false here is the
   * useful answer, not an error: the caller asked for the deliverable and is
   * told it changed since it was produced.
   */
  readonly verified: boolean
}

/** Request for every Task in one Project. */
export interface ListTasksRequest {
  readonly workspaceId: WorkspaceId
}

/** Every Task in one Project, newest first. */
export interface ListTasksValue {
  readonly items: readonly TaskView[]
}
