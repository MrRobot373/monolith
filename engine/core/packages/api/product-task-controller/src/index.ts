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
import { ProductArtifactCommands } from './artifacts.ts'
import { ProductTaskCommands } from './commands.ts'
import { installNetworkRestriction } from './policy.ts'
import type {
  CancelRunRequest,
  CancelRunValue,
  DownloadArtifactRequest,
  DownloadArtifactValue,
  InspectArtifactRequest,
  InspectArtifactValue,
  InspectTaskRequest,
  InspectTaskValue,
  ListArtifactsRequest,
  ListArtifactsValue,
  ListTasksRequest,
  ListTasksValue,
  RegisterArtifactRequest,
  RegisterArtifactValue,
  ResumeTaskRequest,
  ResumeTaskValue,
  StartTaskRequest,
  StartTaskValue,
} from './types.ts'

export type * from './types.ts'
export { taskView } from './commands.ts'
export { artifactView } from './artifacts.ts'

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

  /**
   * Largest artifact this deployment will return through `downloadArtifact`,
   * in bytes (default 25 MiB). The read is refused above it rather than
   * loading the file, because a deliverable is base64-encoded into one RPC
   * response and a large one would cost the Host its memory before the
   * browser could refuse it.
   */
  maxDownloadBytes?: number
}

/** Host service backing the generated `ctx.remote.productTask` namespace. */
export class ProductTaskController extends TypertRemoteService {
  // Inline schema call: the config catalog walks `static Config` statically.
  static Config: z<Config> = z.object({
    networkTools: z.array(z.string()).default([]),
    maxDownloadBytes: z.number().default(25 * 1024 * 1024),
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
    // Artifacts are authorized through their Task's Project, so the Workspace
    // record supplying that directory is required, not optional.
    'productArtifacts',
    'workspaceRegistry',
  ]

  private readonly commands: ProductTaskCommands
  private readonly artifacts: ProductArtifactCommands

  /**
   * @param ctx - Host context carrying the Task registry, Session controller and policy seams.
   * @param config - deployment policy for the Task namespace.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'productTaskController', { namespace: 'productTask' })
    this.commands = new ProductTaskCommands(ctx)
    this.artifacts = new ProductArtifactCommands(ctx, config.maxDownloadBytes as number)
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

  /**
   * Register the current bytes at a path as the next version of one output.
   * @param request - owning Task, output name, and path.
   * @returns the Artifact including the version just added.
   */
  @Remote('registerArtifact')
  registerArtifact(request: RegisterArtifactRequest): Promise<RegisterArtifactValue> {
    return this.artifacts.registerArtifact(request)
  }

  /**
   * List every Artifact owned by one Task.
   * @param request - the owning Task.
   * @returns that Task's artifacts, newest first.
   */
  @Remote('listArtifacts')
  listArtifacts(request: ListArtifactsRequest): ListArtifactsValue {
    return this.artifacts.listArtifacts(request)
  }

  /**
   * Read one Artifact's record and versions, without its bytes.
   * @param request - the artifact to inspect.
   * @returns the Artifact projection.
   */
  @Remote('inspectArtifact')
  inspectArtifact(request: InspectArtifactRequest): InspectArtifactValue {
    return this.artifacts.inspectArtifact(request)
  }

  /**
   * Read one Artifact version's bytes and re-check them against the registration.
   * @param request - the artifact and optional version.
   * @returns the bytes, their digest, and whether they still match.
   */
  @Remote('downloadArtifact')
  downloadArtifact(request: DownloadArtifactRequest): Promise<DownloadArtifactValue> {
    return this.artifacts.downloadArtifact(request)
  }
}

export default ProductTaskController
