/**
 * FlowMerce design tokens — "SaaS Commerce Modern" (extracted from Stitch).
 *
 * Single source of truth for INLINE-STYLE consumers (e.g. dashboard-styles.ts).
 * shadcn/Tailwind consumers read the same values from globals.css CSS variables.
 * If you change a value here, mirror it in globals.css and vice-versa.
 */

export const tokens = {
  color: {
    // Surfaces
    background: '#F7F9FB', // app background (cool gray)
    surface: '#FFFFFF', // cards / panels
    surfaceLow: '#F2F4F6', // subtle fills, table headers
    surfaceHigh: '#E6E8EA', // active nav background
    // Text
    navy: '#1E293B', // headings / structural text
    text: '#191C1E', // body text
    textMuted: '#45474C', // secondary text
    textFaint: '#75777D', // captions / placeholders
    // Brand
    primary: '#4F46E5', // indigo — CTAs / active
    primaryHover: '#4338CA',
    primarySoft: '#EEF2FF', // indigo tint background
    // Status
    success: '#059669',
    successSoft: '#ECFDF5',
    info: '#1D4ED8',
    infoSoft: '#EFF6FF',
    warning: '#92400E',
    warningSoft: '#FFFBEB',
    danger: '#DC2626',
    dangerSoft: '#FEF2F2',
    // Lines
    border: '#E2E8F0',
    borderStrong: '#C5C6CD',
  },
  radius: {
    sm: 6,
    md: 8, // buttons / inputs
    lg: 12, // cards / containers
    xl: 16,
    pill: 9999,
  },
  space: {
    base: 4,
    xs: 8,
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
  },
  shadow: {
    card: '0 1px 3px rgba(30,41,59,0.05), 0 1px 2px rgba(30,41,59,0.03)',
    pop: '0 10px 15px -3px rgba(30,41,59,0.1), 0 4px 6px -2px rgba(30,41,59,0.05)',
  },
  font: {
    sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  },
} as const

/** Status → {bg, fg} chip colors, keyed by lowercase status string. */
export const statusChip: Record<string, { bg: string; fg: string }> = {
  delivered: { bg: tokens.color.successSoft, fg: tokens.color.success },
  completed: { bg: tokens.color.successSoft, fg: tokens.color.success },
  paid: { bg: tokens.color.successSoft, fg: tokens.color.success },
  shipped: { bg: tokens.color.infoSoft, fg: tokens.color.info },
  processing: { bg: tokens.color.infoSoft, fg: tokens.color.info },
  pending: { bg: tokens.color.warningSoft, fg: tokens.color.warning },
  cancelled: { bg: tokens.color.dangerSoft, fg: tokens.color.danger },
  refunded: { bg: tokens.color.dangerSoft, fg: tokens.color.danger },
}
