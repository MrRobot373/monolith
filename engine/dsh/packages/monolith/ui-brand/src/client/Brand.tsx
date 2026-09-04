import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  SidebarBrandMarkOwnerProps,
} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/** Geometry shared by both mark seats; `currentColor` keeps the mark themable. */
interface MarkProps {
  size: number
  className?: string | undefined
}

/**
 * The MONOLITH mark: an eight-ray starburst drawn in `currentColor`, so each
 * host surface decides the ink (sidebar foreground, hero accent) without this
 * package knowing the palette.
 * @param props - Requested square edge and optional host geometry class.
 * @returns the MONOLITH starburst mark.
 */
function MonolithMark({ size, className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <line x1="12" y1="2.6" x2="12" y2="8.0" />
        <line x1="12" y1="16.0" x2="12" y2="21.4" />
        <line x1="2.6" y1="12" x2="8.0" y2="12" />
        <line x1="16.0" y1="12" x2="21.4" y2="12" />
        <line x1="5.3" y1="5.3" x2="8.9" y2="8.9" />
        <line x1="15.1" y1="15.1" x2="18.7" y2="18.7" />
        <line x1="5.3" y1="18.7" x2="8.9" y2="15.1" />
        <line x1="15.1" y1="8.9" x2="18.7" y2="5.3" />
      </g>
    </svg>
  )
}

/**
 * Render the MONOLITH mark at the size the sidebar asks for; the collapsed
 * rail renders this same seat.
 * @param props - Host-supplied mark presentation.
 * @returns the MONOLITH mark.
 */
export function MonolithBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <MonolithMark size={size} />
}

/**
 * Render the MONOLITH wordmark without a mark: the sidebar slots the mark
 * independently, so repeating it here would double it.
 * @returns the MONOLITH name.
 */
export function MonolithBrandName() {
  return (
    <span
      style={{
        fontWeight: 600,
        letterSpacing: '0.14em',
        fontSize: '13px',
        textTransform: 'uppercase',
      }}
    >
      MONOLITH
    </span>
  )
}

/**
 * Render the blank-session hero mark. Unlike the official build, MONOLITH
 * occupies this seat: the fallback here is DeepSeek's own fish.
 * @param props - Requested square edge and the host's mark-geometry class.
 * @returns the MONOLITH mark sized for the hero.
 */
export function MonolithHeroBrandMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <MonolithMark size={size} className={className} />
}
