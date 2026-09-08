import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@monolith/api-workspace-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
