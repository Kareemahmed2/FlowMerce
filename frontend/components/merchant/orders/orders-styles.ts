import type { CSSProperties } from 'react'
import { tokens } from '@/lib/design/tokens'

/*
  Orders page styles — retuned to "SaaS Commerce Modern" tokens.
  Same structural API as before; only colour/typography values changed.
*/
const c = tokens.color
const r = tokens.radius
const f = tokens.font.sans

export const O: Record<string, CSSProperties> = {
  page: {
    display: 'flex', flexDirection: 'column', gap: 16,
    fontFamily: f, color: c.text, position: 'relative',
  },

  summaryStrip: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 },
  summaryCard: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: r.lg, padding: '14px 16px',
    boxShadow: tokens.shadow.card,
  },
  summaryLabel: {
    fontSize: 11, color: c.textMuted, margin: '0 0 6px',
    textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500,
  },
  summaryValue: { fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: c.navy },
  summaryUnit: { fontSize: 12, fontWeight: 400, color: c.textFaint },

  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  filterTabs: { display: 'flex', gap: 2, background: c.surfaceLow, borderRadius: r.md, padding: 3 },
  filterTab: {
    padding: '6px 12px', borderRadius: r.sm, border: 'none',
    background: 'transparent', cursor: 'pointer', fontSize: 12,
    color: c.textMuted, display: 'flex', alignItems: 'center', gap: 6,
    transition: 'background 0.15s, color 0.15s', fontFamily: f,
  },
  filterTabActive: { background: c.surface, color: c.navy, fontWeight: 500 },
  filterCount: {
    fontSize: 10, fontWeight: 600, padding: '1px 5px',
    background: c.border, color: c.textMuted, borderRadius: 4,
  },
  filterCountActive: { background: c.primary, color: '#fff' },
  searchInput: {
    padding: '8px 14px', borderRadius: r.md, border: `1.5px solid ${c.border}`,
    fontSize: 13, background: c.surface, color: c.navy, outline: 'none',
    width: 260, fontFamily: f, transition: 'border-color 0.15s',
  },

  tableWrap: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: r.lg, overflow: 'hidden', boxShadow: tokens.shadow.card,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: c.surfaceLow },
  th: {
    fontSize: 11, color: c.textMuted, fontWeight: 600, textAlign: 'start',
    padding: '11px 14px', textTransform: 'uppercase', letterSpacing: '0.05em',
    whiteSpace: 'nowrap', userSelect: 'none', borderBottom: `1px solid ${c.border}`,
  },
  sortIcon: { fontSize: 11, color: c.textFaint, marginLeft: 2 },
  tr: { cursor: 'pointer', transition: 'background 0.1s' },
  trAlt: { background: c.surfaceLow },
  td: { fontSize: 13, padding: '12px 14px', verticalAlign: 'middle', borderBottom: `1px solid ${c.border}` },
  orderId: { fontFamily: 'monospace', fontSize: 12, color: c.textMuted, fontWeight: 500 },
  emptyRow: { textAlign: 'center', padding: '40px', color: c.textFaint, fontSize: 13 },

  customerCell: { display: 'flex', alignItems: 'center', gap: 8 },
  miniAvatar: {
    width: 28, height: 28, borderRadius: r.sm,
    background: c.primarySoft, color: c.primary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 700, flexShrink: 0,
  },
  customerName: { fontSize: 13, fontWeight: 500, margin: 0, color: c.navy },
  customerEmail: { fontSize: 11, color: c.textFaint, margin: 0 },

  statusPill: {
    fontSize: 11, fontWeight: 500, padding: '4px 9px', borderRadius: r.sm,
    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5,
  },

  rowActions: { display: 'flex', gap: 4 },
  rowBtn: {
    width: 28, height: 28, borderRadius: r.sm, border: `1px solid ${c.border}`,
    background: c.surfaceLow, cursor: 'pointer', fontSize: 13, color: c.textMuted,
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s',
  },

  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' },
  paginationInfo: { fontSize: 12, color: c.textMuted },
  paginationBtns: { display: 'flex', gap: 4 },
  pageBtn: {
    width: 30, height: 30, borderRadius: r.sm, border: `1px solid ${c.border}`,
    background: c.surface, cursor: 'pointer', fontSize: 12, color: c.textMuted, fontFamily: f,
  },
  pageBtnActive: { background: c.primary, color: '#fff', border: 'none' },

  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,20,40,0.4)', zIndex: 40 },
  drawer: {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
    background: c.surface, zIndex: 50, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 0,
    boxShadow: '-8px 0 32px rgba(30,41,59,0.12)',
  },
  drawerHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 20px 16px', borderBottom: `1px solid ${c.border}`,
  },
  drawerOrderId: { fontSize: 16, fontWeight: 700, margin: 0, fontFamily: 'monospace', color: c.navy },
  drawerDate: { fontSize: 12, color: c.textFaint, margin: '3px 0 0' },
  closeBtn: {
    width: 28, height: 28, borderRadius: r.sm, border: `1px solid ${c.border}`,
    background: c.surfaceLow, cursor: 'pointer', fontSize: 18, color: c.textMuted,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  drawerStatusBanner: {
    margin: '0 20px 0', borderRadius: r.md, padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 10, marginTop: 16,
  },
  drawerStatusLabel: { fontSize: 10, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' },
  drawerStatusValue: { fontSize: 14, fontWeight: 700, margin: '2px 0 0' },
  markBtn: {
    marginLeft: 'auto', padding: '6px 12px', borderRadius: r.sm, border: 'none',
    cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: f,
  },
  drawerSection: { padding: '16px 20px', borderBottom: `1px solid ${c.border}` },
  drawerSectionTitle: {
    fontSize: 11, fontWeight: 600, color: c.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px',
  },
  drawerRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  customerAvatar: {
    width: 38, height: 38, borderRadius: r.md,
    background: c.primarySoft, color: c.primary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  drawerCustomerName: { fontSize: 14, fontWeight: 600, margin: 0, color: c.navy },
  drawerCustomerEmail: { fontSize: 12, color: c.textMuted, margin: '2px 0 0' },
  drawerAddress: { fontSize: 12, color: c.textMuted, margin: 0 },
  drawerItemCard: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px',
    border: `1px solid ${c.border}`, borderRadius: r.md, background: c.surfaceLow,
  },
  drawerItemThumb: { width: 44, height: 44, borderRadius: r.sm, background: c.border, flexShrink: 0 },
  drawerItemName: { fontSize: 13, fontWeight: 500, margin: 0, color: c.navy },
  drawerItemMeta: { fontSize: 11, color: c.textMuted, margin: '3px 0 0' },
  drawerItemPrice: { fontSize: 14, fontWeight: 700, color: c.primary, margin: 0, whiteSpace: 'nowrap' },
  drawerPaymentRows: { display: 'flex', flexDirection: 'column', gap: 8 },
  drawerPayRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  drawerPayKey: { fontSize: 13, color: c.textMuted },
  drawerPayVal: { fontSize: 13, color: c.navy, fontWeight: 500 },
  drawerActions: {
    padding: '16px 20px', display: 'flex', gap: 10,
    borderTop: `1px solid ${c.border}`, marginTop: 'auto',
  },
  actionBtnSecondary: {
    flex: 1, padding: '9px', borderRadius: r.md,
    border: `1px solid ${c.border}`, background: c.surfaceLow,
    cursor: 'pointer', fontSize: 12, color: c.textMuted, fontFamily: f,
  },
  actionBtnDanger: {
    flex: 1, padding: '9px', borderRadius: r.md,
    border: `1px solid ${c.dangerSoft}`, background: c.dangerSoft,
    cursor: 'pointer', fontSize: 12, color: c.danger, fontFamily: f,
  },
}
