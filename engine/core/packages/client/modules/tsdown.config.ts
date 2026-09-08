import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@monolith/client-modules',
  ['lib/types/index.js', 'lib/types/invariant.js'],
)
