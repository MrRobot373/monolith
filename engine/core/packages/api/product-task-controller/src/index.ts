/**
 * Host Task Remote owner: the product's Task/Run command surface, per ADR
 * 0002 (Task/Project/Run ownership on `engine/core`, in the MONOLITH
 * repository's root `docs/adr` directory) Decision 4.
 *
 * Shaped like `api/workspace-controller`: a Host service plus a generated
 * Client namespace over the existing Connection/Gateway transport. No new HTTP
 * API and no second WebSocket — a Task is one more namespace on the transport
 * the browser already holds open.
 *
 * @module @monolith/api-product-task-controller
 */

import { Context } from '@monolith/cordis'
import z from '@monolith/schemastery'
import { Remote, TypertRemoteService } from '@monolith/typert-protocol'
import { ProductTaskCommands } from './commands.ts'
import { installNetworkRestriction } from './policy.ts'
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
} from './types.ts'

export type * from './types.ts'
export { taskView } from './commands.ts'

declare module '@monolith/cordis' {
  interface Context {
    /** Host Task business API and Remote namespace owner. */
    productTaskController: ProductTaskController
  }
}

/** Deployment policy for the Task namespace. */
export interface Config {
  /**
   * Global tool names withheld from a Run whose Task pins `allowNetwork: false`.
   *
   * Deployment-varying by nature: which tools reach the network depends on
   * what the composition mounts, and the MCP tools are named after the servers
   * a deployment configured. Empty (the default) disables the network axis,
   * which is honest for a composition with no reaching tools and wrong for one
   * that has them — so a deployment with network tools must list them.
   */
  networkTools?: string[]
}

/** Host service backing the generated `ctx.remote.productTask` namespace. */
export class ProductTaskController extends TypertRemoteService {
  // Inline schema call: the config catalog walks `static Config` statically.
  static Config: z<Config> = z.object({
    networkTools: z.array(z.string()).default([]),
  })

  /**
   * `sessionController` is injected rather than `agents`: every execution verb
   * here delegates to it, so a composition without it must not serve a Task
   * namespace that could create records for Runs it cannot start.
   */
  static inject = [
    'typert',
    'productTasks',
    'sessionController',
    'sessions',
    'sessionProjections',
    // Cold Runs: after a Host restart a Task's Session is not live, and its
    // status has to come from the stored log rather than regress to `queued`.
    'sessionQuery',
    // The policy seams a Task's pinned triple binds to. Injected rather than
    // optional: a composition without them would accept a `read-only` Task and
    // run it unrestricted, which is worse than not serving the namespace.
    'sandboxPolicy',
    'permissionPresets',
    'agents',
    'tools',
  ]

  private readonly commands: ProductTaskCommands

  /**
   * @param ctx - Host context carrying the Task registry, Session controller and policy seams.
   * @param config - deployment policy for the Task namespace.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'productTaskController', { namespace: 'productTask' })
    this.commands = new ProductTaskCommands(ctx)
    // The schema defaulted the list — the cast records that runtime fact.
    ctx.effect(
      () => installNetworkRestriction(ctx, config.networkTools as string[]),
      'productTaskController.networkRestriction',
    )
  }

  /**
   * Create a Task and start its first Run.
   * @param request - Project, mode, requested outcome, and policy to pin.
   * @returns the Task, its first Run id, and whether this call started it.
   */
  @Remote('startTask')
  startTask(request: StartTaskRequest): Promise<StartTaskValue> {
    return this.commands.startTask(request)
  }

  /**
   * Cancel a Task's active Run.
   * @param request - the Task whose Run should stop.
   * @returns the cancelled Run's id.
   */
  @Remote('cancelRun')
  cancelRun(request: CancelRunRequest): CancelRunValue {
    return this.commands.cancelRun(request)
  }

  /**
   * Retry a Task as a new Run forked from its last attempt.
   * @param request - the Task to retry and the instruction for the new Run.
   * @returns the Task, the new Run id, and whether this call started it.
   */
  @Remote('resumeTask')
  resumeTask(request: ResumeTaskRequest): Promise<ResumeTaskValue> {
    return this.commands.resumeTask(request)
  }

  /**
   * Read one Task's record and the status derived from its active Run's log.
   * @param request - the Task to inspect.
   * @returns the Task projection and its current status.
   */
  @Remote('inspectTask')
  inspectTask(request: InspectTaskRequest): Promise<InspectTaskValue> {
    return this.commands.inspectTask(request)
  }

  /**
   * List every Task in one Project.
   * @param request - the Project to list.
   * @returns the Project's Tasks, newest first.
   */
  @Remote('listTasks')
  listTasks(request: ListTasksRequest): ListTasksValue {
    return this.commands.listTasks(request)
  }
}

export default ProductTaskController
