// @vitest-environment jsdom
import { Context } from '@monolith/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SlotRegistry } from '@monolith/client-ui-renderer/client'
import { apply, inject } from '../src/client/index.ts'
import {
  MonolithBrandMark, MonolithBrandName, MonolithHeroBrandMark,
} from '../src/client/Brand.tsx'
import { apply as hostApply } from '../src/index.ts'

afterEach(() => {
  cleanup()
})

/** Every slot MONOLITH occupies, including the hero the official build leaves. */
const HOLES = [
  'sidebar.brand.mark',
  'sidebar.brand.name',
  'conversation.hero.brand.mark',
] as const

/** Records the override layers the plugin installs, and their disposal. */
function recordingTheme() {
  const layers = new Map<string, Record<string, { light: string; dark: string }>>()
  return {
    layers,
    overrideTokens(source: string, tokens: Record<string, { light: string; dark: string }>) {
      layers.set(source, tokens)
      return () => { layers.delete(source) }
    },
  }
}

async function bench(declare = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  const theme = recordingTheme()
  ctx.provide('theme', theme as never)
  const declareHoles = () => slots.register({
    name: 'root',
    children: Object.fromEntries(HOLES.map(name => [name, { kind: 'single', scope: 'root' }])),
  } as never, () => null)
  const disposeHoles = declare ? declareHoles() : undefined
  return { ctx, slots, theme, declareHoles, disposeHoles }
}

describe('MONOLITH browser-brand plugin', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('declares exactly the services it uses', () => {
    expect(inject).toEqual(['slots', 'theme'])
  })

  it('installs the warm palette as one override layer and retracts it on teardown', async () => {
    const subject = await bench()
    const fiber = subject.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const layer = subject.theme.layers.get('@monolith/client-ui-brand')
    expect(layer).toBeDefined()
    // The ground and the accent are the two the palette exists to change.
    expect(layer?.['--dsw-alias-bg-base']).toEqual({ light: '#faf9f5', dark: '#1f1e1d' })
    expect(layer?.['--dsw-alias-brand-primary']).toEqual({ light: '#c96442', dark: '#d97757' })
    // Every entry carries both modes; a bare value is rejected by the registry.
    for (const [name, value] of Object.entries(layer ?? {})) {
      expect(typeof value.light, name).toBe('string')
      expect(typeof value.dark, name).toBe('string')
    }

    await fiber.dispose()
    expect(subject.theme.layers.has('@monolith/client-ui-brand')).toBe(false)
  })

  it('occupies every brand slot regardless of build profile', async () => {
    // Unlike ui-brand-official this registration is not profile-gated: a
    // deployment that mounts MONOLITH always means it.
    const subject = await bench()
    await subject.ctx.plugin({ inject: [...inject], apply }).await()
    for (const hole of HOLES) expect(subject.slots.entries(hole)).toHaveLength(1)
  })

  it('fills declarations before or after apply and removes every occupant on teardown', async () => {
    const before = await bench()
    const fiber = before.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(1)

    before.disposeHoles?.()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(0)
    before.declareHoles()
    await Promise.resolve()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(1)

    await fiber.dispose()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(0)

    const after = await bench(false)
    await after.ctx.plugin({ inject: [...inject], apply }).await()
    for (const hole of HOLES) expect(after.slots.entries(hole)).toHaveLength(0)
    after.declareHoles()
    await Promise.resolve()
    for (const hole of HOLES) expect(after.slots.entries(hole)).toHaveLength(1)
  })

  it('renders the mark at each requested size and the name without one', () => {
    const mark = render(<MonolithBrandMark size={34} />)
    expect(mark.container.querySelector('svg')?.getAttribute('width')).toBe('34')
    mark.rerender(<MonolithBrandMark size={24} />)
    expect(mark.container.querySelector('svg')?.getAttribute('width')).toBe('24')
    mark.unmount()

    // The sidebar slots the mark independently, so the name carries no svg.
    const name = render(<MonolithBrandName />)
    expect(name.container.querySelector('svg')).toBeNull()
    expect(name.container.textContent).toBe('MONOLITH')
  })

  it('passes the hero geometry class through to the mark', () => {
    const hero = render(<MonolithHeroBrandMark size={34} className="hero-mark" />)
    const svg = hero.container.querySelector('svg')
    expect(svg?.getAttribute('class')).toBe('hero-mark')
    expect(svg?.getAttribute('width')).toBe('34')
  })
})
