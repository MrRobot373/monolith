/** MONOLITH occupants for the generic browser-brand slots, and the palette. */
import type { Context as ClientContext } from '@monolith/cordis'
import type {} from '@monolith/client-ui-conversation/client'
import type {} from '@monolith/client-ui-renderer/client'
import type {} from '@monolith/client-ui-sidebar/client'
import type {} from '@monolith/client-ui-theme/client'
import {
  MonolithBrandMark, MonolithBrandName, MonolithHeroBrandMark,
} from './Brand.tsx'
import { MONOLITH_PALETTE } from './palette.ts'

/** Layer identity for the palette override; one layer per source. */
const PALETTE_SOURCE = '@monolith/client-ui-brand'

/** Required services: the UI slot registry and the theme registry. */
export const inject = ['slots', 'theme']

/**
 * Fill the sidebar brand slots and the conversation hero as one
 * declaration-aware registration set. Unlike the official brand package this
 * registration is not profile-gated: a deployment that mounts MONOLITH always
 * means it, and the hero seat is occupied because the
 * shell's own fallback is the upstream mark rather than a neutral one.
 * The palette rides along as a token-override layer rather than a registered
 * theme, so it warms whichever built-in the user has selected instead of
 * adding a third entry to the Appearance row.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.theme.overrideTokens(PALETTE_SOURCE, MONOLITH_PALETTE), 'monolith: warm palette')
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.inject('conversation.hero.brand.mark', function* () {
        yield ctx.slots.register({ name: 'sidebar.brand.mark' }, MonolithBrandMark)
        yield ctx.slots.register({ name: 'sidebar.brand.name' }, MonolithBrandName)
        yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, MonolithHeroBrandMark)
      })))
}
