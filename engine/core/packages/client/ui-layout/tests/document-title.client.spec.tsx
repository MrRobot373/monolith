// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DocumentTitle } from '../src/client/DocumentTitle.tsx'

afterEach(() => {
  cleanup()
  document.title = ''
  vi.unstubAllEnvs()
})

describe('DocumentTitle', () => {
  it('projects a durable title and restores the product title', () => {
    vi.stubEnv('MONOLITH_CLIENT_TITLE', 'MONOLITH')
    document.title = 'stale title'
    const mounted = render(<DocumentTitle productTitle="MONOLITH" />)
    expect(document.title).toBe('MONOLITH')
    mounted.rerender(<DocumentTitle title="First title" productTitle="MONOLITH" />)
    expect(document.title).toBe('First title — MONOLITH')
    mounted.rerender(<DocumentTitle title="Revised title" productTitle="MONOLITH" />)
    expect(document.title).toBe('Revised title — MONOLITH')
    mounted.rerender(<DocumentTitle productTitle="MONOLITH" />)
    expect(document.title).toBe('MONOLITH')
    mounted.unmount()
    expect(document.title).toBe('MONOLITH')
  })

  it('uses the generic title when the build provides no title', () => {
    vi.stubEnv('MONOLITH_CLIENT_TITLE', '')
    delete process.env.MONOLITH_CLIENT_TITLE
    const mounted = render(<DocumentTitle title="First title" productTitle="MONOLITH Local Build" />)
    expect(document.title).toBe('First title — MONOLITH Local Build')
    mounted.unmount()
    expect(document.title).toBe('MONOLITH Local Build')
  })
})
