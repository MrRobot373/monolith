import { describe, expect, it } from 'vitest'
import { Context } from '@monolith/cordis'
import Storage from '@monolith/storage'
import { DomainFacility } from '@monolith/storage-domain'
import { SessionId } from '@monolith/session'
import { WorkspaceId } from '@monolith/workspace'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import TaskRegistry, { TaskId, TaskNotFoundError } from '../src/index.ts'
import type { TaskPolicy } from '../src/index.ts'

const POLICY: TaskPolicy = {
  sandboxMode: 'workspace-write',
  approvalPresetId: 'default',
  allowNetwork: false,
}

/** Boot the real storage/domain/registry composition over an in-memory backend. */
async function harness() {
  const pool = new MemoryMediaPool()
  const ctx = new Context()
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  await ctx.plugin(TaskRegistry)
  return { ctx, registry: ctx.productTasks }
}

describe('TaskRegistry', () => {
  it('creates a task with no runs and reads it back', async () => {
    const { registry } = await harness()
    const workspaceId = WorkspaceId('ws-1')
    const task = await registry.createTask({
      workspaceId,
      mode: 'code',
      title: 'Fix failing tests',
      policy: POLICY,
    })

    expect(task.workspaceId).toBe(workspaceId)
    expect(task.mode).toBe('code')
    expect(task.runs).toEqual([])
    expect(task.policy).toEqual(POLICY)
    expect(registry.getTask(task.id)).toEqual(task)
  })

  it('lists tasks for a workspace, newest first', async () => {
    const { registry } = await harness()
    const ws1 = WorkspaceId('ws-1')
    const ws2 = WorkspaceId('ws-2')
    const first = await registry.createTask({ workspaceId: ws1, mode: 'cowork', title: 'First', policy: POLICY })
    await registry.createTask({ workspaceId: ws2, mode: 'cowork', title: 'Other workspace', policy: POLICY })
    const second = await registry.createTask({ workspaceId: ws1, mode: 'cowork', title: 'Second', policy: POLICY })

    const tasks = registry.listTasksForWorkspace(ws1)
    expect(tasks.map(t => t.id)).toEqual([second.id, first.id])
  })

  it('appends a run attempt durably without disturbing earlier runs', async () => {
    const { registry } = await harness()
    const task = await registry.createTask({
      workspaceId: WorkspaceId('ws-1'),
      mode: 'code',
      title: 'Bug fix',
      policy: POLICY,
    })
    const runA = SessionId('run-a')
    const runB = SessionId('run-b')

    await registry.appendRun(task.id, runA)
    await registry.appendRun(task.id, runB)

    const updated = registry.getTask(task.id)
    expect(updated?.runs).toEqual([runA, runB])
    expect(updated?.updatedAt >= task.updatedAt).toBe(true)
  })

  it('rejects appendRun for an unknown task', async () => {
    const { registry } = await harness()
    await expect(registry.appendRun(TaskId('missing'), SessionId('run-a')))
      .rejects.toThrow(TaskNotFoundError)
  })

  it('survives reopening the same backend (reload behavior)', async () => {
    const pool = new MemoryMediaPool()
    const backend = new MemoryStorageBackend(pool)

    const ctxA = new Context()
    await ctxA.plugin(Storage)
    ctxA.storage.backend.register('memory', backend)
    const facilityA = new DomainFacility(ctxA, { backend: 'memory', routes: {} })
    ctxA.storage.mount('domain', facilityA)
    ctxA.provide('storageDomain', facilityA)
    const fiberA = await ctxA.plugin(TaskRegistry)
    const task = await ctxA.productTasks.createTask({
      workspaceId: WorkspaceId('ws-1'),
      mode: 'code',
      title: 'Survives reload',
      policy: POLICY,
    })

    // A fresh Context over the same backend simulates a process restart / browser reload;
    // dispose the first context so the memory backend's per-name open guard doesn't trip.
    await fiberA.dispose()
    const ctxB = new Context()
    await ctxB.plugin(Storage)
    ctxB.storage.backend.register('memory', backend)
    const facilityB = new DomainFacility(ctxB, { backend: 'memory', routes: {} })
    ctxB.storage.mount('domain', facilityB)
    ctxB.provide('storageDomain', facilityB)
    await ctxB.plugin(TaskRegistry)

    expect(ctxB.productTasks.getTask(task.id)).toEqual(task)
  })
})
