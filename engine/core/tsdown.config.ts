import { defineConfig } from 'tsdown'
import { typertPlugin } from './packages/typert/generator/lib/types/tsdown-plugin.js'

function isBuildFaceClient(value: unknown): boolean {
  if (value === undefined || value === 'host') return false
  if (value === 'client') return true
  throw new Error(`tsdown: --env.MONOLITH_BUILD_FACE must be host or client, received ${String(value)}`)
}

/**
 * The ordinary workspace build consumes JavaScript emitted by the Host
 * TypeScript project and runs Typert. The Client pass selects packages that
 * declare a browser bundle and lets their package-local configs emit both
 * their Node loader entry and browser artifact.
 */
export default defineConfig(({ env }) => {
  const client = isBuildFaceClient(env?.MONOLITH_BUILD_FACE)
  return {
    // Three product-delta directories match the packages/*/* glob but carry no
    // TypeScript to build: skills/ and mcp/ are libraries with no package.json,
    // and bundle/ is a pure cordis.patch.yml layer.
    workspace: [
      'vendor/*',
      'packages/*/*',
      '!packages/monolith/skills',
      '!packages/monolith/mcp',
      '!packages/monolith/bundle',
      'apps/cli',
    ],
    entry: client ? '' : ['lib/types/{index,invariant,startup}.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    plugins: client ? [] : [typertPlugin({ mode: 'workspace', faces: ['host'] })],
  }
})
