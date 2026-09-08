/**
 * Resolve the public SDK launch configuration to one monolith subprocess.
 * @module @monolith/sdk-client/launch
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HarnessClientOptions } from './types.ts'

/** Default bound for a profile to answer the SDK initialize handshake. */
export const DEFAULT_INITIALIZE_TIMEOUT_MS = 10_000

/** Internal generic process launch used by the transport and fake-runtime tests. */
export interface RuntimeProcessOptions {
  command: string
  args: string[]
  cwd?: string
  /** Materialize the complete child environment when the client starts its subprocess. */
  environment: () => NodeJS.ProcessEnv
  description: string
  initializeTimeoutMs: number
  requestTimeoutMs?: number
  shutdownTimeoutMs?: number
  disposeEofGraceMs?: number
  disposeGraceMs?: number
}

/** Node argv plus internal profile patches required by one resolved monolith entry. */
export interface MonolithNodeLaunch {
  /** Arguments before the profile selector. */
  nodeArgs: string[]
  /** Internal patches applied below caller-supplied patches. */
  patches: string[]
  /** Environment values required by the resolved entry mode. */
  environment: NodeJS.ProcessEnv
}

interface PackageManifest {
  version?: unknown
  bin?: unknown
}

/** Read a package manifest from one resolved package.json URL. */
function manifest(url: string): PackageManifest {
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as PackageManifest
}

/**
 * Resolve and version-check a monolith executable from package manifests.
 * @param monolithManifestUrl - resolved URL of the monolith package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @returns the absolute monolith executable path.
 */
export function resolveMonolithBinFromManifests(monolithManifestUrl: string, clientManifestUrl: string): string {
  const monolithManifest = manifest(monolithManifestUrl)
  const clientManifest = manifest(clientManifestUrl)
  if (typeof monolithManifest.version !== 'string' || monolithManifest.version !== clientManifest.version) {
    throw new Error(`monolith SDK client ${String(clientManifest.version)} requires the same monolith version, got ${String(monolithManifest.version)}`)
  }
  const bin = typeof monolithManifest.bin === 'object' && monolithManifest.bin !== null
    ? (monolithManifest.bin as Record<string, unknown>).monolith
    : monolithManifest.bin
  if (typeof bin !== 'string' || bin === '') throw new Error('@monolith/cli declares no monolith executable')
  return resolve(dirname(fileURLToPath(monolithManifestUrl)), bin)
}

/**
 * Resolve and version-check the built monolith executable installed with this SDK.
 * @returns the absolute built executable path, whether or not it exists in a source checkout.
 */
export function installedMonolithBin(): string {
  return resolveMonolithBinFromManifests(
    import.meta.resolve('@monolith/cli/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve the Node launch for one same-version monolith package.
 * @param monolithManifestUrl - resolved URL of the monolith package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @param sourceLoaderUrl - optional absolute tsx loader URL for deterministic tests.
 * @returns built output, or the source entry plus its compatibility patch and tsx environment.
 */
export function resolveMonolithNodeLaunchFromManifests(
  monolithManifestUrl: string,
  clientManifestUrl: string,
  sourceLoaderUrl?: string,
): MonolithNodeLaunch {
  const bin = resolveMonolithBinFromManifests(monolithManifestUrl, clientManifestUrl)
  if (existsSync(bin)) return { nodeArgs: [bin], patches: [], environment: {} }

  const packageDir = dirname(fileURLToPath(monolithManifestUrl))
  const sourceBin = resolve(packageDir, 'src/bin.ts')
  const sourcePatch = resolve(packageDir, 'src/sdk-source.cordis.patch.yml')
  const sourceTsconfig = resolve(packageDir, 'tsconfig.json')
  if (!existsSync(sourceBin) || !existsSync(sourcePatch) || !existsSync(sourceTsconfig)) {
    throw new Error(
      `@monolith/cli is missing its built executable ${bin} and complete source launch files ${sourceBin}, ${sourcePatch}, ${sourceTsconfig}`,
    )
  }
  const loader = sourceLoaderUrl ?? import.meta.resolve('tsx/esm')
  return {
    nodeArgs: ['--import', loader, sourceBin],
    patches: [sourcePatch],
    environment: { TSX_TSCONFIG_PATH: sourceTsconfig },
  }
}

/**
 * Resolve the installed monolith package to a built or source Node launch.
 * @returns the launch descriptor for the current checkout or installed package.
 */
function installedMonolithNodeLaunch(): MonolithNodeLaunch {
  return resolveMonolithNodeLaunchFromManifests(
    import.meta.resolve('@monolith/cli/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve caller-relative filesystem inputs and construct canonical monolith argv.
 * @param options - public SDK launch options.
 * @param callerCwd - parent-process directory used for lexical resolution.
 * @returns one generic subprocess spec for the JSON-RPC transport.
 */
export function resolveMonolithLaunch(
  options: HarnessClientOptions = {},
  callerCwd: string = process.cwd(),
): RuntimeProcessOptions {
  const profile = options.profile ?? 'sdk'
  const monolithLaunch = options.monolithBin === undefined
    ? installedMonolithNodeLaunch()
    : { nodeArgs: [resolve(callerCwd, options.monolithBin)], patches: [], environment: {} }
  const patches = [
    ...monolithLaunch.patches,
    ...(options.patches ?? []).map(path => resolve(callerCwd, path)),
  ]
  const monolithHome = options.monolithHome === undefined ? undefined : resolve(callerCwd, options.monolithHome)
  return {
    command: process.execPath,
    args: [...monolithLaunch.nodeArgs, '--profile', profile, ...patches.flatMap(path => ['--patch', path])],
    ...options.processCwd === undefined ? {} : { cwd: resolve(callerCwd, options.processCwd) },
    environment: () => ({
      ...(options.env ?? process.env),
      ...monolithLaunch.environment,
      ...monolithHome === undefined ? {} : { MONOLITH_HOME: monolithHome },
    }),
    description: `monolith profile ${JSON.stringify(profile)}`,
    initializeTimeoutMs: options.initializeTimeoutMs ?? DEFAULT_INITIALIZE_TIMEOUT_MS,
    ...options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: options.requestTimeoutMs },
    ...options.shutdownTimeoutMs === undefined ? {} : { shutdownTimeoutMs: options.shutdownTimeoutMs },
    ...options.disposeEofGraceMs === undefined ? {} : { disposeEofGraceMs: options.disposeEofGraceMs },
    ...options.disposeGraceMs === undefined ? {} : { disposeGraceMs: options.disposeGraceMs },
  }
}
