/**
 * Task commands over a real Task registry, Session store and projection
 * registry, with the Session controller replaced by a recording double. The
 * double is the point rather than a shortcut: these tests pin that the product
 * layer *delegates* every execution verb, so a regression that started driving
 * `ctx.agents` directly — the parallel run-execution concept ADR 0002 Decision
 * 2 forbids — fails here instead of being discovered in the app.
 *
 * Idempotency is pinned in the three shapes that actually occur: a sequential
 * retransmission, two concurrent retransmissions of one request, and a retry
 * after a failed start, which must be allowed to proceed because it produced
 * no Task.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@monolith/cordis'
import Storage from '@monolith/storage'
import { DomainFacility } from '@monolith/storage-domain'
import SessionStore, { SessionId } from '@monolith/session'
import type { Session, SessionEvent, SessionHeader, SessionLogOffset } from '@monolith/session'
import SessionProjectionRegistry from '@monolith/session-projection'
import TaskRegistry from '@monolith/product-workspace'
import { WorkspaceId } from '@monolith/workspace'
import { remoteErrorOf } from '@monolith/typert-protocol'
import {
  MemoryMediaPool,
  MemoryStorageBackend,
} from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import { ProductTaskCommands } from '../src/commands.ts'
import type { StartTaskRequest, TaskPolicyView } from '../src/types.ts'

const POLICY: TaskPolicyView = {
  sandboxMode: 'workspace-write',
  approvalPresetId: 'default',
  allowNetwork: false,
}

const WORKSPACE = WorkspaceId('ws-1')

/** A Session controller double that records calls and mints real Sessions. */
class SessionControllerDouble {
  readonly created: { workspaceId?: WorkspaceId }[] = []
  readonly prompts: { sessionId: SessionId; text: string }[] = []
  readonly cancelled: SessionId[] = []
  readonly forked: SessionId[] = []
  private next = 0

  constructor(private readonly ctx: Context) {}

  create(request: { workspaceId?: WorkspaceId }): Promise<{ sessionId: SessionId }> {
    this.created.push(request)
    return Promise.resolve({ sessionId: this.mint() })
  }

  fork(request: { sessionId: SessionId }): Promise<{ sessionId: SessionId }> {
    this.forked.push(request.sessionId)
    return Promise.resolve({ sessionId: this.mint() })
  }

  prompt(request: { sessionId: SessionId; content: readonly { type: string; text?: string }[] }):
  Promise<{ accepted: true }> {
    this.prompts.push({ sessionId: request.sessionId, text: request.content[0]?.text ?? '' })
    return Promise.resolve({ accepted: true })
  }

  cancel(request: { sessionId: SessionId }): { accepted: true } {
    this.cancelled.push(request.sessionId)
    return { accepted: true }
  }

  private mint(): SessionId {
    this.next += 1
    const id = SessionId(`run-${this.next}`)
    this.ctx.sessions.create(id)
    return id
  }
}

/**
 * Serves stored logs for Runs whose Session is not live — the state every Run
 * is in after a Host restart.
 */
class SessionQueryDouble {
  private readonly logs = new Map<string, {
    session: SessionHeader
    inheritedEventCount: SessionLogOffset
    events: readonly SessionEvent[]
  }>()

  constructor(private readonly ctx: Context) {}

  /** Record a cold Run's log by building it on a throwaway live Session. */
  store(runId: SessionId, build: (session: Session) => void): void {
    const source = this.ctx.sessions.create(SessionId(`${runId}-source`))
    build(source)
    this.logs.set(runId, {
      session: source.header,
      inheritedEventCount: source.inheritedEventCount,
      events: source.snapshotEvents(),
    })
  }

  readSession(sessionId: SessionId): Promise<{
    session: SessionHeader
    inheritedEventCount: SessionLogOffset
    events: readonly SessionEvent[]
  }> {
    const stored = this.logs.get(sessionId)
    if (stored === undefined) return Promise.reject(new Error(`no stored log for "${sessionId}"`))
    return Promise.resolve(stored)
  }
}

interface Harness {
  ctx: Context
  commands: ProductTaskCommands
  sessionController: SessionControllerDouble
  sessionQuery: SessionQueryDouble
}

/** Boot the real registry/projection composition over an in-memory backend. */
async function harness(): Promise<Harness> {
  const pool = new MemoryMediaPool()
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  await ctx.plugin(TaskRegistry)
  const sessionController = new SessionControllerDouble(ctx)
  // The double stands in for the Host service the commands delegate to; only
  // the four verbs exercised here are implemented.
  ctx.provide('sessionController', sessionController as unknown as Context['sessionController'])
  const sessionQuery = new SessionQueryDouble(ctx)
  ctx.provide('sessionQuery', sessionQuery as unknown as Context['sessionQuery'])
  return { ctx, commands: new ProductTaskCommands(ctx), sessionController, sessionQuery }
}

function startRequest(overrides: Partial<StartTaskRequest> = {}): StartTaskRequest {
  return {
    idempotencyKey: 'key-1',
    workspaceId: WORKSPACE,
    mode: 'code',
    request: 'Fix the failing tests',
    policy: POLICY,
    ...overrides,
  }
}

describe('ProductTaskCommands.startTask', () => {
  let env: Harness

  beforeEach(async () => { env = await harness() })

  it('creates a Task, starts one Run, and prompts it with the request', async () => {
    const value = await env.commands.startTask(startRequest())

    expect(value.started).toBe(true)
    expect(value.task.workspaceId).toBe(WORKSPACE)
    expect(value.task.mode).toBe('code')
    expect(value.task.policy).toEqual(POLICY)
    expect(value.task.runIds).toEqual([value.runId])
    expect(env.sessionController.created).toEqual([{ workspaceId: WORKSPACE }])
    expect(env.sessionController.prompts).toEqual([
      { sessionId: value.runId, text: 'Fix the failing tests' },
    ])
  })

  it('derives a title from the request when the caller supplies none', async () => {
    const value = await env.commands.startTask(startRequest())
    expect(value.task.title).toBe('Fix the failing tests')
  })

  it('truncates a derived title rather than storing a whole request as one', async () => {
    const value = await env.commands.startTask(startRequest({ request: 'x'.repeat(200) }))
    expect(value.task.title).toHaveLength(60)
    expect(value.task.title.endsWith('…')).toBe(true)
  })

  it('prefers a supplied title over the derived one', async () => {
    const value = await env.commands.startTask(startRequest({ title: '  Release prep  ' }))
    expect(value.task.title).toBe('Release prep')
  })

  it('returns the first result for a resent idempotency key without starting a second Run', async () => {
    const first = await env.commands.startTask(startRequest())
    const second = await env.commands.startTask(startRequest())

    expect(second.task.taskId).toBe(first.task.taskId)
    expect(second.runId).toBe(first.runId)
    expect(second.started).toBe(false)
    expect(env.sessionController.created).toHaveLength(1)
    expect(env.sessionController.prompts).toHaveLength(1)
  })

  it('collapses two concurrent retransmissions into one execution', async () => {
    const [first, second] = await Promise.all([
      env.commands.startTask(startRequest()),
      env.commands.startTask(startRequest()),
    ])

    expect(second.task.taskId).toBe(first.task.taskId)
    expect(env.sessionController.created).toHaveLength(1)
    expect(env.commands.listTasks({ workspaceId: WORKSPACE }).items).toHaveLength(1)
  })

  it('starts different Tasks for different idempotency keys', async () => {
    const first = await env.commands.startTask(startRequest())
    const second = await env.commands.startTask(startRequest({ idempotencyKey: 'key-2' }))

    expect(second.task.taskId).not.toBe(first.task.taskId)
    expect(env.sessionController.created).toHaveLength(2)
  })

  it('lets the caller retry a key whose start failed', async () => {
    // A start that produced no Task must not burn its key: the caller never got
    // a Task back and is entitled to ask again.
    const create = vi.spyOn(env.sessionController, 'create')
    create.mockRejectedValueOnce(new Error('session store unavailable'))

    await expect(env.commands.startTask(startRequest())).rejects.toThrow('session store unavailable')
    const retried = await env.commands.startTask(startRequest())

    expect(retried.started).toBe(true)
    expect(retried.task.runIds).toHaveLength(1)
  })
})

describe('ProductTaskCommands.cancelRun', () => {
  let env: Harness

  beforeEach(async () => { env = await harness() })

  it('cancels the Task\'s active Run', async () => {
    const started = await env.commands.startTask(startRequest())
    const value = env.commands.cancelRun({ taskId: started.task.taskId })

    expect(value).toEqual({ cancelled: true, runId: started.runId })
    expect(env.sessionController.cancelled).toEqual([started.runId])
  })

  it('reports a stable Remote error for an unknown Task', async () => {
    const { commands } = env
    expect(() => commands.cancelRun({ taskId: 'missing' as never })).toThrow()
    try {
      commands.cancelRun({ taskId: 'missing' as never })
    } catch (error) {
      expect(remoteErrorOf(error)?.code).toBe('product-task/not-found')
    }
  })

  it('reports a stable Remote error for a Task with no Run', async () => {
    const task = await env.ctx.productTasks.createTask({
      workspaceId: WORKSPACE,
      mode: 'cowork',
      title: 'Drafted only',
      policy: POLICY,
    })
    try {
      env.commands.cancelRun({ taskId: task.id })
      expect.unreachable('cancelRun must reject a Task with no Run')
    } catch (error) {
      expect(remoteErrorOf(error)?.code).toBe('product-task/no-active-run')
    }
  })
})

describe('ProductTaskCommands.resumeTask', () => {
  let env: Harness

  beforeEach(async () => { env = await harness() })

  it('forks the failed Run and appends a new one rather than reusing it', async () => {
    const started = await env.commands.startTask(startRequest())
    const resumed = await env.commands.resumeTask({
      idempotencyKey: 'retry-1',
      taskId: started.task.taskId,
      request: 'try again without the network',
    })

    expect(env.sessionController.forked).toEqual([started.runId])
    expect(resumed.runId).not.toBe(started.runId)
    // The first attempt stays in the account: it is the record of what already ran.
    expect(resumed.task.runIds).toEqual([started.runId, resumed.runId])
    expect(env.sessionController.prompts.at(-1))
      .toEqual({ sessionId: resumed.runId, text: 'try again without the network' })
  })

  it('returns the first result for a resent retry key', async () => {
    const started = await env.commands.startTask(startRequest())
    const request = {
      idempotencyKey: 'retry-1',
      taskId: started.task.taskId,
      request: 'try again',
    }
    const first = await env.commands.resumeTask(request)
    const second = await env.commands.resumeTask(request)

    expect(second.runId).toBe(first.runId)
    expect(second.started).toBe(false)
    expect(env.sessionController.forked).toHaveLength(1)
  })
})

describe('ProductTaskCommands.inspectTask', () => {
  let env: Harness

  beforeEach(async () => { env = await harness() })

  it('reports draft for a Task that has started no Run', async () => {
    const task = await env.ctx.productTasks.createTask({
      workspaceId: WORKSPACE,
      mode: 'cowork',
      title: 'Drafted only',
      policy: POLICY,
    })

    expect((await env.commands.inspectTask({ taskId: task.id })).status).toEqual({
      status: 'draft',
      endReason: null,
      awaitingApproval: [],
      blockedActions: 0,
    })
  })

  it('reports the active Run\'s projected status', async () => {
    const started = await env.commands.startTask(startRequest())
    const session = env.ctx.sessions.get(started.runId) as Session
    session.append('turn/start', { turn: 1 })

    expect((await env.commands.inspectTask({ taskId: started.task.taskId })).status).toMatchObject({
      status: 'running',
      runId: started.runId,
    })

    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    expect((await env.commands.inspectTask({ taskId: started.task.taskId })).status).toMatchObject({
      status: 'completed',
      endReason: 'completed',
    })
  })

  it('reads a cold Run from its stored log instead of reporting queued', async () => {
    // Regression, caught by driving the real app: after a Host restart no
    // Session is live, and falling back to `queued` reported a Task that had
    // run and been cancelled as one that never started — the status silently
    // regressing across exactly the restart the durable record exists to
    // survive.
    const env = await harness()
    const task = await env.ctx.productTasks.createTask({
      workspaceId: WORKSPACE,
      mode: 'code',
      title: 'Ran before the restart',
      policy: POLICY,
    })
    const coldRun = SessionId('cold-run')
    await env.ctx.productTasks.appendRun(task.id, coldRun)
    env.sessionQuery.store(coldRun, (session) => {
      session.append('turn/start', { turn: 1 })
      session.append('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'legacy' } } })
    })

    expect((await env.commands.inspectTask({ taskId: task.id })).status).toMatchObject({
      status: 'cancelled',
      runId: coldRun,
      endReason: 'aborted',
    })
  })

  it('follows the retry to the new Run rather than reporting the failed one', async () => {
    const started = await env.commands.startTask(startRequest())
    const failed = env.ctx.sessions.get(started.runId) as Session
    failed.append('turn/start', { turn: 1 })
    failed.append('turn/end', { turn: 1, reason: { kind: 'error', error: { message: 'boom', code: 'UNKNOWN' } } })

    expect((await env.commands.inspectTask({ taskId: started.task.taskId })).status.status).toBe('failed')

    const resumed = await env.commands.resumeTask({
      idempotencyKey: 'retry-1',
      taskId: started.task.taskId,
      request: 'try again',
    })

    expect((await env.commands.inspectTask({ taskId: started.task.taskId })).status).toMatchObject({
      status: 'queued',
      runId: resumed.runId,
    })
  })
})

describe('ProductTaskCommands.listTasks', () => {
  it('lists only the requested Project\'s Tasks', async () => {
    const env = await harness()
    await env.commands.startTask(startRequest())
    await env.commands.startTask(startRequest({
      idempotencyKey: 'key-2',
      workspaceId: WorkspaceId('ws-2'),
    }))

    const items = env.commands.listTasks({ workspaceId: WORKSPACE }).items
    expect(items).toHaveLength(1)
    expect(items[0]?.workspaceId).toBe(WORKSPACE)
  })
})
