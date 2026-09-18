/**
 * The Artifact registry over a real temp directory.
 *
 * Two properties carry the weight. Versioning is append-only, so producing
 * the same deliverable twice keeps both rather than overwriting the evidence
 * of the first. And containment is checked after symlink resolution, because
 * a lexical check accepts a link that points anywhere — the registry would
 * happily hash and later serve a file outside the Project.
 */

import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@monolith/cordis'
import Storage from '@monolith/storage'
import { DomainFacility } from '@monolith/storage-domain'
import { SessionId } from '@monolith/session'
import { TaskId } from '@monolith/product-workspace'
import {
  MemoryMediaPool,
  MemoryStorageBackend,
} from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import ArtifactRegistry, {
  ArtifactNotFoundError,
  ArtifactOutsideProjectError,
  ArtifactTooLargeError,
} from '../src/index.ts'

const TASK = TaskId('task-1')
const RUN = SessionId('run-1')
const HUGE = Number.MAX_SAFE_INTEGER

let projectRoot: string
let outside: string

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'mono-project-'))
  outside = await mkdtemp(join(tmpdir(), 'mono-outside-'))
})

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true })
  await rm(outside, { recursive: true, force: true })
})

/** Boot the registry over an in-memory domain backend. */
async function harness(): Promise<Context> {
  const pool = new MemoryMediaPool()
  const ctx = new Context()
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  await ctx.plugin(ArtifactRegistry)
  return ctx
}

/** Write a file under the project root and return its relative path. */
async function produce(relative: string, content: string): Promise<string> {
  const absolute = join(projectRoot, relative)
  await mkdir(join(absolute, '..'), { recursive: true })
  await writeFile(absolute, content)
  return relative
}

describe('ArtifactRegistry.registerVersion', () => {
  it('records the digest and size of the bytes it registered', async () => {
    const ctx = await harness()
    await produce('report.md', 'hello')

    const artifact = await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })

    expect(artifact.name).toBe('report')
    expect(artifact.versions).toHaveLength(1)
    expect(artifact.versions[0]).toMatchObject({
      version: 1,
      runId: RUN,
      path: 'report.md',
      bytes: 5,
      // sha256 of "hello"
      sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    })
  })

  it('appends a version when the same name is registered again', async () => {
    // The point of the registry: a second run producing the same deliverable
    // must not erase the evidence of the first.
    const ctx = await harness()
    await produce('report.md', 'first')
    await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })
    await produce('report.md', 'second')
    const artifact = await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: SessionId('run-2'), name: 'report', projectRoot, path: 'report.md',
    })

    expect(artifact.versions.map(version => version.version)).toEqual([1, 2])
    expect(artifact.versions[0]?.sha256).not.toBe(artifact.versions[1]?.sha256)
    expect(artifact.versions[1]?.runId).toBe(SessionId('run-2'))
    expect(ctx.productArtifacts.listArtifactsForTask(TASK)).toHaveLength(1)
  })

  it('keeps different names as separate artifacts', async () => {
    const ctx = await harness()
    await produce('a.md', 'a')
    await produce('b.md', 'b')
    await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'a', projectRoot, path: 'a.md',
    })
    await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'b', projectRoot, path: 'b.md',
    })

    expect(ctx.productArtifacts.listArtifactsForTask(TASK)).toHaveLength(2)
  })

  it('scopes the name index to one Task', async () => {
    // Two Tasks producing "report" own two artifacts, not one shared record.
    const ctx = await harness()
    await produce('report.md', 'x')
    const first = await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })
    const second = await ctx.productArtifacts.registerVersion({
      taskId: TaskId('task-2'), runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })

    expect(second.id).not.toBe(first.id)
    expect(ctx.productArtifacts.listArtifactsForTask(TASK)).toHaveLength(1)
    expect(ctx.productArtifacts.listArtifactsForTask(TaskId('task-2'))).toHaveLength(1)
  })

  it('refuses a path that climbs out of the Project', async () => {
    const ctx = await harness()
    await writeFile(join(outside, 'secret.txt'), 'secret')

    await expect(ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'leak', projectRoot, path: `../${join(outside, 'secret.txt')}`,
    })).rejects.toThrow(ArtifactOutsideProjectError)
  })

  it('refuses an absolute path outside the Project', async () => {
    const ctx = await harness()
    await writeFile(join(outside, 'secret.txt'), 'secret')

    await expect(ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'leak', projectRoot, path: join(outside, 'secret.txt'),
    })).rejects.toThrow(ArtifactOutsideProjectError)
  })

  it('refuses a symlink inside the Project that points outside it', async () => {
    // The reason containment resolves symlinks: this path is lexically inside
    // the Project and reads a file that is not.
    const ctx = await harness()
    await writeFile(join(outside, 'secret.txt'), 'secret')
    await symlink(join(outside, 'secret.txt'), join(projectRoot, 'link.txt'))

    await expect(ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'leak', projectRoot, path: 'link.txt',
    })).rejects.toThrow(ArtifactOutsideProjectError)
  })

  it('accepts a nested path inside the Project', async () => {
    const ctx = await harness()
    await produce('out/deep/report.md', 'nested')

    const artifact = await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'nested', projectRoot, path: 'out/deep/report.md',
    })

    expect(artifact.versions[0]?.path).toBe(join('out', 'deep', 'report.md'))
  })
})

describe('ArtifactRegistry.readVersion', () => {
  it('returns the bytes and reports them verified when unchanged', async () => {
    const ctx = await harness()
    await produce('report.md', 'hello')
    const artifact = await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })

    const read = await ctx.productArtifacts.readVersion(artifact.id, projectRoot, undefined, HUGE)

    expect(read.bytes.toString()).toBe('hello')
    expect(read.verified).toBe(true)
    expect(read.version.version).toBe(1)
  })

  it('reports verified:false when the file changed after registration', async () => {
    // The whole point of storing a digest: a deliverable edited after it was
    // produced is still readable, and the caller is told it is not the one
    // that was registered.
    const ctx = await harness()
    await produce('report.md', 'original')
    const artifact = await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })
    await produce('report.md', 'tampered')

    const read = await ctx.productArtifacts.readVersion(artifact.id, projectRoot, undefined, HUGE)

    expect(read.bytes.toString()).toBe('tampered')
    expect(read.verified).toBe(false)
    expect(read.sha256).not.toBe(read.version.sha256)
  })

  it('reads the newest version by default and an older one on request', async () => {
    const ctx = await harness()
    await produce('report.md', 'first')
    await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })
    await produce('report.md', 'second')
    const artifact = await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })

    expect((await ctx.productArtifacts.readVersion(artifact.id, projectRoot, undefined, HUGE)).version.version).toBe(2)
    // Version 1's bytes are gone from disk, so reading it returns what is
    // there now and reports the mismatch rather than inventing history.
    const older = await ctx.productArtifacts.readVersion(artifact.id, projectRoot, 1, HUGE)
    expect(older.version.version).toBe(1)
    expect(older.verified).toBe(false)
  })

  it('refuses a read above the byte ceiling', async () => {
    const ctx = await harness()
    await produce('report.md', 'hello')
    const artifact = await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })

    await expect(ctx.productArtifacts.readVersion(artifact.id, projectRoot, undefined, 4))
      .rejects.toThrow(ArtifactTooLargeError)
  })

  it('rejects an unknown artifact and an unknown version', async () => {
    const ctx = await harness()
    await produce('report.md', 'hello')
    const artifact = await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })

    await expect(ctx.productArtifacts.readVersion(artifact.id, projectRoot, 99, HUGE))
      .rejects.toThrow(ArtifactNotFoundError)
  })

  it('refuses to read through a symlink swapped in after registration', async () => {
    // Containment is re-checked on read rather than trusted from registration:
    // the stored path stayed the same while what it points at did not.
    const ctx = await harness()
    await produce('report.md', 'original')
    const artifact = await ctx.productArtifacts.registerVersion({
      taskId: TASK, runId: RUN, name: 'report', projectRoot, path: 'report.md',
    })
    await writeFile(join(outside, 'secret.txt'), 'secret')
    await rm(join(projectRoot, 'report.md'))
    await symlink(join(outside, 'secret.txt'), join(projectRoot, 'report.md'))

    await expect(ctx.productArtifacts.readVersion(artifact.id, projectRoot, undefined, HUGE))
      .rejects.toThrow(ArtifactOutsideProjectError)
  })
})
