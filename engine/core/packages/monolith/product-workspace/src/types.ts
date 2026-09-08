/**
 * Public type vocabulary of the product Task record: the `TaskId` brand and
 * the `Task`/`TaskPolicy` consumer interfaces. Types only, matching the
 * `@monolith/workspace` package's own `types.ts` convention.
 *
 * See `docs/adr/0002-task-project-run-ownership-on-engine-core.md`: a Task is
 * a new product record grouping Run attempts, where each Run is one
 * `engine/core` Session (never a new execution concept of its own), and a
 * Task's `workspaceId` addresses the existing `@monolith/workspace` record
 * MONOLITH treats as its Project.
 * @module @monolith/product-workspace/src/types
 */

import type { Branded } from '@monolith/brand'
import type { SessionId } from '@monolith/session'
import type { WorkspaceId } from '@monolith/workspace'

/** Identifies one Task record. A generated uuid, stable for the Task's life. */
export type TaskId = Branded<'TaskId'>

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
