import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@monolith/session-log-export',
  ['lib/types/index.js'],
  { hostPhase: true },
)
