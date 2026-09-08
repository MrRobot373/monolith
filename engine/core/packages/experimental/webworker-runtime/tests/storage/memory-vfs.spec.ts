/**
 * The identity, timestamp, link, mutation, and durability-sink guarantees
 * MemoryVfs owes its consumers, asserted directly rather than through the
 * `node:fs` bridge.
 *
 * `monolith-fs-local` builds a version token from `dev:ino:size:mtimeNs:ctimeNs` and
 * refuses a write whose token moved since it read. Two properties carry that:
 * `ino` identifies the entry at a path, and `mtimeMs` moves on every write. The
 * timestamp cases freeze the clock, because these writes are in memory and two
 * revisions routinely land in the same millisecond — a real-clock test passes
 * whether or not the strict increment exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryVfs } from '../../src/storage/memory.ts'
import type { VfsBigIntStats, VfsMutation, VfsMutationSink, VfsStats } from '../../src/storage/types.ts'

const identity = (vfs: MemoryVfs, path: string): bigint =>
  (vfs.statSync(path, { bigint: true }) as VfsBigIntStats).ino

const linkCount = (vfs: MemoryVfs, path: string): bigint =>
  (vfs.statSync(path, { bigint: true }) as VfsBigIntStats).nlink

const modified = (vfs: MemoryVfs, path: string): number => (vfs.statSync(path) as VfsStats).mtimeMs

afterEach(() => { vi.restoreAllMocks() })

describe('entry identity', () => {
  it('distinguishes paths and holds each identity across repeated stats', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/one.txt', 'one')
    vfs.seed('/monolith/two.txt', 'two')
    const first = identity(vfs, '/monolith/one.txt')
    expect(identity(vfs, '/monolith/two.txt')).not.toBe(first)
    expect(identity(vfs, '/monolith/one.txt')).toBe(first)
  })

  it('forgets the identities under a directory removed as a subtree', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/skills/git/SKILL.md', '# git\n')
    const before = identity(vfs, '/monolith/skills/git/SKILL.md')
    vfs.rmSync('/monolith/skills', { recursive: true })
    vfs.seed('/monolith/skills/git/SKILL.md', '# git rebuilt\n')
    expect(identity(vfs, '/monolith/skills/git/SKILL.md')).not.toBe(before)
  })

  it('moves the source identity when a file replaces another path', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/from.txt', 'moved')
    vfs.seed('/monolith/to.txt', 'replaced')
    const [source, destination] = [identity(vfs, '/monolith/from.txt'), identity(vfs, '/monolith/to.txt')]
    vfs.renameSync('/monolith/from.txt', '/monolith/to.txt')
    const renamed = identity(vfs, '/monolith/to.txt')
    expect(vfs.readFileSync('/monolith/to.txt', 'utf8')).toBe('moved')
    expect([renamed === source, renamed === destination]).toEqual([true, false])
  })
})

describe('modification time', () => {
  it('hydrates explicit metadata without confusing timestamps with permission bits', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/restored', 'value', { mode: 0o600, mtimeMs: 1_600_000_000_000 })
    vfs.seedDirectory('/monolith/restored-directory', { mode: 0o700, mtimeMs: 1_600_000_000_001 })
    const stats = vfs.statSync('/monolith/restored') as VfsStats
    const directory = vfs.statSync('/monolith/restored-directory') as VfsStats
    expect([stats.mode & 0o777, stats.mtimeMs]).toEqual([0o600, 1_600_000_000_000])
    expect([directory.mode & 0o777, directory.mtimeMs]).toEqual([0o700, 1_600_000_000_001])
  })

  it('advances on every write even while the clock stands still', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/log.jsonl', 'first\n')
    const seeded = modified(vfs, '/monolith/log.jsonl')
    vfs.writeFileSync('/monolith/log.jsonl', 'second\n')
    const written = modified(vfs, '/monolith/log.jsonl')
    vfs.appendFileSync('/monolith/log.jsonl', 'third\n')
    const appended = modified(vfs, '/monolith/log.jsonl')
    vfs.truncateSync('/monolith/log.jsonl', 6)
    const truncated = modified(vfs, '/monolith/log.jsonl')
    expect([written > seeded, appended > written, truncated > appended]).toEqual([true, true, true])
    // One millisecond per revision: the increment is the minimum that separates
    // two tokens, not a coarser bump that would skew a real timestamp.
    expect(truncated - seeded).toBe(3)
  })

  it('takes the clock once the clock has passed the entry', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/log.jsonl', 'first\n')
    clock.mockReturnValue(1_700_000_005_000)
    vfs.writeFileSync('/monolith/log.jsonl', 'second\n')
    expect(modified(vfs, '/monolith/log.jsonl')).toBe(1_700_000_005_000)
  })

  it('extends truncation with zero bytes', async () => {
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/file', new Uint8Array([1, 2]))
    vfs.truncateSync('/monolith/file', 5)
    expect([...vfs.readFileSync('/monolith/file') as Uint8Array]).toEqual([1, 2, 0, 0, 0])
    const handle = vfs.open('/monolith/file', 'r+')
    await handle.truncate(7)
    expect([...vfs.readFileSync('/monolith/file') as Uint8Array]).toEqual([1, 2, 0, 0, 0, 0, 0])
  })

  it('advances a directory only when its immediate entry set changes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/monolith/workspace')
    const empty = modified(vfs, '/monolith/workspace')
    vfs.writeFileSync('/monolith/workspace/file.txt', 'one')
    const created = modified(vfs, '/monolith/workspace')
    vfs.writeFileSync('/monolith/workspace/file.txt', 'two')
    const rewritten = modified(vfs, '/monolith/workspace')
    vfs.rmSync('/monolith/workspace/file.txt')
    const removed = modified(vfs, '/monolith/workspace')
    expect([created > empty, rewritten === created, removed > rewritten]).toEqual([true, true, true])
  })
})

describe('mutation publication', () => {
  it('publishes only committed runtime changes and keeps image seeding silent', () => {
    const vfs = new MemoryVfs()
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })
    vfs.seed('/monolith/seeded.txt', 'seeded')
    expect(mutations).toEqual([])
    vfs.writeFileSync('/monolith/seeded.txt', 'changed')
    vfs.mkdirSync('/monolith/created')
    vfs.chmodSync('/monolith/created', 0o700)
    vfs.renameSync('/monolith/seeded.txt', '/monolith/renamed.txt')
    vfs.rmSync('/monolith/created', { recursive: true })
    expect(mutations.map(mutation => ({
      kind: mutation.kind,
      path: mutation.path,
      ...mutation.kind === 'write' ? { entryChanged: mutation.entryChanged } : {},
      ...mutation.kind === 'chmod' ? { mode: mutation.mode } : {},
    }))).toEqual([
      { kind: 'write', path: '/monolith/seeded.txt', entryChanged: false },
      { kind: 'mkdir', path: '/monolith/created' },
      { kind: 'chmod', path: '/monolith/created', mode: 0o700 },
      { kind: 'remove', path: '/monolith/seeded.txt' },
      { kind: 'write', path: '/monolith/renamed.txt', entryChanged: true },
      { kind: 'remove', path: '/monolith/created' },
    ])
    const renamed = mutations[4]
    expect(renamed?.kind === 'write' && new TextDecoder().decode(renamed.bytes)).toBe('changed')
    expect(() => { vfs.writeFileSync('/missing/file', 'no') }).toThrow(/ENOENT/)
    expect(mutations).toHaveLength(6)
  })

  it('contains a faulty observer and lets disposal stop later notifications', () => {
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/monolith')
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
    const first = vfs.subscribe(() => { throw new Error('observer failed') })
    const seen: string[] = []
    const second = vfs.subscribe((mutation) => { seen.push(mutation.path) })
    vfs.writeFileSync('/monolith/one', '1')
    first()
    second()
    vfs.writeFileSync('/monolith/two', '2')
    expect(seen).toEqual(['/monolith/one'])
    expect(reported).toHaveBeenCalledOnce()
  })

  it('feeds the same complete mutations to a durable sink and live subscribers', async () => {
    const recorded: VfsMutation[] = []
    let flushes = 0
    const sink: VfsMutationSink = {
      record: (mutation) => { recorded.push(mutation) },
      flush: async () => { flushes += 1 },
    }
    const vfs = new MemoryVfs({ sink })
    vfs.seedDirectory('/monolith')
    const observed: VfsMutation[] = []
    vfs.subscribe((mutation) => { observed.push(mutation) })
    vfs.writeFileSync('/monolith/log', 'a')
    vfs.appendFileSync('/monolith/log', 'bc')
    await vfs.flush()
    expect(observed).toEqual(recorded)
    expect(observed[0]).toBe(recorded[0])
    expect(recorded[0]).toMatchObject({ kind: 'write', path: '/monolith/log', mode: 0o644, entryChanged: true })
    expect(recorded[1]).toMatchObject({ kind: 'write', path: '/monolith/log', mode: 0o644, entryChanged: false, appendedFrom: 1 })
    expect(recorded[1]?.kind === 'write' && new TextDecoder().decode(recorded[1].bytes)).toBe('abc')
    expect(flushes).toBe(1)
  })

  it('publishes descriptor writes at the file identity current path', () => {
    const mutations: VfsMutation[] = []
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/source', 'old')
    const descriptor = vfs.openFileSync('/monolith/source', 'r+')
    vfs.subscribe((mutation) => { mutations.push(mutation) })
    vfs.renameSync('/monolith/source', '/monolith/destination')
    mutations.length = 0
    descriptor.write(0, new TextEncoder().encode('new'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/monolith/destination'])
    expect(vfs.readFileSync('/monolith/destination', 'utf8')).toBe('new')
    vfs.unlinkSync('/monolith/destination')
    mutations.length = 0
    descriptor.write(0, new TextEncoder().encode('detached'))
    expect(mutations).toEqual([])
    expect(new TextDecoder().decode(descriptor.read(0, descriptor.stat().size))).toBe('detached')
  })

  it('decomposes a directory rename into replayable destination state', () => {
    const recorded: VfsMutation[] = []
    const vfs = new MemoryVfs({
      sink: { record: (mutation) => { recorded.push(mutation) }, flush: () => Promise.resolve() },
    })
    vfs.seedDirectory('/monolith/staging/nested', { mode: 0o700 })
    vfs.seed('/monolith/staging/nested/file', 'value', { mode: 0o600 })
    vfs.renameSync('/monolith/staging', '/monolith/published')

    expect(recorded.map(mutation => [mutation.kind, mutation.path])).toEqual([
      ['remove', '/monolith/staging'],
      ['mkdir', '/monolith/published'],
      ['mkdir', '/monolith/published/nested'],
      ['write', '/monolith/published/nested/file'],
    ])
    expect(recorded[3]).toMatchObject({ kind: 'write', mode: 0o600, entryChanged: true })
    expect(recorded[3]?.kind === 'write' && new TextDecoder().decode(recorded[3].bytes)).toBe('value')
  })
})

describe('directory rename', () => {
  it('rejects file, non-empty directory, and missing-parent destinations before mutation', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/source/nested/file', 'source')
    vfs.seed('/monolith/file', 'destination')
    vfs.seed('/monolith/non-empty/child', 'destination')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    expect(() => { vfs.renameSync('/monolith/source', '/monolith/file') })
      .toThrow(expect.objectContaining({ code: 'ENOTDIR' }))
    expect(() => { vfs.renameSync('/monolith/source', '/monolith/non-empty') })
      .toThrow(expect.objectContaining({ code: 'ENOTEMPTY' }))
    expect(() => { vfs.renameSync('/monolith/source', '/missing/destination') })
      .toThrow(expect.objectContaining({ code: 'ENOENT' }))

    expect(vfs.readFileSync('/monolith/source/nested/file', 'utf8')).toBe('source')
    expect(vfs.readFileSync('/monolith/file', 'utf8')).toBe('destination')
    expect(vfs.readFileSync('/monolith/non-empty/child', 'utf8')).toBe('destination')
    expect(mutations).toEqual([])
  })

  it('replaces an empty directory with the source subtree', () => {
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/monolith/source/nested', { mode: 0o700 })
    vfs.seed('/monolith/source/nested/file', 'source')
    vfs.seedDirectory('/monolith/destination', { mode: 0o711 })

    vfs.renameSync('/monolith/source', '/monolith/destination')

    expect(vfs.existsSync('/monolith/source')).toBe(false)
    expect(vfs.readFileSync('/monolith/destination/nested/file', 'utf8')).toBe('source')
    expect((vfs.statSync('/monolith/destination') as VfsStats).mode & 0o777).toBe(0o755)
    expect((vfs.statSync('/monolith/destination/nested') as VfsStats).mode & 0o777).toBe(0o700)
  })
})

describe('hard links', () => {
  it('shares identity, bytes, and mode until one name is removed', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/session.jsonl', 'committed\n')
    vfs.linkSync('/monolith/session.jsonl', '/monolith/session-latest.jsonl')
    vfs.linkSync('/monolith/session-latest.jsonl', '/monolith/session-archive.jsonl')
    expect(identity(vfs, '/monolith/session-latest.jsonl')).toBe(identity(vfs, '/monolith/session.jsonl'))
    expect(linkCount(vfs, '/monolith/session.jsonl')).toBe(3n)
    expect(vfs.readFileSync('/monolith/session-latest.jsonl', 'utf8')).toBe('committed\n')
    const changedPaths: string[] = []
    vfs.subscribe((mutation) => { changedPaths.push(mutation.path) })
    vfs.appendFileSync('/monolith/session.jsonl', 'appended\n')
    expect(changedPaths).toEqual([
      '/monolith/session.jsonl',
      '/monolith/session-latest.jsonl',
      '/monolith/session-archive.jsonl',
    ])
    expect(vfs.readFileSync('/monolith/session.jsonl', 'utf8')).toBe('committed\nappended\n')
    expect(vfs.readFileSync('/monolith/session-latest.jsonl', 'utf8')).toBe('committed\nappended\n')
    vfs.chmodSync('/monolith/session-latest.jsonl', 0o600)
    expect((vfs.statSync('/monolith/session.jsonl') as VfsStats).mode & 0o777).toBe(0o600)
    vfs.unlinkSync('/monolith/session-latest.jsonl')
    expect(linkCount(vfs, '/monolith/session.jsonl')).toBe(2n)
    vfs.unlinkSync('/monolith/session-archive.jsonl')
    expect(linkCount(vfs, '/monolith/session.jsonl')).toBe(1n)
    expect(vfs.readFileSync('/monolith/session.jsonl', 'utf8')).toBe('committed\nappended\n')
  })

  it('treats rename between names of the same node as a no-op', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/source', 'value')
    vfs.linkSync('/monolith/source', '/monolith/alias')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    vfs.renameSync('/monolith/source', '/monolith/alias')

    expect(vfs.readFileSync('/monolith/source', 'utf8')).toBe('value')
    expect(vfs.readFileSync('/monolith/alias', 'utf8')).toBe('value')
    expect(linkCount(vfs, '/monolith/source')).toBe(2n)
    expect(mutations).toEqual([])
  })

  it('retargets linked names through file replacement and directory moves', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/replacement', 'replacement')
    vfs.seed('/monolith/target', 'old')
    vfs.linkSync('/monolith/target', '/monolith/target-alias')
    const replaced = vfs.openFileSync('/monolith/target', 'r+')
    vfs.renameSync('/monolith/replacement', '/monolith/target')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    replaced.write(0, new TextEncoder().encode('changed'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/monolith/target-alias'])
    expect(vfs.readFileSync('/monolith/target', 'utf8')).toBe('replacement')
    expect(vfs.readFileSync('/monolith/target-alias', 'utf8')).toBe('changed')
    expect(linkCount(vfs, '/monolith/target-alias')).toBe(1n)

    vfs.seed('/monolith/tree/file', 'tree')
    vfs.linkSync('/monolith/tree/file', '/monolith/outside')
    const moved = vfs.openFileSync('/monolith/tree/file', 'r+')
    vfs.renameSync('/monolith/tree', '/monolith/moved')
    mutations.length = 0
    moved.write(0, new TextEncoder().encode('moved'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/monolith/outside', '/monolith/moved/file'])
    expect(linkCount(vfs, '/monolith/moved/file')).toBe(2n)

    vfs.rmSync('/monolith/moved', { recursive: true })
    mutations.length = 0
    moved.write(0, new TextEncoder().encode('kept!'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/monolith/outside'])
    expect(vfs.readFileSync('/monolith/outside', 'utf8')).toBe('kept!')
    expect(linkCount(vfs, '/monolith/outside')).toBe(1n)
  })

  it('rejects renaming a file over an existing directory', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/monolith/file', 'value')
    vfs.seedDirectory('/monolith/directory')
    expect(() => { vfs.renameSync('/monolith/file', '/monolith/directory') }).toThrow(expect.objectContaining({ code: 'EISDIR' }))
    expect(vfs.readFileSync('/monolith/file', 'utf8')).toBe('value')
    expect(vfs.statSync('/monolith/directory').isDirectory()).toBe(true)
  })
})
