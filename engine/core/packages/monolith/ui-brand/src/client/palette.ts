/**
 * The MONOLITH palette: a warm-neutral override layer over the shipped
 * cool-bluish base.
 *
 * The base design platform is built on a bluish neutral ramp with a near-black
 * brand color and a blue accent scale. MONOLITH's identity is warm — an ivory
 * ground, warm ink, and a terracotta accent — so this layer restates every
 * token that carries either the temperature or the accent. Tokens that are
 * already scheme-neutral (masks, pure-black scrims, the red/green/amber state
 * ramps) are deliberately left to the base.
 *
 * Every entry carries both modes because the registry rejects a bare string:
 * an override with one value goes illegible the moment the user switches
 * color scheme.
 */
import type { ThemeTokenOverrides } from '@monolith/client-ui-theme/client'

/* Warm neutral ramp — the ivory ground and the ink that sits on it. */
const IVORY = '#faf9f5'
const PAPER = '#ffffff'
const SAND_1 = '#f5f3ed'
const SAND_2 = '#f0ede4'
const SAND_3 = '#e9e5da'
const INK = '#141413'
const INK_SOFT = '#2b2a27'

/* Warm dark ramp — the same hue family with the values inverted. */
const NIGHT = '#1f1e1d'
const NIGHT_1 = '#262624'
const NIGHT_2 = '#2d2c29'
const NIGHT_3 = '#34322e'
const NIGHT_4 = '#3b3934'
const BONE = '#f5f4ef'

/* Terracotta accent. The deeper tone carries fills on ivory; the lighter one
   carries them on the dark ground, where the deep tone reads muddy. */
const CLAY = '#c96442'
const CLAY_DEEP = '#b5543a'
const CLAY_LIGHT = '#d97757'
const CLAY_LIFT = '#e08a6b'
const CLAY_WASH = '#f0ded6'
const CLAY_WASH_DARK = '#3d2f28'

/** Warm-neutral token layer applied over the shipped base palette. */
export const MONOLITH_PALETTE: ThemeTokenOverrides = {
  /* ── grounds ─────────────────────────────────────────────────────────── */
  '--dsw-alias-bg-base': { light: IVORY, dark: NIGHT },
  '--dsw-alias-bg-layer-1': { light: PAPER, dark: NIGHT_1 },
  '--dsw-alias-bg-layer-2': { light: SAND_1, dark: NIGHT_2 },
  '--dsw-alias-bg-layer-3': { light: SAND_2, dark: NIGHT_3 },
  '--dsw-alias-bg-module-platform': { light: SAND_2, dark: NIGHT_2 },
  '--dsw-alias-bg-multi-select': { light: SAND_2, dark: NIGHT_3 },
  '--dsw-alias-bg-overlay': { light: PAPER, dark: NIGHT_1 },
  '--dsw-alias-bg-skeleton': { light: 'rgba(20, 20, 19, 0.05)', dark: 'rgba(245, 244, 239, 0.06)' },

  /* ── borders ─────────────────────────────────────────────────────────── */
  '--dsw-alias-border-l1': { light: 'rgba(20, 20, 19, 0.06)', dark: 'rgba(245, 244, 239, 0.07)' },
  '--dsw-alias-border-l2': { light: 'rgba(20, 20, 19, 0.10)', dark: 'rgba(245, 244, 239, 0.12)' },
  '--dsw-alias-border-l2-darkmode-thin': { light: 'rgba(20, 20, 19, 0.10)', dark: 'rgba(245, 244, 239, 0.10)' },
  '--dsw-alias-border-l3': { light: 'rgba(20, 20, 19, 0.13)', dark: 'rgba(245, 244, 239, 0.16)' },
  '--dsw-alias-border-l4': { light: 'rgba(20, 20, 19, 0.18)', dark: 'rgba(245, 244, 239, 0.22)' },

  /* ── brand ───────────────────────────────────────────────────────────── */
  '--dsw-alias-brand-primary': { light: CLAY, dark: CLAY_LIGHT },
  '--dsw-alias-brand-text': { light: CLAY_DEEP, dark: CLAY_LIFT },
  '--dsw-alias-brand-primary-invert': { light: IVORY, dark: NIGHT },

  /* ── buttons ─────────────────────────────────────────────────────────── */
  '--dsw-alias-button-primary-fill': { light: CLAY, dark: CLAY_LIGHT },
  '--dsw-alias-button-primary-hover': { light: CLAY_DEEP, dark: CLAY },
  '--dsw-alias-button-primary-dimmed': { light: CLAY_WASH, dark: CLAY_WASH_DARK },
  '--dsw-alias-button-info-fill': { light: CLAY, dark: CLAY_LIGHT },
  '--dsw-alias-button-info-hover': { light: CLAY_DEEP, dark: CLAY },
  '--dsw-alias-button-elevated-fill': { light: PAPER, dark: NIGHT_2 },
  '--dsw-alias-button-floating-fill': { light: PAPER, dark: NIGHT_2 },
  '--dsw-alias-button-floating-hover': { light: SAND_1, dark: NIGHT_3 },
  '--dsw-alias-button-ghost-active-fill': { light: SAND_2, dark: NIGHT_3 },
  '--dsw-alias-button-ghost-active-hover': { light: SAND_3, dark: NIGHT_4 },
  '--dsw-alias-button-ghost-active-border': { light: 'rgba(20, 20, 19, 0.18)', dark: 'rgba(245, 244, 239, 0.22)' },
  '--dsw-alias-button-contrast-fill': { light: '#55534c', dark: '#b5b2a9' },

  /* ── interactive states ──────────────────────────────────────────────── */
  '--dsw-alias-interactive-bg-hover': { light: 'rgba(20, 20, 19, 0.05)', dark: 'rgba(245, 244, 239, 0.07)' },
  '--dsw-alias-interactive-bg-active': { light: 'rgba(20, 20, 19, 0.09)', dark: 'rgba(245, 244, 239, 0.11)' },
  '--dsw-alias-interactive-bg-hover-accent': { light: 'rgba(201, 100, 66, 0.10)', dark: 'rgba(217, 119, 87, 0.16)' },
  '--dsw-alias-interactive-bg-hover-solid': { light: SAND_2, dark: NIGHT_3 },

  /* ── type ────────────────────────────────────────────────────────────── */
  '--dsw-alias-label-primary': { light: INK, dark: BONE },
  '--dsw-alias-label-secondary': { light: '#5e5c55', dark: '#b5b2a9' },
  '--dsw-alias-label-tertiary': { light: '#83817a', dark: '#94918a' },
  '--dsw-alias-label-caption': { light: '#96938c', dark: '#7d7a73' },
  '--dsw-alias-label-dimmed': { light: '#c4c1b8', dark: '#55534c' },
  '--dsw-alias-label-primary-dimmed': { light: INK_SOFT, dark: '#e5e3dc' },
  '--dsw-alias-label-primary-bluish': { light: INK_SOFT, dark: '#e5e3dc' },
  '--dsw-alias-label-primary-foreground': { light: IVORY, dark: NIGHT },
  '--dsw-alias-label-primary-inverted': { light: IVORY, dark: NIGHT },

  /* ── markdown surfaces ───────────────────────────────────────────────── */
  '--dsw-alias-markdown-code-block': { light: SAND_1, dark: '#1a1918' },
  '--dsw-alias-markdown-code-block-banner': { light: SAND_2, dark: '#1a1918' },
  '--dsw-alias-markdown-code-segment-selected': { light: PAPER, dark: NIGHT_2 },
  '--dsw-alias-markdown-code-segment-unselected': { light: SAND_1, dark: NIGHT_3 },
  '--dsw-alias-markdown-inline-code': { light: SAND_2, dark: NIGHT_3 },
  '--dsw-alias-markdown-citation': { light: SAND_2, dark: NIGHT_3 },
  '--dsw-alias-markdown-placeholder': { light: SAND_2, dark: NIGHT_3 },
  '--dsw-alias-markdown-tag': { light: SAND_2, dark: NIGHT_3 },

  /* ── scrollbars, overlays ────────────────────────────────────────────── */
  '--dsw-alias-scrollbar-bg-l1': { light: 'rgba(20, 20, 19, 0.14)', dark: 'rgba(245, 244, 239, 0.16)' },
  '--dsw-alias-scrollbar-bg-l2': { light: 'rgba(20, 20, 19, 0.14)', dark: 'rgba(245, 244, 239, 0.16)' },
  '--dsw-alias-scrollbar-hover-l1': { light: 'rgba(20, 20, 19, 0.24)', dark: 'rgba(245, 244, 239, 0.26)' },
  '--dsw-alias-scrollbar-hover-l2': { light: 'rgba(20, 20, 19, 0.24)', dark: 'rgba(245, 244, 239, 0.26)' },
  '--dsw-alias-toast-bg': { light: INK_SOFT, dark: NIGHT_3 },
  '--dsw-alias-tooltip-bg': { light: INK_SOFT, dark: NIGHT_3 },

  /* ── the accent-carrying state ramp ──────────────────────────────────── */
  '--dsw-alias-state-business-primary': { light: CLAY, dark: CLAY_LIGHT },
  '--dsw-alias-state-business-tertiary': { light: CLAY_WASH, dark: CLAY_WASH_DARK },

  /* ── product-specific surfaces ───────────────────────────────────────── */
  '--dsw-specific-bubble': { light: SAND_2, dark: NIGHT_3 },
  '--dsw-specific-bubble-highlight': { light: SAND_3, dark: NIGHT_4 },
  '--dsw-specific-sidebar-fill': { light: SAND_1, dark: '#1a1918' },
  '--dsw-specific-sidebar-nav-item-active': { light: SAND_3, dark: NIGHT_3 },
  '--dsw-specific-sidebar-nav-item-active-accent': { light: CLAY_WASH, dark: CLAY_WASH_DARK },
  '--dsw-specific-sidebar-nav-item-hover': { light: SAND_2, dark: NIGHT_2 },
  '--dsw-specific-input-major': { light: PAPER, dark: NIGHT_2 },
  '--dsw-specific-menu': { light: PAPER, dark: NIGHT_2 },
  '--dsw-specific-selector': { light: SAND_2, dark: NIGHT_3 },
  '--dsw-specific-tip': { light: SAND_2, dark: NIGHT_3 },
  '--dsw-specific-login-input': { light: SAND_1, dark: NIGHT_2 },

  /* ── the shared accent ramp ──────────────────────────────────────────── */
  /* Renamed out of its vendor-brand spelling; retinted from blue to clay so a
     component reading the ramp directly (the chat shimmer, the ongoing state
     dot) warms with everything else. */
  '--dsw-static-accent-50': { light: '#fdf3ee', dark: '#2b211c' },
  '--dsw-static-accent-100': { light: '#f9e3d9', dark: CLAY_WASH_DARK },
  '--dsw-static-accent-200': { light: '#f2cdbc', dark: '#4d3a30' },
  '--dsw-static-accent-300': { light: '#e8ab90', dark: '#6b4f3f' },
  '--dsw-static-accent-400': { light: '#dd8f6d', dark: '#a36047' },
  '--dsw-static-accent-450': { light: CLAY_LIGHT, dark: CLAY },
  '--dsw-static-accent-500': { light: CLAY, dark: CLAY_LIGHT },
  '--dsw-static-accent-600': { light: CLAY_DEEP, dark: CLAY_LIFT },
  '--dsw-static-accent-800': { light: '#7a3a28', dark: '#f0b49a' },
  '--dsw-static-accent-900': { light: '#5c2b1e', dark: '#f5cbb8' },
}
