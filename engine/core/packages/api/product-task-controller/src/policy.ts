/**
 * Resolves a Task's pinned policy onto the engine's own enforcement seams,
 * per ADR 0002 (Task/Project/Run ownership on `engine/core`, in the MONOLITH
 * repository's root `docs/adr` directory) Decision 5. The Task record stores
 * intent; this module is what makes that intent bind.
 *
 * The three axes have different homes because the engine splits them that
 * way, and folding them into one switch is what Decision 5 rejected:
 *
 * - **File effects** are `ctx.sandboxPolicy`'s own `SandboxMode`, written as a
 *   durable `sandbox/mode` event. Every confining capability resolves that
 *   fold per call, so the mode binds without this package touching any tool.
 * - **Approval** is a `permission-presets` table entry, written through the
 *   same durable knob path.
 * - **Network** is outside the sandbox vocabulary entirely, so it is a tool
 *   restriction on the Run's agent scope.
 *
 * @module @monolith/api-product-task-controller/src/policy
 */

import type { Context } from '@monolith/cordis'
import type {} from '@monolith/agent'
import type { Session } from '@monolith/session'
import { setSandboxMode } from '@monolith/sandbox-policy'
import type {} from '@monolith/permission-presets'
import type {} from '@monolith/tools'
import type {} from '@monolith/product-workspace'
import { RemoteError } from '@monolith/typert-protocol'
import type { EffectivePolicyView, TaskPolicyView } from './types.ts'

/**
 * Write a Task's pinned policy onto its Run's session as durable knob events.
 *
 * Order matters. The preset is applied first because a preset bundles its own
 * sandbox mode; the Task's `sandboxMode` is written after so the Task's file
 * policy wins where the two disagree. The effective preset then reads as
 * `custom`, which is the engine's own word for "these knobs match no table
 * entry" — not an error, and the honest answer when a Task asks for a file
 * policy its approval preset does not carry.
 *
 * @param ctx - Host context carrying the permission-preset service.
 * @param session - the Run's session, whose log stores the knobs.
 * @param policy - the Task's pinned policy.
 * @throws {RemoteError} `product-task/unknown-preset` when the preset is not in the table.
 */
export function applyTaskPolicy(ctx: Context, session: Session, policy: TaskPolicyView): void {
  assertPresetKnown(ctx, policy.approvalPresetId)
  ctx.permissionPresets.set(session, policy.approvalPresetId)
  if (ctx.sandboxPolicy.overrideOf(session) !== policy.sandboxMode) {
    setSandboxMode(session, policy.sandboxMode)
  }
}

/**
 * Reject an approval preset the deployment does not define.
 *
 * Separated from {@link applyTaskPolicy} so `startTask` can check before it
 * writes anything: the Task record and its Session are both durable by the
 * time a policy binds, and discovering the preset there would leave an
 * unpromptable Task and an idle Session behind for every typo.
 *
 * @param ctx - Host context carrying the permission-preset service.
 * @param approvalPresetId - the preset name a Task pins.
 * @throws {RemoteError} `product-task/unknown-preset` when it is not in the table.
 */
export function assertPresetKnown(ctx: Context, approvalPresetId: string): void {
  try {
    ctx.permissionPresets.resolve(approvalPresetId)
  } catch (error) {
    throw new RemoteError(
      'product-task/unknown-preset',
      `no approval preset named "${approvalPresetId}"`,
      { approvalPresetId },
      { cause: error },
    )
  }
}

/**
 * Read back what a Run is actually running under, from its own log.
 *
 * This is deliberately not the Task's requested policy echoed back: a Task
 * records what was asked for, and only the session's folded knobs say what
 * bound. Reporting the request as though it were the effect is how a
 * read-only badge ends up on a Run that can write.
 *
 * @param ctx - Host context carrying the policy services.
 * @param session - the Run's session.
 * @param allowNetwork - the Task's pinned network axis, which has no session fold.
 * @returns the effective policy for this Run.
 */
export function effectivePolicyOf(
  ctx: Context,
  session: Session,
  allowNetwork: boolean,
): EffectivePolicyView {
  return {
    sandboxMode: ctx.sandboxPolicy.resolve({ session }).mode,
    approvalPreset: ctx.permissionPresets.current(session),
    allowNetwork,
  }
}

/**
 * Deny the configured network tools on every Run whose Task withholds network
 * access, re-applying on each `agent/created`.
 *
 * A tool restriction lives on the agent's scope, so it lasts exactly as long
 * as that agent. Re-deriving it from the durable Task record whenever an agent
 * appears is what makes the denial outlive the process that started the Run:
 * a Host restart rebuilds the agent, this rebuilds the restriction. Applying
 * it only at `startTask` would silently return network access to every
 * resumed Run.
 *
 * @param ctx - Host context carrying the Task registry and agent registry.
 * @param networkTools - global tool names withheld when a Task denies network.
 * @returns a disposer removing the listener.
 */
export function installNetworkRestriction(
  ctx: Context,
  networkTools: readonly string[],
): () => void {
  if (networkTools.length === 0) return () => {}
  return ctx.on('agent/created', ({ agent }) => {
    const task = ctx.productTasks.taskOfRun(agent.session.id)
    if (task === undefined || task.policy.allowNetwork) return
    // `restrict` rejects a name the registry does not know, and that throw
    // inside this listener would veto the agent's publication — a config typo
    // would stop every Run rather than one tool. Deny what is composed and say
    // what was missing, so the gap is visible without being fatal.
    const deny = networkTools.filter(name => agent.ctx.tools.get(name) !== undefined)
    const absent = networkTools.filter(name => !deny.includes(name))
    if (absent.length > 0) {
      ctx.logger.warn(`product-task: networkTools names ${absent.map(name => `"${name}"`).join(', ')}, which this composition does not mount; denying the rest for run "${agent.session.id}"`)
    }
    if (deny.length === 0) return
    agent.ctx.tools.restrict({ deny })
  })
}
