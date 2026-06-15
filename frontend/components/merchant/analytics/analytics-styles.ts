import type { CSSProperties } from 'react'
import { tokens } from '@/lib/design/tokens'

const c = tokens.color
const r = tokens.radius
const f = tokens.font.sans

export const A: Record<string, CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, fontFamily: f, color: c.text },
  periodRow: { display: 'flex', justifyContent: 'flex-end' },
  periodTabs: { display: 'flex', background: c.surfaceLow, borderRadius: r.md, padding: 3, gap: 2 },
  periodTab: {
    padding: '6px 14px', borderRadius: r.sm, border: 'none',
    background: 'transparent', cursor: 'pointer', fontSize: 12, color: c.textMuted, fontFamily: f,
    transition: 'background 0.15s, color 0.15s',
  },
  periodTabActive: { background: c.surface, color: c.navy, fontWeight: 500 },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 },
  kpiCard: {
    background: c.surface, border: `1.5px solid ${c.border}`,
    borderRadius: r.lg, padding: '14px 16px',
    cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: tokens.shadow.card,
  },
  kpiCardActive: { borderColor: c.primary, background: c.primarySoft },
  kpiLabel: {
    fontSize: 11, color: c.textMuted, margin: '0 0 5px',
    textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500,
  },
  kpiValue: { fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em', color: c.navy },
  kpiChange: { fontSize: 11, margin: 0 },
  chartCard: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: r.lg, padding: '18px 20px', boxShadow: tokens.shadow.card,
  },
  card: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: r.lg, padding: '18px 18px', boxShadow: tokens.shadow.card,
  },
  chartHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: 600, margin: 0, color: c.navy },
  cardSub: { fontSize: 11, color: c.textFaint, margin: '3px 0 0' },
  metricToggle: { display: 'flex', background: c.surfaceLow, borderRadius: r.sm, padding: 2, gap: 1 },
  metricBtn: {
    padding: '5px 10px', borderRadius: r.sm, border: 'none',
    background: 'transparent', cursor: 'pointer', fontSize: 11,
    color: c.textMuted, fontFamily: f, textTransform: 'capitalize',
    transition: 'background 0.15s',
  },
  metricBtnActive: { background: c.surface, color: c.navy, fontWeight: 500 },
  midRow: { display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16 },
  bottomRow: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16 },
  productList: { display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 },
  productRow: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  rank: { fontSize: 11, color: c.textFaint, fontWeight: 700, width: 20, flexShrink: 0, marginTop: 1 },
  productMeta: { display: 'flex', justifyContent: 'space-between', marginBottom: 5 },
  productName: { fontSize: 12, fontWeight: 500, color: c.navy },
  productRevenue: { fontSize: 12, fontWeight: 700, color: c.primary },
  barBg: { height: 4, background: c.surfaceLow, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  barFill: { height: '100%', background: c.primary, borderRadius: 2 },
  productStats: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  stat: { fontSize: 10, color: c.textFaint },
  funnel: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 },
  funnelStep: { display: 'flex', alignItems: 'center', gap: 8 },
  funnelLabelRow: { width: 140, flexShrink: 0, display: 'flex', justifyContent: 'space-between' },
  funnelLabel: { fontSize: 11, color: c.textMuted },
  funnelValue: { fontSize: 11, fontWeight: 600, color: c.navy },
  funnelBarBg: { flex: 1, height: 8, background: c.surfaceLow, borderRadius: 4, overflow: 'hidden' },
  funnelBarFill: { height: '100%', borderRadius: 4 },
  funnelPct: { fontSize: 11, color: c.textFaint, width: 36, textAlign: 'right', flexShrink: 0 },
  paymentList: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 },
  paymentRow: { display: 'flex', alignItems: 'center', gap: 0 },
  paymentMethod: { fontSize: 12, color: c.textMuted },
  payBarBg: { height: 6, background: c.surfaceLow, borderRadius: 3, overflow: 'hidden' },
  payBarFill: { height: '100%', borderRadius: 3 },
  paymentPct: { fontSize: 12, fontWeight: 600, color: c.navy, flexShrink: 0, width: 40, textAlign: 'right' },
  emptyHint: { fontSize: 12, color: c.textFaint, marginTop: 8, textAlign: 'center', padding: '12px 0' },
}
