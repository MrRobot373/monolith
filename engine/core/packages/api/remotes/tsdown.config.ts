import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@monolith/api-remotes',
  ['lib/types/index.js'],
  { hostPhase: true },
)
