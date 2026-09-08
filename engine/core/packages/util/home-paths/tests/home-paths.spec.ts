import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_MONOLITH_HOME_DISPLAY,
  MONOLITH_HOME_DIR_NAME,
  canonicalizeWatchPath,
  defaultMonolithHome,
  monolithHomeDisplay,
  monolithHomePath,
  expandHomePath,
  resolveMonolithHome,
} from '@monolith/home-paths'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('monolith path helpers', () => {
  it('owns the shared default MONOLITH home directory name', () => {
    expect(MONOLITH_HOME_DIR_NAME).toBe('.monolith')
    expect(DEFAULT_MONOLITH_HOME_DISPLAY).toBe('~/.monolith')
    expect(defaultMonolithHome()).toBe(join(homedir(), '.monolith'))
  })

  it('expands tilde paths without changing non-tilde paths', () => {
    expect(expandHomePath('~')).toBe(homedir())
    expect(expandHomePath('~/.monolith')).toBe(join(homedir(), '.monolith'))
    expect(expandHomePath('~\\.monolith')).toBe(join(homedir(), '.monolith'))
    expect(expandHomePath('/tmp/.monolith')).toBe('/tmp/.monolith')
    expect(expandHomePath('~other/.monolith')).toBe('~other/.monolith')
  })

  it('resolves explicit path before MONOLITH_HOME and the default', () => {
    const envHome = join(homedir(), 'env-monolith')

    expect(resolveMonolithHome('/tmp/explicit-monolith', { MONOLITH_HOME: '~/env-monolith' })).toBe(resolve('/tmp/explicit-monolith'))
    expect(resolveMonolithHome(undefined, { MONOLITH_HOME: '~/env-monolith' })).toBe(envHome)
    expect(resolveMonolithHome(undefined, {})).toBe(defaultMonolithHome())
  })

  it('treats an empty or whitespace-only MONOLITH_HOME as unset', () => {
    expect(resolveMonolithHome(undefined, { MONOLITH_HOME: '' })).toBe(defaultMonolithHome())
    expect(resolveMonolithHome(undefined, { MONOLITH_HOME: '   ' })).toBe(defaultMonolithHome())
  })

  it('joins child segments onto the resolved MONOLITH_HOME', () => {
    vi.stubEnv('MONOLITH_HOME', '~/env-monolith')
    expect(monolithHomePath()).toBe(join(homedir(), 'env-monolith'))
    expect(monolithHomePath('storages', 'cache')).toBe(join(homedir(), 'env-monolith', 'storages', 'cache'))
  })

  it('labels a resolved home by whether it is the default root', () => {
    expect(monolithHomeDisplay(resolve(defaultMonolithHome()))).toBe('~/.monolith')
    expect(monolithHomeDisplay('/some/other/root')).toBe('$MONOLITH_HOME')
  })

  it('canonicalizes a watcher ancestor while preserving a missing suffix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monolith-watch-path-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      await mkdir(target)
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
      await expect(canonicalizeWatchPath(join(alias, 'later', 'config.yml'))).resolves.toBe(
        join(await realpath(target), 'later', 'config.yml'),
      )
      const file = join(root, 'file')
      await writeFile(file, 'not a directory')
      await expect(canonicalizeWatchPath(join(file, 'child'))).rejects.toMatchObject({ code: 'ENOTDIR' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
