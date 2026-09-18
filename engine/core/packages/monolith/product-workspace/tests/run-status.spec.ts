/**
 * The `taskRunStatus` projection unit: a Run's status folded from its durable
 * session log. Every turn-end reason the engine can record is pinned to the
 * product status it produces, because that mapping is the whole unit — a
 * wrong one shows a user a green Completed for a turn that a policy blocked.
 * Approval pairing is pinned in both directions (a second open question keeps
 * the Run waiting; a decision after the turn closed does not resurrect a
 * terminal status), and the replay test is the reload guarantee: the status
 * is a function of the log alone, so a reloading browser recomputes it rather
 * than depending on live process state.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@monolith/cordis'
import SessionStore, { SessionId } from '@monolith/session'
import type { Session } from '@monolith/session'
import SessionProjectionRegistry from '@monolith/session-projection'
import { ApprovalRequestId } from '@monolith/user-approval/types'
import { taskRunStatusProjectionDefinition } from '../src/run-status.ts'
import type { TaskRunStatusProjection } from '../src/run-status.ts'

/** Mount the projection registry and register the unit under test. */
async function harness(id = 'run-1'): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  ctx.sessionProjections.register(taskRunStatusProjectionDefinition)
  return { ctx, session: ctx.sessions.create(SessionId(id)) }
}

/** Read the unit's current value for a session. */
function statusOf(ctx: Context, session: Session): TaskRunStatusProjection {
  return ctx.sessionProjections.snapshot(session).values.taskRunStatus as TaskRunStatusProjection
}

/** The initial projection plus overrides, for exact fold expectations. */
function projected(overrides: Partial<TaskRunStatusProjection> = {}): TaskRunStatusProjection {
  return {
    status: 'queued',
    turn: null,
    endReason: null,
    pendingApprovals: [],
    blockedActions: 0,
    ...overrides,
  }
}

describe('taskRunStatus projection unit', () => {
  it('reports queued for a session that has opened no turn', async () => {
    const { ctx, session } = await harness()
    expect(statusOf(ctx, session)).toEqual(projected())
  })

  it('reports running once a turn opens', async () => {
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    expect(statusOf(ctx, session)).toEqual(projected({ status: 'running', turn: 1 }))
  })

  it('clears the previous end reason when the next turn opens', async () => {
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'error', error: { message: 'boom', code: 'UNKNOWN' } } })
    session.append('turn/start', { turn: 2 })
    expect(statusOf(ctx, session)).toEqual(projected({ status: 'running', turn: 2 }))
  })

  it('maps a completed turn to completed', async () => {
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    expect(statusOf(ctx, session)).toEqual(
      projected({ status: 'completed', turn: 1, endReason: 'completed' }),
    )
  })

  it('maps a max-tokens turn to completed and keeps the truncation in endReason', async () => {
    // The turn ended with output and a plugin may have continued it, so the
    // status is not a failure; only endReason tells the UI it was truncated.
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'max-tokens' } })
    expect(statusOf(ctx, session)).toEqual(
      projected({ status: 'completed', turn: 1, endReason: 'max-tokens' }),
    )
  })

  it('maps an aborted turn to cancelled', async () => {
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'legacy' } } })
    expect(statusOf(ctx, session)).toEqual(
      projected({ status: 'cancelled', turn: 1, endReason: 'aborted' }),
    )
  })

  it('maps an errored turn to failed', async () => {
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'error', error: { message: 'boom', code: 'UNKNOWN' } } })
    expect(statusOf(ctx, session)).toEqual(
      projected({ status: 'failed', turn: 1, endReason: 'error' }),
    )
  })

  it('maps a blocked turn to failed rather than completed', async () => {
    // A pre-step rejection produced no result; reporting it as Completed would
    // present an unproduced outcome as a finished one.
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'blocked' } })
    expect(statusOf(ctx, session)).toEqual(
      projected({ status: 'failed', turn: 1, endReason: 'blocked' }),
    )
  })

  it('maps the crash-orphaned turn closer to interrupted', async () => {
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'interrupted' } })
    expect(statusOf(ctx, session)).toEqual(
      projected({ status: 'interrupted', turn: 1, endReason: 'interrupted' }),
    )
  })

  it('waits for input while an approval question is open and resumes when it is answered', async () => {
    const { ctx, session } = await harness()
    const id = ApprovalRequestId('ask-1')
    session.append('turn/start', { turn: 1 })
    session.append('approval/asked', { id, toolName: 'bash' })
    expect(statusOf(ctx, session)).toEqual(projected({
      status: 'waiting-for-input',
      turn: 1,
      pendingApprovals: [{ id, toolName: 'bash' }],
    }))

    session.append('approval/decided', { id, outcome: 'allowed-once' })
    expect(statusOf(ctx, session)).toEqual(projected({ status: 'running', turn: 1 }))
  })

  it('keeps waiting while a second question is still open', async () => {
    const { ctx, session } = await harness()
    const first = ApprovalRequestId('ask-1')
    const second = ApprovalRequestId('ask-2')
    session.append('turn/start', { turn: 1 })
    session.append('approval/asked', { id: first, toolName: 'bash' })
    session.append('approval/asked', { id: second, toolName: 'write' })
    session.append('approval/decided', { id: first, outcome: 'allowed-once' })
    expect(statusOf(ctx, session)).toEqual(projected({
      status: 'waiting-for-input',
      turn: 1,
      pendingApprovals: [{ id: second, toolName: 'write' }],
    }))
  })

  it('counts a rejected operation as a blocked action', async () => {
    const { ctx, session } = await harness()
    const id = ApprovalRequestId('ask-1')
    session.append('turn/start', { turn: 1 })
    session.append('approval/asked', { id, toolName: 'bash' })
    session.append('approval/decided', { id, outcome: 'rejected' })
    expect(statusOf(ctx, session)).toEqual(
      projected({ status: 'running', turn: 1, blockedActions: 1 }),
    )
  })

  it('does not count an unavailable or cancelled answer as a blocked action', async () => {
    // Fail-closed 'unavailable' denies the operation too, but it records an
    // absent answerer, not a user's decision to block the agent.
    const { ctx, session } = await harness()
    const id = ApprovalRequestId('ask-1')
    session.append('turn/start', { turn: 1 })
    session.append('approval/asked', { id, toolName: 'bash' })
    session.append('approval/decided', { id, outcome: 'unavailable' })
    expect(statusOf(ctx, session).blockedActions).toBe(0)
  })

  it('drops open questions when the turn that raised them ends', async () => {
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    session.append('approval/asked', { id: ApprovalRequestId('ask-1'), toolName: 'bash' })
    session.append('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'legacy' } } })
    expect(statusOf(ctx, session)).toEqual(
      projected({ status: 'cancelled', turn: 1, endReason: 'aborted' }),
    )
  })

  it('does not resurrect a terminal status when a decision lands after the turn closed', async () => {
    const { ctx, session } = await harness()
    const id = ApprovalRequestId('ask-1')
    session.append('turn/start', { turn: 1 })
    session.append('approval/asked', { id, toolName: 'bash' })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    session.append('approval/decided', { id, outcome: 'allowed-once' })
    expect(statusOf(ctx, session).status).toBe('completed')
  })

  it('stays silent for events the unit does not fold', async () => {
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    const changes: unknown[] = []
    ctx.sessionProjections.onChanged((_session, key, value) => {
      if (key === 'taskRunStatus') changes.push(value)
    })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('step/end', { turn: 1, step: 1 })
    expect(changes).toEqual([])
  })

  it('recomputes the same status from the log alone, which is what survives a reload', async () => {
    const append = (session: Session): void => {
      session.append('turn/start', { turn: 1 })
      session.append('approval/asked', { id: ApprovalRequestId('ask-1'), toolName: 'bash' })
      session.append('approval/decided', { id: ApprovalRequestId('ask-1'), outcome: 'rejected' })
      session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    }

    const live = await harness('run-live')
    append(live.session)
    const reloaded = await harness('run-reloaded')
    append(reloaded.session)

    expect(statusOf(reloaded.ctx, reloaded.session)).toEqual(statusOf(live.ctx, live.session))
    expect(statusOf(reloaded.ctx, reloaded.session)).toEqual(
      projected({ status: 'completed', turn: 1, endReason: 'completed', blockedActions: 1 }),
    )
  })
})
