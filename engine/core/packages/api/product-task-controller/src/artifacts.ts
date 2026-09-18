/**
 * Artifact commands: registration, listing, inspection and authorized
 * download, per backlog item F08.
 *
 * Authorization is by ownership rather than by a separate grant: every verb
 * resolves the Artifact's Task, and the Task's Project supplies the directory
 * the file must live inside. A caller holding an artifact id from another
 * Project therefore reaches nothing, and a path that escapes the Project is
 * refused at registration and again at read — the second check matters
 * because a symlink can be swapped between the two.
 *
 * @module @monolith/api-product-task-controller/src/artifacts
 */

import type { Context } from '@monolith/cordis'
import {
  ArtifactId,
  ArtifactNotFoundError,
  ArtifactOutsideProjectError,
  ArtifactTooLargeError,
} from '@monolith/product-artifacts'
import type { Artifact } from '@monolith/product-artifacts'
import type { Task } from '@monolith/product-workspace'
import { TaskId } from '@monolith/product-workspace'
import { RemoteError } from '@monolith/typert-protocol'
import type {
  ArtifactView,
  DownloadArtifactRequest,
  DownloadArtifactValue,
  InspectArtifactRequest,
  InspectArtifactValue,
  ListArtifactsRequest,
  ListArtifactsValue,
  RegisterArtifactRequest,
  RegisterArtifactValue,
} from './types.ts'

/**
 * Project one Artifact record into its Remote value.
 * @param artifact - the registry's Artifact record.
 * @returns detached Artifact projection for Remote consumers.
 */
export function artifactView(artifact: Artifact): ArtifactView {
  return {
    artifactId: artifact.id,
    taskId: artifact.taskId,
    name: artifact.name,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    versions: artifact.versions.map(version => ({
      version: version.version,
      runId: version.runId,
      path: version.path,
      sha256: version.sha256,
      bytes: version.bytes,
      createdAt: version.createdAt,
    })),
  }
}

/** Implements Artifact commands over the registry, scoped by Task ownership. */
export class ProductArtifactCommands {
  /**
   * @param ctx - Host context carrying the Task and Artifact registries.
   * @param maxDownloadBytes - ceiling above which a download is refused.
   */
  constructor(private readonly ctx: Context, private readonly maxDownloadBytes: number) {}

  /**
   * Register the current bytes at a path as the next version of one output.
   * @param request - owning Task, output name, and path.
   * @returns the Artifact including the version just added.
   */
  async registerArtifact(request: RegisterArtifactRequest): Promise<RegisterArtifactValue> {
    const task = this.requireTask(request.taskId)
    const runId = task.runs.at(-1)
    if (runId === undefined) {
      throw new RemoteError(
        'product-task/no-active-run',
        `Task "${request.taskId}" has no Run that could have produced an artifact`,
        { taskId: task.id },
      )
    }
    const artifact = await this.mapErrors(request.path, () => this.ctx.productArtifacts.registerVersion({
      taskId: task.id,
      runId,
      name: request.name,
      projectRoot: this.projectRootOf(task),
      path: request.path,
    }))
    return { artifact: artifactView(artifact) }
  }

  /**
   * List every Artifact owned by one Task.
   * @param request - the owning Task.
   * @returns that Task's artifacts, newest first.
   */
  listArtifacts(request: ListArtifactsRequest): ListArtifactsValue {
    const task = this.requireTask(request.taskId)
    return { items: this.ctx.productArtifacts.listArtifactsForTask(task.id).map(artifactView) }
  }

  /**
   * Read one Artifact's record and versions, without its bytes.
   * @param request - the artifact to inspect.
   * @returns the Artifact projection.
   */
  inspectArtifact(request: InspectArtifactRequest): InspectArtifactValue {
    return { artifact: artifactView(this.requireArtifact(request.artifactId)) }
  }

  /**
   * Read one Artifact version's current bytes and re-check them against the
   * registration.
   * @param request - the artifact and optional version.
   * @returns the bytes, their digest, and whether they still match.
   */
  async downloadArtifact(request: DownloadArtifactRequest): Promise<DownloadArtifactValue> {
    const artifact = this.requireArtifact(request.artifactId)
    const task = this.requireTask(artifact.taskId)
    const read = await this.mapErrors(request.artifactId, () => this.ctx.productArtifacts.readVersion(
      ArtifactId(request.artifactId),
      this.projectRootOf(task),
      request.version,
      this.maxDownloadBytes,
    ))
    return {
      artifact: artifactView(artifact),
      version: read.version,
      data: read.bytes.toString('base64'),
      sha256: read.sha256,
      verified: read.verified,
    }
  }

  /**
   * Resolve the directory a Task's artifacts must live inside.
   *
   * The Project is the engine Workspace record, so its path is the boundary;
   * a Task whose Workspace was deleted has no boundary to check against and
   * must fail rather than fall back to a wider root.
   */
  private projectRootOf(task: Task): string {
    const workspace = this.ctx.workspaceRegistry.get(task.workspaceId)
    if (workspace === undefined) {
      throw new RemoteError(
        'product-artifact/no-project',
        `Task "${task.id}" references workspace "${task.workspaceId}", which is no longer registered`,
        { taskId: task.id },
      )
    }
    return workspace.path
  }

  private requireTask(taskId: TaskId): Task {
    const task = this.ctx.productTasks.getTask(TaskId(taskId))
    if (task === undefined) {
      throw new RemoteError('product-task/not-found', `Task "${taskId}" not found`, { taskId })
    }
    return task
  }

  private requireArtifact(artifactId: string): Artifact {
    const artifact = this.ctx.productArtifacts.getArtifact(ArtifactId(artifactId))
    if (artifact === undefined) {
      throw new RemoteError(
        'product-artifact/not-found',
        `Artifact "${artifactId}" not found`,
        { artifactId },
      )
    }
    return artifact
  }

  /** Translate the registry's failures into stable Remote errors. */
  private async mapErrors<T>(subject: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ArtifactOutsideProjectError) {
        throw new RemoteError(
          'product-artifact/outside-project',
          error.message,
          { path: error.path },
          { cause: error },
        )
      }
      if (error instanceof ArtifactTooLargeError) {
        throw new RemoteError(
          'product-artifact/too-large',
          error.message,
          { bytes: error.bytes, limit: error.limit },
          { cause: error },
        )
      }
      if (error instanceof ArtifactNotFoundError) {
        throw new RemoteError(
          'product-artifact/not-found',
          error.message,
          { artifactId: subject },
          { cause: error },
        )
      }
      throw error
    }
  }
}
