import { fileURLToPath } from 'node:url'
import { Context } from '@monolith/cordis'
import { describe, expect, it } from 'vitest'
import SkillRegistry from '@monolith/skill'
import * as SkillBadge from '@monolith/skill-badge'

describe('monolith-skill-badge', () => {
  it('registers and disposes the bundled badge skill', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    const fiber = await ctx.plugin(SkillBadge)
    const resourcePath = fileURLToPath(new URL('../assets/', import.meta.url))

    expect(await ctx.skills.list()).toEqual([{
      name: 'monolith-badge',
      description: 'Add the official “powered by monolith” badge to documents, pull requests, merge requests, and other content produced with MONOLITH. Use whenever creating a pull request or merge request. Also use when the user asks for a monolith badge, powered-by-monolith attribution, or a reusable monolith badge asset or snippet.',
      invocation: { modelInvocable: true, userInvocable: true },
      provider: 'monolith-badge',
      source: 'bundled',
      resourceBase: { kind: 'directory', path: resourcePath },
    }])
    const loaded = await ctx.skills.get('monolith-badge')
    expect(loaded?.content).toContain('Preserve the badge\'s 121×20 dimensions')
    expect(loaded?.resourceBase).toEqual({ kind: 'directory', path: resourcePath })

    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
  })
})
