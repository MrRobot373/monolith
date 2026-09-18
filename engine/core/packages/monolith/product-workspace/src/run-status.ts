/**
 * The `taskRunStatus` projection unit: folds one Run's durable session log
 * into the Run status the product renders, per ADR 0002 (Task/Project/Run
 * ownership on `engine/core`, in the MONOLITH repository's root `docs/adr`
 * directory) Decision 3. A Run is one engine Session, so this unit's
 * per-session state is exactly one Run's state; a Task's status is this value
 * for its active Run, which the Task controller resolves.
 *
 * The unit derives only what the log proves. `Draft` and `Waiting for review`
 * from the plan's §5.5 vocabulary are absent here by construction: a Draft
 * Task has no Run to project, and a review decision is a product record that
 * outlives any single Session (ADR 0002 Decision 4), so neither is
 * reconstructable from session events. Everything else in that vocabulary is.
 *
 * @module @monolith/product-workspace/src/run-status
 */

import { z } from 'zod'
import type { ProjectionDefinition } from '@monolith/session-projection'
import type { TurnEndReason } from '@monolith/session'
import type { ApprovalRequestId } from '@monolith/user-approval/types'
import type { RunStatus, TaskRunStatusProjection } from './types.ts'

export type { PendingApproval, RunStatus, TaskRunStatusProjection } from './types.ts'

declare module '@monolith/session-projection/types' {
  interface SessionProjectionMap {
    taskRunStatus: TaskRunStatusProjection
  }

  interface SessionProjectionStateMap {
    taskRunStatus: TaskRunStatusProjection
  }
}

const runStatusSchema = z.object({
  status: z.enum([
    'queued',
    'running',
    'waiting-for-input',
    'completed',
    'failed',
    'cancelled',
    'interrupted',
  ]),
  turn: z.number().int().nonnegative().nullable(),
  endReason: z.string().nullable(),
  pendingApprovals: z.array(z.object({
    id: z.string().transform(value => value as ApprovalRequestId),
    toolName: z.string(),
  })),
  blockedActions: z.number().int().nonnegative(),
}).strict()

/**
 * Resolve the status a closed turn leaves behind.
 *
 * `max-tokens` reads as `completed` because the turn ended with output and a
 * plugin may have continued it; `endReason` carries the truncation so the UI
 * can say so. `blocked` reads as `failed` because a pre-step rejection
 * produced no result. {@link TurnEndReason} is merge-extensible, so an end
 * reason this build does not know falls through to `failed`: the run is no
 * longer running and nothing proves it succeeded, and claiming success for an
 * unrecognized terminal reason is the one error that would silently pass
 * unreviewed output to a user.
 *
 * @param reason - the turn-end reason from the `turn/end` event.
 * @returns the Run status that reason implies.
 */
function statusForTurnEnd(reason: TurnEndReason): RunStatus {
  switch (reason.kind) {
    case 'completed':
    case 'max-tokens':
      return 'completed'
    case 'aborted':
      return 'cancelled'
    case 'error':
    case 'blocked':
      return 'failed'
    case 'interrupted':
      return 'interrupted'
    default:
      return 'failed'
  }
}

/** The `taskRunStatus` unit registered on `ctx.sessionProjections`. */
export const taskRunStatusProjectionDefinition = {
  key: 'taskRunStatus',
  stateVersion: 1,
  stateSchema: runStatusSchema,
  init: () => ({
    status: 'queued' as const,
    turn: null,
    endReason: null,
    pendingApprovals: [],
    blockedActions: 0,
  }),
  apply: (state, event) => {
    // Every uninteresting event returns the same reference (Object.is gates the change feed).
    switch (event.type) {
      case 'turn/start':
        return { ...state, status: 'running', turn: event.data.turn, endReason: null }
      case 'turn/end':
        return {
          ...state,
          status: statusForTurnEnd(event.data.reason),
          turn: event.data.turn,
          endReason: event.data.reason.kind,
          // A turn cannot end with its own questions still open; the answerer
          // resolves every ask, including as 'cancelled' on an aborted turn.
          pendingApprovals: state.pendingApprovals.length === 0 ? state.pendingApprovals : [],
        }
      case 'approval/asked':
        return {
          ...state,
          status: 'waiting-for-input',
          pendingApprovals: [
            ...state.pendingApprovals,
            { id: event.data.id, toolName: event.data.toolName },
          ],
        }
      case 'approval/decided': {
        const pendingApprovals = state.pendingApprovals.filter(pending => pending.id !== event.data.id)
        if (pendingApprovals.length === state.pendingApprovals.length) return state
        return {
          ...state,
          // Only a Run that was waiting resumes; a decision landing after the
          // turn already closed (an imported or reordered log) must not
          // resurrect a terminal status.
          status: pendingApprovals.length > 0
            ? 'waiting-for-input'
            : state.status === 'waiting-for-input' ? 'running' : state.status,
          pendingApprovals,
          blockedActions: event.data.outcome === 'rejected'
            ? state.blockedActions + 1
            : state.blockedActions,
        }
      }
      default:
        return state
    }
  },
  wire: {
    viewSchema: runStatusSchema,
    // Every state field is client-visible, so the view is the state reference
    // itself: no allocation, and view identity tracks state identity exactly,
    // which is what the drive's Object.is gate wants.
    view: state => state,
  },
} satisfies ProjectionDefinition<'taskRunStatus', TaskRunStatusProjection>
