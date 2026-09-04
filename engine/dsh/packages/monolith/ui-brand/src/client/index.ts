/** MONOLITH occupants for the generic browser-brand slots. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import {
  MonolithBrandMark, MonolithBrandName, MonolithHeroBrandMark,
} from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Fill the sidebar brand slots and the conversation hero as one
 * declaration-aware registration set. Unlike the official brand package this
 * registration is not profile-gated: a deployment that mounts MONOLITH always
 * means it, and the hero seat is occupied because its fallback is DeepSeek's
 * own mark rather than a neutral one.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.inject('conversation.hero.brand.mark', function* () {
        yield ctx.slots.register({ name: 'sidebar.brand.mark' }, MonolithBrandMark)
        yield ctx.slots.register({ name: 'sidebar.brand.name' }, MonolithBrandName)
        yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, MonolithHeroBrandMark)
      })))
}
