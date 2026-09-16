/**
 * The network axis: a Task that withholds network access must lose the
 * reaching tools on its Run's agent, and must lose them again every time an
 * agent for that Run appears — a restriction applied only at `startTask` would
 * hand network access back to every Run resumed after a restart.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@monolith/cordis'
import Storage from '@monolith/storage'
import { DomainFacility } from '@monolith/storage-domain'
import SessionStore, { Session, SessionId } from '@monolith/session'
import SessionProjectionRegistry from '@monolith/session-projection'
import SystemPrompt from '@monolith/system-prompt'
import ToolRuntime, { defineTool } from '@monolith/tools'
import AgentRegistry from '@monolith/agent'
import type { Agent } from '@monolith/agent'
import { createScope } from '@monolith/scope'
import TaskRegistry from '@monolith/product-workspace'
import type { Task } from '@monolith/product-workspace'
import { WorkspaceId } from '@monolith/workspace'
import {
  MemoryMediaPool,
  MemoryStorageBackend,
} from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import { installNetworkRestriction } from '../src/policy.ts'
import type { TaskPolicyView } from '../src/types.ts'

const WORKSPACE = WorkspaceId('ws-1')
const NETWORK_TOOLS = ['web_search', 'web_fetch']

function policy(allowNetwork: boolean): TaskPolicyView {
  return { sandboxMode: 'read-only', approvalPresetId: 'workspace-write', allowNetwork }
}

/** Register a trivial tool under one name. */
function registerTool(ctx: Context, name: string): void {
  ctx.tools.register(defineTool({
    name,
    description: `Tool ${name}.`,
    parameters: {},
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    execute: () => Promise.resolve('ok'),
  }))
}

async function harness(): Promise<Context> {
  const pool = new MemoryMediaPool()
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  await ctx.plugin(TaskRegistry)
  registerTool(ctx, 'web_search')
  registerTool(ctx, 'web_fetch')
  registerTool(ctx, 'read_file')
  return ctx
}

/** Create a Task with one Run, mirroring what startTask records. */
async function taskWithRun(ctx: Context, runId: SessionId, allowNetwork: boolean): Promise<Task> {
  const task = await ctx.productTasks.createTask({
    workspaceId: WORKSPACE,
    mode: 'code',
    title: 'Network policy',
    policy: policy(allowNetwork),
  })
  await ctx.productTasks.appendRun(task.id, runId)
  return task
}

/** Announce an agent for one Run through the real registry, as the loop does. */
async function announceAgent(ctx: Context, runId: SessionId): Promise<{ agent: Agent; detach: () => void }> {
  const session = ctx.sessions.get(runId) ?? ctx.sessions.create(runId)
  let agent!: Agent
  await ctx.plugin(Object.assign((inner: Context) => {
    const identity = { id: runId } as Agent
    const scope = createScope(inner, identity)
    agent = Object.assign(identity, { session, ctx: scope.ctx })
  }, { inject: ['tools'] }))
  const detach = ctx.agents.enter(agent, undefined)
  ctx.agents.announce(agent)
  return { agent, detach }
}

/**
 * Tool names visible to one agent after restrictions. The scope key is the
 * agent object itself, not its id: keyed by id the registry answers with the
 * unrestricted global view, which would make every assertion here pass
 * against a package that restricted nothing.
 */
function visibleTools(ctx: Context, agent: Agent): string[] {
  return ctx.tools.schemas(agent).map(schema => schema.name).sort()
}

describe('installNetworkRestriction', () => {
  it('denies the configured network tools for a Run whose Task withholds network', async () => {
    const ctx = await harness()
    installNetworkRestriction(ctx, NETWORK_TOOLS)
    const runId = SessionId('run-denied')
    await taskWithRun(ctx, runId, false)

    const { agent } = await announceAgent(ctx, runId)

    expect(visibleTools(ctx, agent)).toEqual(['read_file'])
  })

  it('leaves the network tools in place for a Run whose Task allows network', async () => {
    const ctx = await harness()
    installNetworkRestriction(ctx, NETWORK_TOOLS)
    const runId = SessionId('run-allowed')
    await taskWithRun(ctx, runId, true)

    const { agent } = await announceAgent(ctx, runId)

    expect(visibleTools(ctx, agent)).toEqual(['read_file', 'web_fetch', 'web_search'])
  })

  it('leaves a session that is not a Run untouched', async () => {
    // An ordinary session has no Task, so the product policy has nothing to
    // say about it and must not silently strip its tools.
    const ctx = await harness()
    installNetworkRestriction(ctx, NETWORK_TOOLS)

    const { agent } = await announceAgent(ctx, SessionId('not-a-run'))

    expect(visibleTools(ctx, agent)).toEqual(['read_file', 'web_fetch', 'web_search'])
  })

  it('re-applies to a second agent for the same Run, which is what survives a restart', async () => {
    // The restriction lives on an agent scope, so the durable guarantee is
    // that it is rebuilt from the Task record each time an agent appears.
    const ctx = await harness()
    installNetworkRestriction(ctx, NETWORK_TOOLS)
    const runId = SessionId('run-resumed')
    await taskWithRun(ctx, runId, false)

    const first = await announceAgent(ctx, runId)
    expect(visibleTools(ctx, first.agent)).toEqual(['read_file'])

    // Retiring the agent is what a Host shutdown does; the next one must be
    // restricted again from the Task record, not from anything the first left.
    first.detach()
    const second = await announceAgent(ctx, runId)
    expect(visibleTools(ctx, second.agent)).toEqual(['read_file'])
  })

  it('denies what is composed and keeps going when a configured tool is absent', async () => {
    // A name this composition does not mount must not veto the agent: the
    // restriction is applied to the rest instead of throwing inside the
    // creation listener.
    const ctx = await harness()
    installNetworkRestriction(ctx, [...NETWORK_TOOLS, 'never_mounted'])
    const runId = SessionId('run-partial')
    await taskWithRun(ctx, runId, false)

    const { agent } = await announceAgent(ctx, runId)

    expect(visibleTools(ctx, agent)).toEqual(['read_file'])
  })

  it('installs nothing when no network tools are configured', async () => {
    const ctx = await harness()
    const dispose = installNetworkRestriction(ctx, [])
    const runId = SessionId('run-unconfigured')
    await taskWithRun(ctx, runId, false)

    const { agent } = await announceAgent(ctx, runId)

    expect(visibleTools(ctx, agent)).toEqual(['read_file', 'web_fetch', 'web_search'])
    expect(() => { dispose() }).not.toThrow()
  })
})

describe('Session', () => {
  it('is the identity a Run restriction keys on', () => {
    // Guards the assumption the listener rests on: the agent's session id is
    // the Run id the Task record stores.
    const session = Session.create(SessionId('run-1'))
    expect(session.id).toBe(SessionId('run-1'))
  })
})
