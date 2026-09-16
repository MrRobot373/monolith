/**
 * Artifact registry (`ctx.productArtifacts`): durable versioned outputs with
 * the evidence needed to say a deliverable is still the one that was
 * produced.
 *
 * The registry stores metadata, never bytes. An Artifact version names a path
 * inside its Project's directory plus the digest of what was there at
 * registration; a read re-hashes the file and reports whether it still
 * matches. Copying the bytes into storage would make the registry the
 * authority on content and leave the workspace copy free to drift unnoticed —
 * the opposite of evidence.
 *
 * @module @monolith/product-artifacts
 */

import { createHash, randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { resolve as resolvePath, sep } from 'node:path'
import { Context, Service } from '@monolith/cordis'
import { canonicalPath } from '@monolith/sandbox'
import type { SessionId } from '@monolith/session'
import type { DomainGlobal, KvTable } from '@monolith/storage-domain'
import type { TaskId } from '@monolith/product-workspace/types'
import { artifactDomainSpec } from './spec.ts'
import type { ArtifactDomainState, ArtifactRecord } from './spec.ts'
import type { Artifact, ArtifactId as ArtifactIdBrand, ArtifactVersion } from './types.ts'

export type { Artifact, ArtifactVersion } from './types.ts'
export { artifactDomainSpec } from './spec.ts'
export type { ArtifactDomainState, ArtifactRecord } from './spec.ts'

/** Identifies one Artifact (see `src/types.ts` for the brand rationale). */
export type ArtifactId = ArtifactIdBrand

/**
 * Brand a string as an {@link ArtifactId}.
 * @param id - Raw artifact id string.
 * @returns the same string, branded at compile time.
 */
export function ArtifactId(id: string): ArtifactId {
  return id as ArtifactId
}

/** A request named an Artifact id the registry has no record of. */
export class ArtifactNotFoundError extends Error {
  /** @param artifactId - The unknown artifact id. */
  constructor(readonly artifactId: ArtifactId) {
    super(`no artifact record for '${artifactId}'`)
    this.name = 'ArtifactNotFoundError'
  }
}

/** A path resolved outside the Project directory that owns the Artifact. */
export class ArtifactOutsideProjectError extends Error {
  /**
   * @param path - The requested path.
   * @param projectRoot - The Project directory it had to stay inside.
   */
  constructor(readonly path: string, readonly projectRoot: string) {
    super(`artifact path '${path}' resolves outside project root '${projectRoot}'`)
    this.name = 'ArtifactOutsideProjectError'
  }
}

/** A read whose file exceeds the caller's byte ceiling. */
export class ArtifactTooLargeError extends Error {
  /**
   * @param bytes - The file's actual size.
   * @param limit - The ceiling it exceeded.
   */
  constructor(readonly bytes: number, readonly limit: number) {
    super(`artifact is ${bytes} bytes, over the ${limit}-byte read limit`)
    this.name = 'ArtifactTooLargeError'
  }
}

declare module '@monolith/cordis' {
  interface Context {
    productArtifacts: ArtifactRegistry
  }
}

/** Input to {@link ArtifactRegistry.registerVersion}. */
export interface RegisterVersionInput {
  /** The Task that owns the output. */
  readonly taskId: TaskId

  /** The Run that produced these bytes. */
  readonly runId: SessionId

  /** Name identifying the output within its Task; re-use appends a version. */
  readonly name: string

  /** The Project directory every version of this Artifact must stay inside. */
  readonly projectRoot: string

  /** Path to the produced file, absolute or relative to `projectRoot`. */
  readonly path: string
}

/** One Artifact version's bytes plus whether they still match the registration. */
export interface ArtifactRead {
  /** The version read. */
  readonly version: ArtifactVersion

  /** The file's current bytes. */
  readonly bytes: Buffer

  /** Digest of the bytes just read. */
  readonly sha256: string

  /**
   * Whether the file still hashes to what was registered. False means the
   * bytes changed after registration — reportable, not an error, because the
   * caller may legitimately want the current content.
   */
  readonly verified: boolean
}

const toArtifact = (id: ArtifactId, record: ArtifactRecord): Artifact => ({
  id,
  taskId: record.taskId,
  name: record.name,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  versions: record.versions,
})

/**
 * Resolve a path and prove it stays inside a root, symlinks included.
 *
 * `canonicalPath` resolves through the real filesystem, so a symlink pointing
 * out of the Project fails here rather than at read time; a lexical check
 * alone would accept it. Both sides are canonicalized because the root itself
 * may be reached through a link.
 *
 * @param projectRoot - Directory the path must stay inside.
 * @param path - Absolute or root-relative path.
 * @returns the canonical absolute path.
 * @throws {ArtifactOutsideProjectError} when the path escapes the root.
 */
export function resolveInsideProject(projectRoot: string, path: string): string {
  const root = canonicalPath(resolvePath(projectRoot))
  const target = canonicalPath(resolvePath(root, path))
  if (target !== root && !target.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) {
    throw new ArtifactOutsideProjectError(path, root)
  }
  return target
}

/** Lowercase hex sha256 of a buffer. */
function digestOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Durable Artifact registry. Versions are append-only: nothing rewrites or
 * removes a registered version, so a Task's output history survives every
 * later run against the same name.
 */
export class ArtifactRegistry extends Service {
  static inject = ['storageDomain']

  private table?: KvTable<ArtifactId, ArtifactRecord>
  private global?: DomainGlobal<ArtifactDomainState>
  private state?: ArtifactDomainState
  private operationTail: Promise<void> = Promise.resolve()
  /** (taskId, name) → artifact id, so a re-registration finds its record. */
  private readonly byName = new Map<string, ArtifactId>()

  constructor(ctx: Context) {
    super(ctx, 'productArtifacts')
  }

  /** Open the domain, load its state, and rebuild the name index. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(artifactDomainSpec)
    this.ctx.effect(() => () => domain.close(), 'productArtifacts.domainClose')
    this.table = domain.table('artifacts')
    this.global = domain.global
    this.state = domain.global.get()
    for (const id of this.state.artifactIds) {
      const record = this.table.get(id)
      if (record !== undefined) this.byName.set(nameKey(record.taskId, record.name), id)
    }
  }

  /**
   * Register the current bytes at `path` as the next version of one named
   * output, creating the Artifact when the name is new.
   * @param input - owning Task and Run, output name, Project root, and path.
   * @returns the Artifact including the version just added.
   * @throws {ArtifactOutsideProjectError} when the path escapes the Project.
   */
  async registerVersion(input: RegisterVersionInput): Promise<Artifact> {
    const absolute = resolveInsideProject(input.projectRoot, input.path)
    const bytes = await readFile(absolute)
    const relative = absolute.slice(canonicalPath(resolvePath(input.projectRoot)).length + 1)
    return this.enqueueOperation(async () => {
      const table = this.requireTable()
      const now = new Date().toISOString()
      const existingId = this.byName.get(nameKey(input.taskId, input.name))
      const existing = existingId === undefined ? undefined : table.get(existingId)
      const version: ArtifactVersion = {
        version: (existing?.versions.length ?? 0) + 1,
        runId: input.runId,
        path: relative,
        sha256: digestOf(bytes),
        bytes: bytes.byteLength,
        createdAt: now,
      }
      if (existing !== undefined && existingId !== undefined) {
        const updated: ArtifactRecord = {
          ...existing,
          updatedAt: now,
          versions: [...existing.versions, version],
        }
        await table.put(existingId, updated)
        return toArtifact(existingId, updated)
      }
      const id = ArtifactId(randomUUID())
      const record: ArtifactRecord = {
        taskId: input.taskId,
        name: input.name,
        createdAt: now,
        updatedAt: now,
        versions: [version],
      }
      await table.put(id, record)
      await this.setState({ ...this.requireState(), artifactIds: [id, ...this.requireState().artifactIds] })
      this.byName.set(nameKey(input.taskId, input.name), id)
      return toArtifact(id, record)
    })
  }

  /**
   * Read one Artifact, synchronously from memory.
   * @param id - The artifact id.
   * @returns the artifact, or `undefined` when absent.
   */
  getArtifact(id: ArtifactId): Artifact | undefined {
    const record = this.requireTable().get(id)
    return record === undefined ? undefined : toArtifact(id, record)
  }

  /**
   * List every Artifact owned by one Task, newest-first.
   * @param taskId - The owning Task.
   * @returns that Task's artifacts in display order.
   */
  listArtifactsForTask(taskId: TaskId): Artifact[] {
    const table = this.requireTable()
    const artifacts: Artifact[] = []
    for (const id of this.requireState().artifactIds) {
      const record = table.get(id)
      if (record !== undefined && record.taskId === taskId) artifacts.push(toArtifact(id, record))
    }
    return artifacts
  }

  /**
   * Read one version's current bytes and check them against the registration.
   * @param id - The artifact id.
   * @param projectRoot - The Project directory the version's path resolves inside.
   * @param version - Version number; the newest when omitted.
   * @param maxBytes - Ceiling above which the read is refused.
   * @returns the bytes, their digest, and whether it matches the registration.
   * @throws {ArtifactNotFoundError} when the artifact or version is absent.
   * @throws {ArtifactTooLargeError} when the file exceeds `maxBytes`.
   */
  async readVersion(
    id: ArtifactId,
    projectRoot: string,
    version: number | undefined,
    maxBytes: number,
  ): Promise<ArtifactRead> {
    const artifact = this.getArtifact(id)
    if (artifact === undefined) throw new ArtifactNotFoundError(id)
    const selected = version === undefined
      ? artifact.versions.at(-1)
      : artifact.versions.find(candidate => candidate.version === version)
    if (selected === undefined) throw new ArtifactNotFoundError(id)
    const absolute = resolveInsideProject(projectRoot, selected.path)
    // Size is checked before the read so an oversized file is refused rather
    // than loaded into memory and then rejected.
    const size = (await stat(absolute)).size
    if (size > maxBytes) throw new ArtifactTooLargeError(size, maxBytes)
    const bytes = await readFile(absolute)
    const sha256 = digestOf(bytes)
    return { version: selected, bytes, sha256, verified: sha256 === selected.sha256 }
  }

  private requireTable(): KvTable<ArtifactId, ArtifactRecord> {
    if (this.table === undefined) throw new Error('artifact registry is not started yet')
    return this.table
  }

  private requireState(): ArtifactDomainState {
    if (this.state === undefined) throw new Error('artifact registry is not started yet')
    return this.state
  }

  private async setState(state: ArtifactDomainState): Promise<void> {
    await (this.global as DomainGlobal<ArtifactDomainState>).set(state)
    this.state = state
  }

  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation)
    this.operationTail = result.then(() => {}, () => {})
    return result
  }
}

/** Index key pairing a Task with an output name. */
function nameKey(taskId: TaskId, name: string): string {
  return `${taskId} ${name}`
}

export default ArtifactRegistry
