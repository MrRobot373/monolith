import type { IconProps } from './icons/props.ts'
import { MARK_LOGO_PATH } from './MarkLogo.tsx'

/** Display options for the brand wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading mark; defaults to true. */
  includeMark?: boolean | undefined
}

/**
 * Render the full brand wordmark.
 *
 * The name is set as live text rather than outlined paths so it inherits the
 * host surface's ink through `currentColor` and stays legible at any size;
 * `textLength` pins it to the same 156-unit box the mark-less viewBox crops
 * to, so callers can rely on the geometry regardless of the rendering font.
 * @param props.size - height in px (default 24; width follows the selected artwork).
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - whether to include the leading mark.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const width = includeMark ? 182 : 156
  return (
    <svg
      width={(size * width) / 24}
      height={size}
      className={className}
      viewBox={includeMark ? '0 0 182 24' : '26 0 156 24'}
      fill="none"
      aria-hidden="true"
    >
      {includeMark && (
        <g transform="translate(0 1) scale(0.9167)">
          <path d={MARK_LOGO_PATH} fill="currentColor" />
        </g>
      )}
      <text
        x="26"
        y="18"
        textLength="156"
        lengthAdjust="spacingAndGlyphs"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="17"
        fontWeight="600"
      >
        MONOLITH
      </text>
    </svg>
  )
}
