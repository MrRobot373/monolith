/**
 * Artifact commands and the authorization they rest on.
 *
 * The boundary being tested is ownership: an Artifact is reachable only
 * through its Task, and the Task's Project supplies the directory its bytes
 * must live in. These tests hold that line from the caller's side — an
 * artifact id alone must not be enough, and a Task whose Project is gone must
 * fail rather than fall back to a wider root.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@monolith/cordis'
import Storage from '@monolith/storage'
import { DomainFacility } from '@monolith/storage-domain'
import SessionStore, { SessionId } from '@monolith/session'
import SessionProjectionRegistry from '@monolith/session-projection'
import SandboxPolicyService from '@monolith/sandbox-policy'
import ApprovalService from '@monolith/user-approval'
import PermissionPresetService from '@monolith/permission-presets'
import TaskRegistry from '@monolith/product-workspace'
import type { Task } from '@monolith/product-workspace'
import ArtifactRegistry from '@monolith/product-artifacts'
import { WorkspaceId } from '@monolith/workspace'
import { remoteErrorOf } from '@monolith/typert-protocol'
import {
  MemoryMediaPool,
  MemoryStorageBackend,
} from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import { ProductArtifactCommands } from '../src/artifacts.ts'
import type { TaskPolicyView } from '../src/types.ts'

const POLICY: TaskPolicyView = {
  sandboxMode: 'workspace-write',
  approvalPresetId: 'workspace-write',
  allowNetwork: false,
}

const WORKSPACE = WorkspaceId('ws-1')
const OTHER_WORKSPACE = WorkspaceId('ws-2')
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

interface Harness {
  ctx: Context
  artifacts: ProductArtifactCommands
  task: Task
}

/** Boot the real registries with a Workspace double supplying the Project path. */
async function harness(maxDownloadBytes = HUGE): Promise<Harness> {
  const pool = new MemoryMediaPool()
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  ctx.provide('shell', { sandboxMode: 'workspace-write' } as unknown as Context['shell'])
  await ctx.plugin(SandboxPolicyService, { mode: 'workspace-write', workspaceRoot: projectRoot })
  await ctx.plugin(ApprovalService)
  await ctx.plugin(PermissionPresetService)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  await ctx.plugin(TaskRegistry)
  await ctx.plugin(ArtifactRegistry)
  // Only `get` is exercised; the real registry needs session persistence this
  // test has no use for.
  ctx.provide('workspaceRegistry', {
    get: (id: WorkspaceId) => (id === WORKSPACE ? { path: projectRoot } : undefined),
  } as unknown as Context['workspaceRegistry'])

  const task = await ctx.productTasks.createTask({
    workspaceId: WORKSPACE, mode: 'code', title: 'Produce a report', policy: POLICY,
  })
  await ctx.productTasks.appendRun(task.id, SessionId('run-1'))
  return { ctx, artifacts: new ProductArtifactCommands(ctx, maxDownloadBytes), task }
}

async function produce(name: string, content: string): Promise<void> {
  await writeFile(join(projectRoot, name), content)
}

describe('ProductArtifactCommands.registerArtifact', () => {
  it('registers a produced file against the Task\'s newest Run', async () => {
    const env = await harness()
    await produce('report.md', 'hello')

    const value = await env.artifacts.registerArtifact({
      taskId: env.task.id, name: 'report', path: 'report.md',
    })

    expect(value.artifact.taskId).toBe(env.task.id)
    expect(value.artifact.versions).toHaveLength(1)
    expect(value.artifact.versions[0]?.runId).toBe(SessionId('run-1'))
  })

  it('refuses a path outside the Task\'s Project', async () => {
    const env = await harness()
    await writeFile(join(outside, 'secret.txt'), 'secret')

    try {
      await env.artifacts.registerArtifact({
        taskId: env.task.id, name: 'leak', path: join(outside, 'secret.txt'),
      })
      expect.unreachable('a path outside the Project must be refused')
    } catch (error) {
      expect(remoteErrorOf(error)?.code).toBe('product-artifact/outside-project')
    }
  })

  it('refuses a Task that has started no Run', async () => {
    // An artifact records which Run produced it; a Task with no Run has no
    // honest answer, so registering one would invent provenance.
    const env = await harness()
    const drafted = await env.ctx.productTasks.createTask({
      workspaceId: WORKSPACE, mode: 'cowork', title: 'Drafted only', policy: POLICY,
    })
    await produce('report.md', 'hello')

    try {
      await env.artifacts.registerArtifact({ taskId: drafted.id, name: 'report', path: 'report.md' })
      expect.unreachable('a Task with no Run cannot own an artifact')
    } catch (error) {
      expect(remoteErrorOf(error)?.code).toBe('product-task/no-active-run')
    }
  })

  it('refuses a Task whose Project is no longer registered', async () => {
    const env = await harness()
    const orphan = await env.ctx.productTasks.createTask({
      workspaceId: OTHER_WORKSPACE, mode: 'code', title: 'Orphaned', policy: POLICY,
    })
    await env.ctx.productTasks.appendRun(orphan.id, SessionId('run-2'))
    await produce('report.md', 'hello')

    try {
      await env.artifacts.registerArtifact({ taskId: orphan.id, name: 'report', path: 'report.md' })
      expect.unreachable('a Task without a Project has no containment boundary')
    } catch (error) {
      expect(remoteErrorOf(error)?.code).toBe('product-artifact/no-project')
    }
  })

  it('refuses an unknown Task', async () => {
    const env = await harness()
    try {
      await env.artifacts.registerArtifact({ taskId: 'missing' as never, name: 'x', path: 'report.md' })
      expect.unreachable('an unknown Task must be refused')
    } catch (error) {
      expect(remoteErrorOf(error)?.code).toBe('product-task/not-found')
    }
  })
})

describe('ProductArtifactCommands.listArtifacts and inspectArtifact', () => {
  it('lists only the requested Task\'s artifacts', async () => {
    const env = await harness()
    const other = await env.ctx.productTasks.createTask({
      workspaceId: WORKSPACE, mode: 'code', title: 'Other', policy: POLICY,
    })
    await env.ctx.productTasks.appendRun(other.id, SessionId('run-3'))
    await produce('a.md', 'a')
    await produce('b.md', 'b')
    await env.artifacts.registerArtifact({ taskId: env.task.id, name: 'a', path: 'a.md' })
    await env.artifacts.registerArtifact({ taskId: other.id, name: 'b', path: 'b.md' })

    const items = env.artifacts.listArtifacts({ taskId: env.task.id }).items
    expect(items.map(item => item.name)).toEqual(['a'])
  })

  it('inspects an artifact without reading its bytes', async () => {
    const env = await harness()
    await produce('report.md', 'hello')
    const registered = await env.artifacts.registerArtifact({
      taskId: env.task.id, name: 'report', path: 'report.md',
    })
    // The file is gone; inspection is metadata, so it still answers.
    await rm(join(projectRoot, 'report.md'))

    const value = env.artifacts.inspectArtifact({ artifactId: registered.artifact.artifactId })
    expect(value.artifact.name).toBe('report')
    expect(value.artifact.versions[0]?.bytes).toBe(5)
  })

  it('reports a stable Remote error for an unknown artifact', async () => {
    const env = await harness()
    try {
      env.artifacts.inspectArtifact({ artifactId: 'no-such-artifact' })
      expect.unreachable('an unknown artifact must be refused')
    } catch (error) {
      expect(remoteErrorOf(error)?.code).toBe('product-artifact/not-found')
    }
  })
})

describe('ProductArtifactCommands.downloadArtifact', () => {
  it('returns base64 bytes and reports them verified', async () => {
    const env = await harness()
    await produce('report.md', 'hello')
    const registered = await env.artifacts.registerArtifact({
      taskId: env.task.id, name: 'report', path: 'report.md',
    })

    const value = await env.artifacts.downloadArtifact({
      artifactId: registered.artifact.artifactId,
    })

    expect(Buffer.from(value.data, 'base64').toString()).toBe('hello')
    expect(value.verified).toBe(true)
  })

  it('still returns a changed file, flagged unverified', async () => {
    // The acceptance clause is "returns a verified artifact": the caller gets
    // the bytes and a truthful answer about whether they are the produced ones.
    const env = await harness()
    await produce('report.md', 'original')
    const registered = await env.artifacts.registerArtifact({
      taskId: env.task.id, name: 'report', path: 'report.md',
    })
    await produce('report.md', 'tampered')

    const value = await env.artifacts.downloadArtifact({
      artifactId: registered.artifact.artifactId,
    })

    expect(Buffer.from(value.data, 'base64').toString()).toBe('tampered')
    expect(value.verified).toBe(false)
    expect(value.sha256).not.toBe(value.version.sha256)
  })

  it('refuses a download above the deployment ceiling', async () => {
    const env = await harness(4)
    await produce('report.md', 'hello')
    const registered = await env.artifacts.registerArtifact({
      taskId: env.task.id, name: 'report', path: 'report.md',
    })

    try {
      await env.artifacts.downloadArtifact({ artifactId: registered.artifact.artifactId })
      expect.unreachable('an oversized artifact must be refused')
    } catch (error) {
      expect(remoteErrorOf(error)?.code).toBe('product-artifact/too-large')
    }
  })
})
