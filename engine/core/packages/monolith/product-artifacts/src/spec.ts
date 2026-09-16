/**
 * The Artifact domain declaration: record schema and the `defineDomain` spec
 * the registry opens. Mirrors `@monolith/product-workspace`'s `spec.ts`: the
 * zod schema validates the shipped format at the durability boundary.
 * @module @monolith/product-artifacts/src/spec
 */

import { z } from 'zod'
import { brandString } from '@monolith/brand'
import type { SessionId } from '@monolith/session'
import { defineDomain, domainTable } from '@monolith/storage-domain'
import type { TaskId } from '@monolith/product-workspace/types'
import type { ArtifactId } from './types.ts'

/** Artifact id schema at the durable boundary; branding has no runtime representation. */
const artifactId = z.string().transform(value => value as ArtifactId)

/** Durable shape of one registered version. */
export const artifactVersionRecord = z.object({
  version: z.number().int().positive(),
  runId: z.string().transform(value => brandString<SessionId>(value)),
  path: z.string(),
  sha256: z.string(),
  bytes: z.number().int().nonnegative(),
  createdAt: z.string(),
})

/**
 * Durable shape of one Artifact record. `versions` is ordered oldest-first
 * and append-only: a re-registration adds an entry, so the record is the
 * output's whole history rather than its latest state.
 */
export const artifactRecord = z.object({
  taskId: z.string().transform(value => value as TaskId),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  versions: z.array(artifactVersionRecord),
})

/** One stored Artifact record, inferred from {@link artifactRecord}. */
export type ArtifactRecord = z.infer<typeof artifactRecord>

/**
 * Durable registry state. `artifactIds` is the authoritative display order,
 * newest-first, matching the Task registry's convention.
 */
export const artifactDomainState = z.object({
  artifactIds: z.array(artifactId),
})

/** Durable registry state inferred from {@link artifactDomainState}. */
export type ArtifactDomainState = z.infer<typeof artifactDomainState>

/**
 * The Artifact domain spec: one `artifacts` table keyed by {@link ArtifactId}
 * plus the display-order singleton.
 */
export const artifactDomainSpec = defineDomain({
  name: 'product_artifact',
  version: 1,
  global: {
    schema: artifactDomainState,
    initial: { artifactIds: [] },
  },
  tables: { artifacts: domainTable<ArtifactId, ArtifactRecord>(artifactRecord) },
})
