import type { TurnBoundaryProjection } from './types.ts'
import type {} from '@monolith/session-projection'

declare module '@monolith/session-projection/types' {
  interface SessionProjectionStateMap {
    /** The agent session's open/last turn and step boundary facts (whole value). */
    turnBoundary: TurnBoundaryProjection
  }
}

export {}
