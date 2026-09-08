import { describe, expect, it } from 'vitest'
import type { NpmPackageLock, RegistryIndex } from './benchmark-npm-resolution.ts'
import {
  assertDualMonolithInstallLayout,
  buildDualMonolithRegistry,
} from './verify-npm-install-layout.ts'

function validLayout(): NpmPackageLock {
  return {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { '@monolith/cli': '0.2.0', 'monolith-previous': 'npm:@monolith/cli@0.1.0' } },
      'node_modules/@monolith/cordis': { version: '4.0.1' },
      'node_modules/@monolith/cli': {
        version: '0.2.0',
        dependencies: { '@monolith/child': '^0.2.0' },
        peerDependencies: { '@monolith/cordis': '^4.0.1' },
      },
      'node_modules/@monolith/child': {
        version: '0.2.0',
        dependencies: { '@monolith/leaf': '^0.2.0' },
      },
      'node_modules/@monolith/leaf': { version: '0.2.0' },
      'node_modules/monolith-previous': {
        name: '@monolith/cli',
        version: '0.1.0',
        dependencies: { '@monolith/child': '^0.1.0' },
        peerDependencies: { '@monolith/cordis': '^4.0.1' },
      },
      'node_modules/monolith-previous/node_modules/@monolith/child': {
        version: '0.1.0',
        dependencies: { '@monolith/leaf': '^0.1.0' },
      },
      'node_modules/monolith-previous/node_modules/@monolith/leaf': { version: '0.1.0' },
    },
  }
}

describe('npm install layout verifier', () => {
  it('creates two incompatible versions of every MONOLITH package', () => {
    const index: RegistryIndex = new Map([
      ['@monolith/cli', new Map([['0.1.1-rc.2', {
        name: '@monolith/cli',
        version: '0.1.1-rc.2',
        dependencies: { '@monolith/child': '^0.1.1-rc.2' },
        peerDependencies: { '@monolith/cordis': '^4.0.1' },
      }]])],
      ['@monolith/child', new Map([['0.1.1-rc.2', {
        name: '@monolith/child',
        version: '0.1.1-rc.2',
      }]])],
      ['@monolith/cordis', new Map([['4.0.1', {
        name: '@monolith/cordis',
        version: '4.0.1',
      }]])],
    ])

    const dual = buildDualMonolithRegistry(index, '0.1.1-rc.2')

    expect([...dual.get('@monolith/cli')?.keys() ?? []]).toEqual(['0.1.0', '0.2.0'])
    expect(dual.get('@monolith/cli')?.get('0.1.0')).toMatchObject({
      version: '0.1.0',
      dependencies: { '@monolith/child': '^0.1.0' },
      peerDependencies: { '@monolith/cordis': '^4.0.1' },
    })
    expect(dual.get('@monolith/cli')?.get('0.2.0')).toMatchObject({
      version: '0.2.0',
      dependencies: { '@monolith/child': '^0.2.0' },
    })
    expect(dual.get('@monolith/cordis')).toBe(index.get('@monolith/cordis'))
  })

  it('accepts isolated MONOLITH releases with one shared Cordis installation', () => {
    expect(assertDualMonolithInstallLayout(validLayout())).toEqual({
      monolithPackagesPerVersion: 3,
      checkedMonolithEdges: 4,
    })
  })

  it('rejects an internal edge that crosses release versions', () => {
    const layout = validLayout()
    const packages = { ...layout.packages }
    Reflect.deleteProperty(packages, 'node_modules/monolith-previous/node_modules/@monolith/leaf')

    expect(() => assertDualMonolithInstallLayout({ ...layout, packages })).toThrow(
      'node_modules/monolith-previous/node_modules/@monolith/child: dependencies '
      + '@monolith/leaf resolves to node_modules/@monolith/leaf@0.2.0, expected 0.1.0',
    )
  })

  it('rejects a second Cordis installation', () => {
    const layout = validLayout()
    const packages = {
      ...layout.packages,
      'node_modules/monolith-previous/node_modules/@monolith/cordis': { version: '4.0.1' },
    }

    expect(() => assertDualMonolithInstallLayout({ ...layout, packages })).toThrow(
      'expected one shared @monolith/cordis',
    )
  })
})
