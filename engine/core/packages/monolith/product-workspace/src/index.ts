/**
 * Task registry (`ctx.productTasks`): durable Task records grouping Run
 * attempts, over the domain data form. Walking-skeleton implementation for
 * Master Plan Phase 1 Day 4 (verify a new product package composes into the
 * bundle and boots) and Day 5 (a Task survives navigation/reload) — see
 * ADR 0002 (Task/Project/Run ownership on `engine/core`, in the MONOLITH
 * repository's root `docs/adr` directory) Decisions 1-2 and 6. Modeled
 * directly on `@monolith/workspace`'s registry shape.
 * @module @monolith/product-workspace
 */

import { randomUUID } from 'node:crypto'
import { Context, Service } from '@monolith/cordis'
import type { SessionId } from '@monolith/session'
import type { DomainGlobal, KvTable } from '@monolith/storage-domain'
import type { WorkspaceId } from '@monolith/workspace'
import { taskRunStatusProjectionDefinition } from './run-status.ts'
import { taskDomainSpec } from './spec.ts'
import type { TaskDomainState, TaskRecord } from './spec.ts'
import type { Task, TaskId as TaskIdBrand, TaskPolicy } from './types.ts'

export type { Task, TaskPolicy } from './types.ts'
export { taskDomainSpec } from './spec.ts'
export type { TaskDomainState, TaskRecord } from './spec.ts'
export { taskRunStatusProjectionDefinition } from './run-status.ts'
export type { PendingApproval, RunStatus, TaskRunStatusProjection } from './run-status.ts'

/** Identifies one Task record (see `src/types.ts` for the brand rationale). */
export type TaskId = TaskIdBrand

/**
 * Brand a string as a {@link TaskId}.
 * @param id - Raw task id string.
 * @returns the same string, branded at compile time.
 */
export function TaskId(id: string): TaskId {
  return id as TaskId
}

/** A create/appendRun request named a Task id the registry has no record of. */
export class TaskNotFoundError extends Error {
  /**
   * @param taskId - The unknown task id.
   */
  constructor(readonly taskId: TaskId) {
    super(`no task record for '${taskId}'`)
    this.name = 'TaskNotFoundError'
  }
}

declare module '@monolith/cordis' {
  interface Context {
    productTasks: TaskRegistry
  }
}

/** Input to {@link TaskRegistry.createTask}. */
export interface CreateTaskInput {
  readonly workspaceId: WorkspaceId
  readonly mode: Task['mode']
  readonly title: string
  readonly policy: TaskPolicy
  readonly expertVersion?: string
}

const toTask = (id: TaskId, record: TaskRecord): Task => ({
  id,
  workspaceId: record.workspaceId,
  mode: record.mode,
  expertVersion: record.expertVersion,
  title: record.title,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  runs: record.runs,
  policy: record.policy,
})

/**
 * Durable Task registry. A Task is a new product record (no engine analog);
 * each of its Run attempts is an existing `engine/core` Session id, appended
 * in start order and never rewritten in place (ADR 0002 Decision 2).
 *
 * Writes serialize on one queue per registry instance, matching
 * `WorkspaceRegistry`'s single-writer discipline; unlike that registry, a
 * Task record and the display-order list are not independently
 * crash-recoverable yet — a process crash between the two writes can leave
 * an orphaned record absent from `taskIds` (recoverable by table scan, not
 * yet implemented). Hardening this is F03 scope, not this walking skeleton.
 */
export class TaskRegistry extends Service {
  static inject = ['storageDomain', 'sessionProjections']

  private table?: KvTable<TaskId, TaskRecord>
  private global?: DomainGlobal<TaskDomainState>
  private state?: TaskDomainState
  private operationTail: Promise<void> = Promise.resolve()
  /** Run id → owning Task. Rebuilt from the durable records at start. */
  private readonly runOwners = new Map<SessionId, TaskId>()

  constructor(ctx: Context) {
    super(ctx, 'productTasks')
  }

  /** Open the domain, load its current state, and register the Run-status unit. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(taskDomainSpec)
    this.ctx.effect(() => () => domain.close(), 'productTasks.domainClose')
    this.table = domain.table('tasks')
    this.global = domain.global
    this.state = domain.global.get()
    for (const id of this.state.taskIds) {
      const record = this.table.get(id)
      if (record === undefined) continue
      for (const runId of record.runs) this.runOwners.set(runId, id)
    }
    this.ctx.sessionProjections.register(taskRunStatusProjectionDefinition)
  }

  /**
   * Create a new Task with no Run attempts yet.
   * @param input - Workspace, mode, title, and pinned policy.
   * @returns the created Task.
   */
  async createTask(input: CreateTaskInput): Promise<Task> {
    return this.enqueueOperation(async () => {
      const table = this.requireTable()
      const state = this.requireState()
      const id = TaskId(randomUUID())
      const now = new Date().toISOString()
      const record: TaskRecord = {
        workspaceId: input.workspaceId,
        mode: input.mode,
        expertVersion: input.expertVersion,
        title: input.title,
        createdAt: now,
        updatedAt: now,
        runs: [],
        policy: input.policy,
      }
      await table.put(id, record)
      await this.setState({ ...state, taskIds: [id, ...state.taskIds] })
      return toTask(id, record)
    })
  }

  /**
   * Read one Task, synchronously from memory.
   * @param id - The task id.
   * @returns the task, or `undefined` when absent.
   */
  getTask(id: TaskId): Task | undefined {
    const record = this.requireTable().get(id)
    return record === undefined ? undefined : toTask(id, record)
  }

  /**
   * List every Task for a workspace, newest-first (display order).
   * @param workspaceId - The owning workspace (Project).
   * @returns tasks belonging to that workspace, in display order.
   */
  listTasksForWorkspace(workspaceId: WorkspaceId): Task[] {
    const table = this.requireTable()
    const state = this.requireState()
    const tasks: Task[] = []
    for (const id of state.taskIds) {
      const record = table.get(id)
      if (record !== undefined && record.workspaceId === workspaceId) tasks.push(toTask(id, record))
    }
    return tasks
  }

  /**
   * Append a new Run attempt (a Session id) to a Task, durably. Never
   * rewrites or removes an existing Run id (ADR 0002 Decision 2: a retry is
   * always a new forked Session, appended here, not a mutation of a prior
   * entry).
   * @param taskId - The task to append to.
   * @param runId - The new Run's Session id.
   * @throws {TaskNotFoundError} when `taskId` names no record.
   */
  async appendRun(taskId: TaskId, runId: SessionId): Promise<void> {
    return this.enqueueOperation(async () => {
      const table = this.requireTable()
      const record = table.get(taskId)
      if (record === undefined) throw new TaskNotFoundError(taskId)
      const updated: TaskRecord = {
        ...record,
        runs: [...record.runs, runId],
        updatedAt: new Date().toISOString(),
      }
      await table.put(taskId, updated)
      this.runOwners.set(runId, taskId)
    })
  }

  /**
   * Find the Task one Run belongs to.
   * @param runId - a Run's Session id.
   * @returns the owning Task, or `undefined` when the Session is not a Run.
   */
  taskOfRun(runId: SessionId): Task | undefined {
    const taskId = this.runOwners.get(runId)
    return taskId === undefined ? undefined : this.getTask(taskId)
  }

  private requireTable(): KvTable<TaskId, TaskRecord> {
    if (this.table === undefined) throw new Error('task registry is not started yet')
    return this.table
  }

  private requireState(): TaskDomainState {
    if (this.state === undefined) throw new Error('task registry is not started yet')
    return this.state
  }

  private async setState(state: TaskDomainState): Promise<void> {
    await (this.global as DomainGlobal<TaskDomainState>).set(state)
    this.state = state
  }

  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation)
    this.operationTail = result.then(() => {}, () => {})
    return result
  }
}

export default TaskRegistry
