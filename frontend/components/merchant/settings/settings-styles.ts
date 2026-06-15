import type { CSSProperties } from 'react'
import { tokens } from '@/lib/design/tokens'

const c = tokens.color
const r = tokens.radius
const f = tokens.font.sans

// Settings page styles — "SaaS Commerce Modern" palette
// NOTE: exported as `S`, same as original, so no import updates needed.
export const S: Record<string, CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 0, fontFamily: f, color: c.text },
  layout: { display: 'flex', gap: 20, alignItems: 'flex-start' },

  nav: { width: 190, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 0 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px',
    borderRadius: r.md, border: 'none', background: 'transparent',
    cursor: 'pointer', fontSize: 13, color: c.textMuted,
    textAlign: 'start', transition: 'background 0.15s, color 0.15s', fontFamily: f,
  },
  navItemActive: { background: c.primarySoft, color: c.primary, fontWeight: 500 },
  navItemDanger: { color: c.danger, marginTop: 8 },
  navItemDangerActive: { background: c.dangerSoft },
  navIcon: { fontSize: 14, width: 16, textAlign: 'center', flexShrink: 0 },

  content: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 },

  sectionCard: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: r.lg, overflow: 'hidden', boxShadow: tokens.shadow.card },
  sectionCardHeader: { padding: '16px 20px 14px', borderBottom: `1px solid ${c.border}` },
  sectionCardTitle: { fontSize: 14, fontWeight: 700, margin: 0, color: c.navy },
  sectionCardSub: { fontSize: 12, color: c.textFaint, margin: '3px 0 0' },
  sectionCardBody: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 },

  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: c.textMuted },
  hint: { fontSize: 11, color: c.textFaint, margin: 0 },
  errorMsg: { fontSize: 11, color: c.danger, margin: 0 },
  input: {
    padding: '9px 12px', borderRadius: r.md, border: `1.5px solid ${c.border}`,
    fontSize: 13, background: c.surface, color: c.navy,
    outline: 'none', fontFamily: f, boxSizing: 'border-box', width: '100%',
    transition: 'border-color 0.15s',
  },
  textarea: {
    padding: '9px 12px', borderRadius: r.md, border: `1.5px solid ${c.border}`,
    fontSize: 13, background: c.surface, color: c.navy,
    outline: 'none', fontFamily: f, resize: 'vertical', width: '100%', boxSizing: 'border-box',
  },
  select: {
    padding: '9px 12px', borderRadius: r.md, border: `1.5px solid ${c.border}`,
    fontSize: 13, background: c.surface, color: c.navy,
    cursor: 'pointer', fontFamily: f, width: '100%',
  },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 },
  threeCol: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 },
  infoBox: {
    background: c.successSoft, border: `1px solid #a7f3d0`,
    borderRadius: r.md, padding: '10px 14px', fontSize: 12, color: c.success, lineHeight: 1.5,
  },

  logoRow: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  logoWrap: {
    width: 64, height: 64, borderRadius: r.md,
    border: `1px solid ${c.border}`, cursor: 'pointer',
    position: 'relative', overflow: 'hidden', flexShrink: 0,
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  logoPlaceholder: {
    width: '100%', height: '100%', background: c.primarySoft,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 700, color: c.primary,
  },
  logoOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, color: '#fff', transition: 'opacity 0.2s',
  },

  urlInput: { display: 'flex', alignItems: 'center', border: `1.5px solid ${c.border}`, borderRadius: r.md, overflow: 'hidden' },
  urlPrefix: { padding: '9px 10px', background: c.surfaceLow, fontSize: 12, color: c.textMuted, whiteSpace: 'nowrap', flexShrink: 0 },

  toggleRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '6px 0' },
  toggleLabel: { fontSize: 13, fontWeight: 500, margin: 0, color: c.navy },
  toggleSub: { fontSize: 11, color: c.textFaint, margin: '2px 0 0' },
  toggleBtn: {
    width: 40, height: 22, borderRadius: 11, border: 'none',
    cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0,
  },
  toggleBtnOn: { background: c.success },
  toggleBtnOff: { background: c.borderStrong },
  toggleThumb: {
    position: 'absolute', top: 3, left: 3, width: 16, height: 16,
    borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
  },
  toggleThumbOn: { left: 21 },

  gatewayList: { display: 'flex', flexDirection: 'column', gap: 10 },
  gatewayRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, padding: '12px 14px', borderRadius: r.lg,
    border: `1px solid ${c.border}`, background: c.surfaceLow, flexWrap: 'wrap',
    transition: 'border-color 0.15s',
  },
  gatewayRowActive: { background: c.primarySoft, borderColor: c.primary },
  gatewayLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  gatewayRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  gatewayName: { fontSize: 13, fontWeight: 600, margin: 0, color: c.navy },
  gatewaySub: { fontSize: 11, color: c.textFaint, margin: '2px 0 0' },
  feeLabel: { fontSize: 12, color: c.textMuted },

  radioGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  radioItem: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '10px 12px', borderRadius: r.md, border: `1px solid ${c.border}`, cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  radioLabel: { fontSize: 13, fontWeight: 500, margin: 0, color: c.navy },
  radioSub: { fontSize: 11, color: c.textFaint, margin: '2px 0 0' },

  pwFields: { display: 'flex', flexDirection: 'column', gap: 12 },

  sessionRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${c.border}` },
  sessionIcon: { fontSize: 20, flexShrink: 0 },
  sessionDevice: { fontSize: 13, fontWeight: 500, margin: 0, color: c.navy },
  sessionMeta: { fontSize: 11, color: c.textFaint, margin: '2px 0 0' },
  sessionCurrent: { fontSize: 11, fontWeight: 600, padding: '3px 8px', background: c.successSoft, color: c.success, borderRadius: r.sm },
  revokeBtn: {
    fontSize: 11, padding: '4px 10px', borderRadius: r.sm,
    border: `1px solid ${c.dangerSoft}`, background: c.dangerSoft,
    color: c.danger, cursor: 'pointer', fontFamily: f,
  },

  dangerZone: { border: `1px solid ${c.dangerSoft}`, borderRadius: r.lg, overflow: 'hidden', background: c.surface },
  dangerHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '14px 20px', borderBottom: `1px solid ${c.dangerSoft}`, background: c.dangerSoft,
  },
  dangerTitle: { fontSize: 14, fontWeight: 600, margin: 0, color: c.danger },
  dangerItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '16px 20px', borderBottom: `1px solid ${c.border}`, flexWrap: 'wrap',
  },
  dangerItemTitle: { fontSize: 13, fontWeight: 600, margin: '0 0 3px', color: c.navy },
  dangerItemDesc: { fontSize: 12, color: c.textMuted, margin: 0, maxWidth: 440, lineHeight: 1.5 },
  warnBtn: {
    padding: '8px 16px', borderRadius: r.md,
    border: `1px solid ${c.warningSoft}`, background: c.warningSoft,
    color: c.warning, cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', fontFamily: f,
  },
  deleteBtn: {
    padding: '8px 16px', borderRadius: r.md, border: 'none',
    background: c.danger, color: '#fff', cursor: 'pointer',
    fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', fontFamily: f,
  },
  deleteConfirmBox: {
    padding: '16px 20px', background: c.dangerSoft,
    borderTop: `1px solid ${c.dangerSoft}`, display: 'flex', flexDirection: 'column', gap: 10,
  },
  deleteConfirmText: { fontSize: 13, color: c.textMuted, margin: 0, lineHeight: 1.5 },

  saveBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
    padding: '14px 0 0', borderTop: `1px solid ${c.border}`, marginTop: 4, flexWrap: 'wrap',
  },
  savedMsg: { fontSize: 13, color: c.success, marginRight: 'auto', fontWeight: 500, flex: '1 1 auto' },
  cancelBtn: {
    padding: '9px 18px', borderRadius: r.md, border: `1px solid ${c.border}`,
    background: c.surfaceLow, cursor: 'pointer', fontSize: 13, color: c.textMuted, fontFamily: f,
  },
  saveBtn: {
    padding: '9px 22px', borderRadius: r.md, border: 'none',
    background: c.primary, color: '#fff', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: f,
  },
}
