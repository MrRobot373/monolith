/** @jsxImportSource react */

type MonolithMarkProps = {
  /** Pixel size of the square mark. Defaults to 24. */
  size?: number;
  className?: string;
};

/**
 * MONOLITH brand mark: an eight-ray starburst ("spark"). Inherits `currentColor`
 * so it can render in the accent terracotta (`text-dls-accent`) or any context color.
 */
export function MonolithMark({ size = 24, className }: MonolithMarkProps) {
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
  );
}
