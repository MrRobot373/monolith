import type { IconProps } from './icons/props.ts'

/** Native viewBox of {@link MARK_LOGO_PATH} (width and height in user units). */
export const MARK_LOGO_VIEWBOX = { width: 24, height: 24 }

/**
 * The eight-ray starburst path data, exported for consumers that compose their
 * own svg (entrance effects, masks) around the same geometry.
 */
export const MARK_LOGO_PATH = 'M12 1Q12.842 9.967 19.778 4.222Q14.033 11.158 23 12Q14.033 12.842 19.778 19.778Q12.842 14.033 12 23Q11.158 14.033 4.222 19.778Q9.967 12.842 1 12Q9.967 11.158 4.222 4.222Q11.158 9.967 12 1Z'

/**
 * Render the brand mark.
 * @param props.size - width in px (default 24; the mark is square).
 * @param props.className - extra class for layout placement.
 * @returns the logo svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function MarkLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={(size * MARK_LOGO_VIEWBOX.height) / MARK_LOGO_VIEWBOX.width}
      className={className}
      viewBox={`0 0 ${MARK_LOGO_VIEWBOX.width} ${MARK_LOGO_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={MARK_LOGO_PATH} fill="currentColor" />
    </svg>
  )
}
