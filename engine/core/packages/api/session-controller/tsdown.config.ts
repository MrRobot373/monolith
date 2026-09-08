import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@monolith/api-session-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
