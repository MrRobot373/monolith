/**
 * Task command implementation and stable Remote failure mapping.
 *
 * Every command that touches an execution delegates to `ctx.sessionController`
 * rather than driving `ctx.agents` itself. That is the whole point of ADR 0002
 * Decision 2: a Run *is* one engine Session, so session creation, prompting,
 * forking and cancellation already have an owner, and a second caller into the
 * agent registry would be the parallel run-execution concept the decision
 * forbids. This file owns Task identity, the Run account, and the pinned
 * policy — nothing else.
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@monolith/cordis'
import { brandString } from '@monolith/brand'
import { SessionLogOffset } from '@monolith/session'
import type { SessionId } from '@monolith/session'
import type {} from '@monolith/session-query'
import type { SessionRequestId } from '@monolith/api-session-controller'
import type { Task, TaskRunStatusProjection } from '@monolith/product-workspace'
import { TaskId } from '@monolith/product-workspace'
import { RemoteError } from '@monolith/typert-protocol'
import { applyTaskPolicy, assertPresetKnown, effectivePolicyOf } from './policy.ts'
import type {
  CancelRunRequest,
  CancelRunValue,
  InspectTaskRequest,
  InspectTaskValue,
  ListTasksRequest,
  ListTasksValue,
  ResumeTaskRequest,
  ResumeTaskValue,
  StartTaskRequest,
  StartTaskValue,
  TaskIdempotencyKey,
  TaskPolicyView,
  TaskStatusView,
  TaskView,
} from './types.ts'

/** Longest title derived from a request when the caller supplies none. */
const DERIVED_TITLE_LENGTH = 60

/**
 * The signal handed to the Session controller's prompt verb, which uses it
 * only to refuse a request that was already abandoned. By the time a Task
 * prompts, its record and its Session both exist, so aborting there would
 * strand both rather than undo anything; the caller cancels a started Run
 * through `cancelRun` instead.
 */
const PROMPT_SIGNAL = new AbortController().signal

/**
 * Project one Task record into its Remote value.
 * @param task - the registry's Task record.
 * @returns detached Task projection for Remote consumers.
 */
export function taskView(task: Task): TaskView {
  return {
    taskId: task.id,
    workspaceId: task.workspaceId,
    mode: task.mode,
    title: task.title,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    runIds: [...task.runs],
    policy: task.policy,
    ...task.expertVersion === undefined ? {} : { expertVersion: task.expertVersion },
  }
}

/**
 * Derive a display title from the requested outcome.
 * @param request - the user's request text.
 * @returns a single-line title, truncated to a readable length.
 */
function derivedTitle(request: string): string {
  const line = request.replace(/\s+/g, ' ').trim()
  return line.length <= DERIVED_TITLE_LENGTH ? line : `${line.slice(0, DERIVED_TITLE_LENGTH - 1)}…`
}

/** Implements Task mutations over the registry and the Session controller. */
export class ProductTaskCommands {
  /**
   * In-flight and completed results by idempotency key. The value is the
   * Promise, not the result, so two concurrent retransmissions of one request
   * await a single execution instead of racing to start two Runs.
   *
   * Process-lifetime only: this guards the case it exists for — a browser
   * resending over a reconnect to the same Host — and not a duplicate that
   * spans a Host restart, which needs the key on the durable Task record.
   */
  private readonly starts = new Map<TaskIdempotencyKey, Promise<StartTaskValue>>()
  private readonly resumes = new Map<TaskIdempotencyKey, Promise<ResumeTaskValue>>()

  /** @param ctx - Host context carrying the Task registry and Session controller. */
  constructor(private readonly ctx: Context) {}

  /**
   * Create a Task and start its first Run.
   * @param request - Project, mode, requested outcome, and policy to pin.
   * @returns the Task, its first Run id, and whether this call started it.
   */
  startTask(request: StartTaskRequest): Promise<StartTaskValue> {
    const inFlight = this.starts.get(request.idempotencyKey)
    if (inFlight !== undefined) {
      return inFlight.then(value => ({ ...value, started: false }))
    }
    const started = this.runStartTask(request)
    this.starts.set(request.idempotencyKey, started)
    // A failed start must not poison the key: the caller is entitled to retry
    // a request that never produced a Task.
    started.catch(() => { this.starts.delete(request.idempotencyKey) })
    return started
  }

  private async runStartTask(request: StartTaskRequest): Promise<StartTaskValue> {
    // Before any durable write: a Task whose policy cannot bind is a Task that
    // must never exist, and both the record and its Session outlive the throw.
    assertPresetKnown(this.ctx, request.policy.approvalPresetId)
    const title = request.title?.trim() === undefined || request.title.trim() === ''
      ? derivedTitle(request.request)
      : request.title.trim()
    const task = await this.ctx.productTasks.createTask({
      workspaceId: request.workspaceId,
      mode: request.mode,
      title,
      policy: request.policy,
      ...request.expertVersion === undefined ? {} : { expertVersion: request.expertVersion },
    })
    const { sessionId } = await this.ctx.sessionController.create({ workspaceId: request.workspaceId })
    await this.ctx.productTasks.appendRun(task.id, sessionId)
    // Before the prompt: the knobs must be on the log before the agent can
    // take a turn under them, or the Run's first tool call would resolve the
    // deployment default rather than this Task's pinned policy.
    this.bindPolicy(sessionId, request.policy)
    await this.prompt(sessionId, request.request)
    return { task: this.requireTaskView(task.id), runId: sessionId, started: true }
  }

  /**
   * Cancel a Task's active Run.
   * @param request - the Task whose Run should stop.
   * @returns the cancelled Run's id.
   */
  cancelRun(request: CancelRunRequest): CancelRunValue {
    const runId = this.requireActiveRun(request.taskId)
    this.ctx.sessionController.cancel({ sessionId: runId })
    return { cancelled: true, runId }
  }

  /**
   * Retry a Task as a new Run forked from its last attempt.
   * @param request - the Task to retry and the instruction for the new Run.
   * @returns the Task, the new Run id, and whether this call started it.
   */
  resumeTask(request: ResumeTaskRequest): Promise<ResumeTaskValue> {
    const inFlight = this.resumes.get(request.idempotencyKey)
    if (inFlight !== undefined) {
      return inFlight.then(value => ({ ...value, started: false }))
    }
    const resumed = this.runResumeTask(request)
    this.resumes.set(request.idempotencyKey, resumed)
    resumed.catch(() => { this.resumes.delete(request.idempotencyKey) })
    return resumed
  }

  private async runResumeTask(request: ResumeTaskRequest): Promise<ResumeTaskValue> {
    const taskId = TaskId(request.taskId)
    const previousRun = this.requireActiveRun(taskId)
    // ADR 0002 Decision 2: a retry forks a new Session and appends it. It never
    // reuses the failed Run, which is what keeps "which actions already
    // completed" answerable from the forked log.
    const { sessionId } = await this.ctx.sessionController.fork({ sessionId: previousRun })
    await this.ctx.productTasks.appendRun(taskId, sessionId)
    // A fork inherits the failed Run's knob events, but the Task's pinned
    // policy is still the authority: re-binding keeps a retry under the policy
    // the Task was created with rather than whatever the prior attempt drifted to.
    this.bindPolicy(sessionId, this.requireTask(taskId).policy)
    await this.prompt(sessionId, request.request)
    return { task: this.requireTaskView(taskId), runId: sessionId, started: true }
  }

  /**
   * Read one Task's record and the status derived from its active Run's log.
   * @param request - the Task to inspect.
   * @returns the Task projection and its current status.
   */
  async inspectTask(request: InspectTaskRequest): Promise<InspectTaskValue> {
    const task = this.requireTask(request.taskId)
    const status = await this.statusOf(task)
    const runId = task.runs.at(-1)
    const session = runId === undefined ? undefined : this.ctx.sessions.get(runId)
    return {
      task: taskView(task),
      status,
      // Only a live Run can be asked what it is running under; a cold one is
      // reported without an effective policy rather than with a guess.
      ...session === undefined
        ? {}
        : { effectivePolicy: effectivePolicyOf(this.ctx, session, task.policy.allowNetwork) },
    }
  }

  /**
   * List every Task in one Project.
   * @param request - the Project to list.
   * @returns the Project's Tasks, newest first.
   */
  listTasks(request: ListTasksRequest): ListTasksValue {
    return { items: this.ctx.productTasks.listTasksForWorkspace(request.workspaceId).map(taskView) }
  }

  /**
   * Resolve a Task's status from its active Run's projection.
   *
   * A Task with no Run is `draft`. A live Run reads the registry's current
   * cut. A Run whose Session is not live is read from its stored log and
   * folded through the same unit: after a Host restart the Session is cold,
   * and reporting a Task that ran and was cancelled as `queued` would be the
   * status silently regressing across exactly the restart the durable record
   * exists to survive.
   */
  private async statusOf(task: Task): Promise<TaskStatusView> {
    const runId = task.runs.at(-1)
    if (runId === undefined) {
      return { status: 'draft', endReason: null, awaitingApproval: [], blockedActions: 0 }
    }
    const projected = await this.projectedStatus(runId)
    return {
      status: projected.status,
      runId,
      endReason: projected.endReason,
      awaitingApproval: projected.pendingApprovals.map(pending => pending.toolName),
      blockedActions: projected.blockedActions,
    }
  }

  private async projectedStatus(runId: SessionId): Promise<TaskRunStatusProjection> {
    const live = this.ctx.sessions.get(runId)
    if (live !== undefined) {
      return this.ctx.sessionProjections.snapshot(live).values.taskRunStatus as TaskRunStatusProjection
    }
    // `readSession` balances an interrupted turn in memory, so a Run whose
    // Host died mid-turn folds to `interrupted` here rather than staying
    // stuck at whatever the last durable event happened to be.
    const stored = await this.ctx.sessionQuery.readSession(runId)
    const { snapshot } = this.ctx.sessionProjections.restore(
      {},
      stored.events,
      SessionLogOffset(0),
      stored.session,
      stored.inheritedEventCount,
    )
    return snapshot.values.taskRunStatus as TaskRunStatusProjection
  }

  /**
   * Bind a Task's pinned policy to one Run's session.
   *
   * The session must be live: `sessionController.create`/`fork` publish it
   * before returning, so this runs against a session the store already holds.
   */
  private bindPolicy(sessionId: SessionId, policy: TaskPolicyView): void {
    const session = this.ctx.sessions.get(sessionId)
    if (session === undefined) {
      throw new Error(`product-task: session "${sessionId}" is not live immediately after creation`)
    }
    applyTaskPolicy(this.ctx, session, policy)
  }

  private prompt(sessionId: SessionId, text: string): Promise<unknown> {
    return this.ctx.sessionController.prompt({
      requestId: brandString<SessionRequestId>(randomUUID()),
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text }],
    }, PROMPT_SIGNAL)
  }

  private requireTask(taskId: TaskId): Task {
    const task = this.ctx.productTasks.getTask(TaskId(taskId))
    if (task === undefined) {
      throw new RemoteError('product-task/not-found', `Task "${taskId}" not found`, { taskId })
    }
    return task
  }

  private requireTaskView(taskId: TaskId): TaskView {
    return taskView(this.requireTask(taskId))
  }

  private requireActiveRun(taskId: TaskId): SessionId {
    const runId = this.requireTask(taskId).runs.at(-1)
    if (runId === undefined) {
      throw new RemoteError(
        'product-task/no-active-run',
        `Task "${taskId}" has no Run to act on`,
        { taskId },
      )
    }
    return runId
  }
}
