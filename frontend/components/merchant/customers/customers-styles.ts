import type { CSSProperties } from 'react'
import { tokens } from '@/lib/design/tokens'

const c = tokens.color
const r = tokens.radius
const f = tokens.font.sans

export const C: Record<string, CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, fontFamily: f, color: c.text, position: 'relative' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 },
  statCard: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: r.lg, padding: '14px 16px', boxShadow: tokens.shadow.card },
  statLabel: { fontSize: 11, color: c.textMuted, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 },
  statValue: { fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: c.navy },
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  searchInput: {
    flex: 1, minWidth: 200, padding: '8px 14px', borderRadius: r.md,
    border: `1.5px solid ${c.border}`, fontSize: 13, background: c.surface,
    color: c.navy, outline: 'none', fontFamily: f, transition: 'border-color 0.15s',
  },
  segTabs: { display: 'flex', gap: 2, background: c.surfaceLow, borderRadius: r.md, padding: 3 },
  segTab: {
    padding: '6px 12px', borderRadius: r.sm, border: 'none',
    background: 'transparent', cursor: 'pointer', fontSize: 12,
    color: c.textMuted, fontFamily: f, transition: 'background 0.15s',
  },
  segTabActive: { background: c.surface, color: c.navy, fontWeight: 500 },
  tableWrap: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: r.lg, overflow: 'hidden', boxShadow: tokens.shadow.card },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: c.surfaceLow },
  th: {
    fontSize: 11, color: c.textMuted, fontWeight: 600, textAlign: 'start',
    padding: '10px 14px', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap', userSelect: 'none',
  },
  tr: { cursor: 'pointer', transition: 'background 0.1s' },
  trAlt: { background: c.surfaceLow },
  td: { fontSize: 13, padding: '11px 14px', verticalAlign: 'middle', borderBottom: `1px solid ${c.border}` },
  miniAvatar: {
    width: 30, height: 30, borderRadius: r.md,
    background: c.primarySoft, color: c.primary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
  },
  custName: { fontSize: 13, fontWeight: 500, margin: 0, color: c.navy },
  custEmail: { fontSize: 11, color: c.textFaint, margin: 0 },
  pill: { fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: r.sm, whiteSpace: 'nowrap' },
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,20,40,0.4)', zIndex: 40 },
  drawer: {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 380,
    background: c.surface, zIndex: 50, overflowY: 'auto',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-8px 0 32px rgba(30,41,59,0.12)',
  },
  drawerHead: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '20px 20px 14px', borderBottom: `1px solid ${c.border}`,
  },
  drawerAvatar: {
    width: 44, height: 44, borderRadius: r.md,
    background: c.primarySoft, color: c.primary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, flexShrink: 0,
  },
  drawerName: { fontSize: 15, fontWeight: 700, margin: 0, color: c.navy },
  drawerEmail: { fontSize: 12, color: c.textFaint, margin: '2px 0 0' },
  closeBtn: {
    width: 28, height: 28, borderRadius: r.sm, border: `1px solid ${c.border}`,
    background: c.surfaceLow, cursor: 'pointer', fontSize: 18, color: c.textMuted,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', flexShrink: 0,
  },
  drawerBadgeRow: { display: 'flex', gap: 8, padding: '12px 20px', borderBottom: `1px solid ${c.border}` },
  drawerMetrics: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 1, background: c.border, borderBottom: `1px solid ${c.border}`,
  },
  drawerMetricCard: { background: c.surface, padding: '14px 12px', textAlign: 'center' },
  drawerMetricLabel: { fontSize: 10, color: c.textFaint, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  drawerMetricValue: { fontSize: 15, fontWeight: 700, margin: 0, color: c.navy },
  drawerSection: { padding: '16px 20px', borderBottom: `1px solid ${c.border}` },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${c.surfaceLow}` },
  infoKey: { fontSize: 12, color: c.textMuted },
  infoVal: { fontSize: 12, color: c.navy, fontWeight: 500 },
  segInsight: { fontSize: 13, color: c.textMuted, lineHeight: 1.6, margin: 0 },
  emptyRow: { textAlign: 'center', padding: '40px 20px', color: c.textFaint, fontSize: 13 },
}
