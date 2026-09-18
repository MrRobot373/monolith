// The composer remains in ConversationRoot so switching out of the blank-draft
// phase does not remount its textarea.

import { useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  MARK_LOGO_PATH, MARK_LOGO_VIEWBOX, IconChevronDownOutline14, IconFolderClose16, IconFolderOpen16,
} from '@monolith/client-ui-primitives'
import { workspaceTitleOf } from '@monolith/util-workspace-path'
import type { ConversationSlotProps } from '../contract/slots.ts'
import css from './HeroShell.module.css'

/** The owner's locale seat type, passed to hero chrome as a plain prop. */
type HeroTranslate = ConversationSlotProps['t']

/**
 * Basename label for the workspace chip (the shared derivation);
 * separator-only paths echo the raw cwd.
 * @param cwd - workspace directory path (non-empty).
 * @returns chip label.
 */
export function workspaceLabel(cwd: string): string {
  const base = workspaceTitleOf(cwd)
  return base !== '' ? base : cwd
}

/**
 * The workspace chip (folder + label + chevron), always interactive: before
 * the first message the workspace stays switchable — picking another one
 * moves the New Session flow to that workspace's blank session. Without a
 * label the chip renders its placeholder state: closed folder + the
 * "Choose workspace" call to action.
 * @param props.label - chip label (see {@link workspaceLabel}); omitted → placeholder.
 * @param props.menuOpen - menu expansion echo.
 * @param props.onClick - menu toggle.
 * @returns the chip button element.
 */
export function WorkspaceChip({ buttonRef, label, menuOpen = false, onClick, t }: {
  buttonRef?: RefObject<HTMLButtonElement>
  label?: string | undefined
  menuOpen?: boolean
  onClick?: () => void
  t: HeroTranslate
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={css.workspace}
      aria-label={t('hero.chooseWorkspace')}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={onClick}
    >
      {label === undefined
        ? <IconFolderClose16 className={css.folder} size={16} />
        : <IconFolderOpen16 className={css.folder} size={16} />}
      <span className={css.workspaceLabel}>{label ?? t('hero.chooseWorkspace')}</span>
      <IconChevronDownOutline14 className={css.chevron} size={12} />
    </button>
  )
}

/** Hero chrome props. The workspace row rides the InputBar accessory hole, not here. */
export interface HeroShellProps {
  /** The owner's locale seat, passed down as a plain prop. */
  t: HeroTranslate
  /** Authorized renderer for the hero brand-mark slot. */
  renderSlot: ConversationSlotProps['renderSlot']
  /** Overlay content after the stack (modals). */
  children?: ReactNode
}

/* Hover pulse morph targets: the resting MARK_LOGO_PATH with the ray tips
   pushed out and drawn in. All three share the same absolute M/Q command
   structure, so SMIL can interpolate `d` between them: the eight rays
   lengthen and sharpen on the way out, then shorten and thicken on the way
   back, which reads as a slow twinkle rather than a spin. */
const HERO_PULSE_OUT_PATH =
  'M12 0.3Q12.651 10.429 20.273 3.727Q13.571 11.349 23.7 12Q13.571 12.651 20.273 20.273Q12.651 13.571 12 23.7Q11.349 13.571 3.727 20.273Q10.429 12.651 0.3 12Q10.429 11.349 3.727 3.727Q11.349 10.429 12 0.3Z'
const HERO_PULSE_IN_PATH =
  'M12 1.9Q13.11 9.321 19.142 4.858Q14.679 10.89 22.1 12Q14.679 13.11 19.142 19.142Q13.11 14.679 12 22.1Q10.89 14.679 4.858 19.142Q9.321 13.11 1.9 12Q9.321 10.89 4.858 4.858Q10.89 9.321 12 1.9Z'

/**
 * The hero mark (34px wide), static at rest. Hovering pulses it in place: a
 * gentle drift (CSS, on the hitbox hover) while the mark itself morphs —
 * SMIL interpolates `d` through the rays-out and rays-in targets on the same
 * 1.6s period, so the starburst breathes in real curve deformation.
 * Decorative — hidden from the accessibility tree; reduced motion keeps the
 * static filled logo on hover (sampled at mouseenter; a mid-hover preference
 * change takes effect on the next enter).
 * @param props.hovering - driven by the hitbox parent's pointer state.
 * @returns the mark svg element.
 */
function HeroMark({ hovering }: { hovering: boolean }) {
  return (
    <svg
      className={css.mark}
      width={34}
      height={(34 * MARK_LOGO_VIEWBOX.height) / MARK_LOGO_VIEWBOX.width}
      viewBox={`0 0 ${MARK_LOGO_VIEWBOX.width} ${MARK_LOGO_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={MARK_LOGO_PATH} fill="currentColor">
        {hovering && (
          <animate
            attributeName="d"
            values={`${MARK_LOGO_PATH};${HERO_PULSE_OUT_PATH};${MARK_LOGO_PATH};${HERO_PULSE_IN_PATH};${MARK_LOGO_PATH}`}
            keyTimes="0;0.35;0.55;0.75;1"
            calcMode="spline"
            keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
            dur="1.6s"
            repeatCount="indefinite"
          />
        )}
      </path>
    </svg>
  )
}

/**
 * Render the hero chrome (headline only; no composer, no workspace row).
 * @param props - see {@link HeroShellProps}.
 * @returns the centered hero element tree.
 */
export function HeroShell({ t, renderSlot, children }: HeroShellProps) {
  const [hovering, setHovering] = useState(false)
  return (
    <div className={css.root}>
      <div className={css.stack}>
        <div className={css.headline}>
          {/* figma 34:10412: mark 34×24 leading the headline, gap 10. */}
          <span
            className={css.markHitbox}
            onMouseEnter={() => {
              if (window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
                setHovering(true)
              }
            }}
            onMouseLeave={() => { setHovering(false) }}
          >
            {renderSlot('conversation.hero.brand.mark', { size: 34, className: css.mark }, {
              fallback: <HeroMark hovering={hovering} />,
            })}
          </span>
          <span className={css.headlineText}>
            {t('hero.headline')}
          </span>
          <span className={css.previewBadge}>{t('hero.preview')}</span>
        </div>
        <div className={css.body}>
          {/* The composer remains mounted outside this component. */}
        </div>
      </div>
      {children}
    </div>
  )
}
