/**
 * The Task domain declaration: record schema and the `defineDomain` spec the
 * registry opens. Mirrors `@monolith/workspace`'s `spec.ts` shape: the zod
 * schema validates the shipped format at the durability boundary.
 * @module @monolith/product-workspace/src/spec
 */

import { z } from 'zod'
import { brandString } from '@monolith/brand'
import type { SessionId } from '@monolith/session'
import { defineDomain, domainTable } from '@monolith/storage-domain'
import type { WorkspaceId } from '@monolith/workspace'
import type { TaskId } from './types.ts'

/** Task id schema at the durable boundary; branding has no runtime representation. */
const taskId = z.string().transform(value => value as TaskId)

/** Durable shape of one Task's pinned policy (see `types.ts` `TaskPolicy`). */
export const taskPolicyRecord = z.object({
  sandboxMode: z.enum(['read-only', 'workspace-write']),
  approvalPresetId: z.string(),
  allowNetwork: z.boolean(),
})

/**
 * Durable shape of one Task record. `runs` is the ordered Run-attempt
 * account (array order is start order, oldest first); timestamps are
 * ISO-8601 strings, matching `@monolith/workspace`'s convention.
 */
export const taskRecord = z.object({
  workspaceId: z.string().transform(value => value as WorkspaceId),
  mode: z.enum(['cowork', 'code']),
  expertVersion: z.string().optional(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  runs: z.array(z.string().transform(value => brandString<SessionId>(value))),
  policy: taskPolicyRecord,
})

/** One stored Task record, inferred from {@link taskRecord}. */
export type TaskRecord = z.infer<typeof taskRecord>

/**
 * Durable registry state. `taskIds` is the authoritative display order,
 * newest-first, matching `@monolith/workspace`'s `workspaceIds` convention.
 */
export const taskDomainState = z.object({
  taskIds: z.array(taskId),
})

/** Durable registry state inferred from {@link taskDomainState}. */
export type TaskDomainState = z.infer<typeof taskDomainState>

/**
 * The Task domain spec: one `tasks` table keyed by {@link TaskId} plus the
 * display-order singleton. The registry opens this through
 * `ctx.storageDomain`; this spec object is the single source of the domain's
 * identity, version, and schemas.
 */
export const taskDomainSpec = defineDomain({
  name: 'product_task',
  version: 1,
  global: {
    schema: taskDomainState,
    initial: { taskIds: [] },
  },
  tables: { tasks: domainTable<TaskId, TaskRecord>(taskRecord) },
})
