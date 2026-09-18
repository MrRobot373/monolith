/**
 * Public type vocabulary of the product Task record and the Run-status
 * projection: the `TaskId` brand, the `Task`/`TaskPolicy` consumer
 * interfaces, and the projected `RunStatus` value. Types only, matching the
 * `@monolith/workspace` package's own `types.ts` convention, so a browser
 * consumer reads this vocabulary without the Host cordis merges the package
 * root carries.
 *
 * See ADR 0002 (Task/Project/Run ownership on `engine/core`, in the MONOLITH
 * repository's root `docs/adr` directory): a Task is
 * a new product record grouping Run attempts, where each Run is one
 * `engine/core` Session (never a new execution concept of its own), and a
 * Task's `workspaceId` addresses the existing `@monolith/workspace` record
 * MONOLITH treats as its Project.
 * @module @monolith/product-workspace/src/types
 */

import type { Branded } from '@monolith/brand'
import type { SessionId } from '@monolith/session'
import type { ApprovalRequestId } from '@monolith/user-approval/types'
import type { WorkspaceId } from '@monolith/workspace'

/** Identifies one Task record. A generated uuid, stable for the Task's life. */
export type TaskId = Branded<'TaskId'>

/**
 * A Run's status: the subset of the plan's §5.5 task-status vocabulary that a
 * session log proves. `queued` covers a Session that exists but has opened no
 * turn; `interrupted` is the engine's own crash-orphaned turn closer, not a
 * product guess about a missing process. `Draft` and `Waiting for review` are
 * absent by construction — see `src/run-status.ts` for why neither is
 * derivable from a log.
 */
export type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting-for-input'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted'

/** One approval question the Run is blocked on, awaiting an answer. */
export interface PendingApproval {
  /** Pairs with the `approval/decided` event that resolves this question. */
  readonly id: ApprovalRequestId

  /** The tool the question is about, for the "waiting on" line the UI renders. */
  readonly toolName: string
}

/**
 * One Run's projected status. Serves as both the host fold state and the
 * client view: every field is client-visible, so the unit holds no internal
 * bookkeeping the view would have to hide.
 */
export interface TaskRunStatusProjection {
  /** Current status, derived from the events folded so far. */
  readonly status: RunStatus

  /** The turn this status describes; null before the Run's first turn opens. */
  readonly turn: number | null

  /**
   * `kind` of the turn-end reason that closed the last turn; null while a turn
   * is open or before the first one. Carries the exact reason behind a coarse
   * `completed`/`failed` status — `max-tokens` distinguishes truncated output
   * from a clean finish, `blocked` a policy rejection from a crash.
   */
  readonly endReason: string | null

  /**
   * Approval questions awaiting an answer, oldest first. The array type stays
   * mutable because the projection seam infers the unit's state from its zod
   * schema, whose parse output is mutable; the fold never writes through it.
   */
  readonly pendingApprovals: PendingApproval[]

  /** Operations denied by an approval answerer over this Run's life. */
  readonly blockedActions: number
}

/**
 * A Task's resolved access policy, pinned at Task creation (ADR 0002 Decision
 * 5). `sandboxMode` is the engine's own closed `SandboxMode` vocabulary, used
 * as-is rather than reinvented; `approvalPresetId` and `allowNetwork` cover
 * what that vocabulary deliberately excludes (elevated/outside-workspace
 * effects and network policy).
 */
export interface TaskPolicy {
  /** The engine-native file-effect mode this Task's runs execute under. */
  readonly sandboxMode: 'read-only' | 'workspace-write'

  /** Id of the trusted approval preset governing elevated/outside-workspace requests. */
  readonly approvalPresetId: string

  /** Whether this Task's runs may reach the network at all. */
  readonly allowNetwork: boolean
}

/**
 * One Task: a requested outcome and its review history (plan §3). Holds an
 * ordered list of Run attempts — each a `SessionId` — and the policy/expert
 * snapshot pinned when the first Run started. Consumers only see this
 * interface; the stored record shape stays private to `spec.ts`.
 */
export interface Task {
  /** Stable record id (generated uuid). */
  readonly id: TaskId

  /** The Project this Task belongs to (an existing `@monolith/workspace` record). */
  readonly workspaceId: WorkspaceId

  /** How the user is working: Cowork or Code (plan §3). */
  readonly mode: 'cowork' | 'code'

  /** Pinned expert-pack version id; unset until an expert-pack resolver exists (Phase 4). */
  readonly expertVersion: string | undefined

  /** Display title for the task list; defaults to a normalized prefix of the request. */
  readonly title: string

  /** ISO-8601 creation instant, stamped at create and never rewritten. */
  readonly createdAt: string

  /** ISO-8601 instant of the last durable mutation (create counts as one). */
  readonly updatedAt: string

  /** Run attempts in start order; a retry appends a new forked Session, never rewrites one. */
  readonly runs: readonly SessionId[]

  /** The policy pinned at first-run start (ADR 0002 Decision 5). */
  readonly policy: TaskPolicy
}
