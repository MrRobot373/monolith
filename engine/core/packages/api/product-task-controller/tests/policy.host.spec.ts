/**
 * A Task's pinned policy binding to the engine's real enforcement seams.
 *
 * These are the tests that decide whether a `read-only` badge means anything:
 * they assert through `ctx.sandboxPolicy.resolve()` — the exact call every
 * confining capability makes before touching a file — rather than re-reading
 * the Task record the caller supplied. A test that checked the record would
 * pass just as happily against the version of this package that recorded the
 * policy and enforced nothing.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@monolith/cordis'
import SessionStore, { SessionId } from '@monolith/session'
import type { Session } from '@monolith/session'
import SessionProjectionRegistry from '@monolith/session-projection'
import SandboxPolicyService from '@monolith/sandbox-policy'
import ApprovalService from '@monolith/user-approval'
import PermissionPresetService from '@monolith/permission-presets'
import { remoteErrorOf } from '@monolith/typert-protocol'
import { applyTaskPolicy, effectivePolicyOf } from '../src/policy.ts'
import type { TaskPolicyView } from '../src/types.ts'

/** A deployment's preset table, in the shape `permission-presets` configures. */
type PresetTable = Record<string, {
  sandbox: 'read-only' | 'workspace-write' | 'danger-full-access'
  approval: 'ask' | 'never'
}>

/**
 * Compose the real policy seams over a confining shell double.
 *
 * @param presets - preset table for the deployment, or undefined for the
 * plugin's own default, which carries no `read-only` entry. Which entries a
 * deployment defines decides what `current()` can name, so the table is a
 * parameter rather than a constant of these tests.
 */
async function harness(presets?: PresetTable): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  // permission-presets refuses to compose over an unconfined executor, and
  // reads this value as the deployment's sandbox default; the executor itself
  // is irrelevant here because no tool runs.
  ctx.provide('shell', { sandboxMode: 'workspace-write' } as unknown as Context['shell'])
  await ctx.plugin(SandboxPolicyService, { mode: 'workspace-write', workspaceRoot: '/tmp/ws' })
  await ctx.plugin(ApprovalService)
  await ctx.plugin(PermissionPresetService, presets === undefined ? {} : { presets })
  return { ctx, session: ctx.sessions.create(SessionId('run-1')) }
}

/** The preset table the product bundle actually ships, which has `read-only`. */
const SHIPPED_PRESETS: PresetTable = {
  'read-only': { sandbox: 'read-only', approval: 'ask' },
  'workspace-write': { sandbox: 'workspace-write', approval: 'ask' },
  'danger-full-access': { sandbox: 'danger-full-access', approval: 'never' },
}

function policy(overrides: Partial<TaskPolicyView> = {}): TaskPolicyView {
  return {
    sandboxMode: 'read-only',
    approvalPresetId: 'workspace-write',
    allowNetwork: false,
    ...overrides,
  }
}

describe('applyTaskPolicy', () => {
  it('binds a read-only Task so the sandbox seam resolves read-only', async () => {
    // The assertion every other claim in this package rests on: resolve() is
    // what a confining capability calls, and it must say read-only.
    const { ctx, session } = await harness()
    applyTaskPolicy(ctx, session, policy({ sandboxMode: 'read-only' }))

    expect(ctx.sandboxPolicy.resolve({ session }).mode).toBe('read-only')
  })

  it('leaves the deployment default in force for a session with no Task policy', async () => {
    // The negative control: without applyTaskPolicy the same session resolves
    // the composition default, so the assertion above is measuring this
    // package's effect rather than the harness's configuration.
    const { ctx, session } = await harness()

    expect(ctx.sandboxPolicy.resolve({ session }).mode).toBe('workspace-write')
  })

  it('binds a workspace-write Task without weakening it to the preset default', async () => {
    const { ctx, session } = await harness()
    applyTaskPolicy(ctx, session, policy({ sandboxMode: 'workspace-write' }))

    expect(ctx.sandboxPolicy.resolve({ session }).mode).toBe('workspace-write')
  })

  it('writes the override durably, so a replay of the log carries it', async () => {
    // The mode is a fold over `sandbox/mode` events, so a mode that never
    // reached the log would vanish on the next read of this session.
    const { ctx, session } = await harness()
    applyTaskPolicy(ctx, session, policy({ sandboxMode: 'read-only' }))

    expect(session.snapshotEvents().some(event => event.type === 'sandbox/mode')).toBe(true)
    expect(ctx.sandboxPolicy.overrideOf(session)).toBe('read-only')
  })

  it('applies the approval preset alongside the file mode', async () => {
    const { ctx, session } = await harness()
    applyTaskPolicy(ctx, session, policy({
      sandboxMode: 'workspace-write',
      approvalPresetId: 'workspace-write',
    }))

    expect(ctx.permissionPresets.current(session)).toBe('workspace-write')
  })

  it('reads as custom when the resulting knobs match no entry in the table', async () => {
    // Not an error: the Task's file policy outranks the preset's bundled one,
    // and `custom` is the engine's own word for knobs matching no table entry.
    // `custom` here is a fact about this harness's table, which has no
    // `read-only` entry — not about pinning `read-only` in general.
    const { ctx, session } = await harness()
    applyTaskPolicy(ctx, session, policy({
      sandboxMode: 'read-only',
      approvalPresetId: 'workspace-write',
    }))

    expect(ctx.sandboxPolicy.resolve({ session }).mode).toBe('read-only')
    expect(ctx.permissionPresets.current(session)).toBe('custom')
  })

  it('rejects an unknown preset with a stable Remote error and binds nothing', async () => {
    const { ctx, session } = await harness()
    try {
      applyTaskPolicy(ctx, session, policy({ approvalPresetId: 'no-such-preset' }))
      expect.unreachable('an unknown preset must not bind')
    } catch (error) {
      expect(remoteErrorOf(error)?.code).toBe('product-task/unknown-preset')
    }
    // The failure left the session on the deployment default rather than
    // half-applied under a preset that does not exist.
    expect(ctx.sandboxPolicy.resolve({ session }).mode).toBe('workspace-write')
  })
})

describe('effectivePolicyOf', () => {
  it('reports what bound, not what was requested', async () => {
    const { ctx, session } = await harness()
    applyTaskPolicy(ctx, session, policy({ sandboxMode: 'read-only' }))

    expect(effectivePolicyOf(ctx, session, false)).toEqual({
      sandboxMode: 'read-only',
      approvalPreset: 'custom',
      allowNetwork: false,
    })
  })

  it('names the entry the resulting knobs match, over the preset that was asked for', async () => {
    // The shipped table's case, and the one a browser actually sees: pinning
    // `read-only` under the `workspace-write` preset lands on knobs that are
    // exactly the `read-only` entry, so the deployment's own word for them is
    // `read-only` — not `custom`, and not the `workspace-write` requested.
    const { ctx, session } = await harness(SHIPPED_PRESETS)
    applyTaskPolicy(ctx, session, policy({
      sandboxMode: 'read-only',
      approvalPresetId: 'workspace-write',
    }))

    expect(effectivePolicyOf(ctx, session, false)).toEqual({
      sandboxMode: 'read-only',
      approvalPreset: 'read-only',
      allowNetwork: false,
    })
  })

  it('reports the deployment default for a Run nothing bound a policy to', async () => {
    // A Run created outside startTask must not be reported as though it
    // inherited a Task's policy.
    const { ctx, session } = await harness()

    expect(effectivePolicyOf(ctx, session, true).sandboxMode).toBe('workspace-write')
  })
})
