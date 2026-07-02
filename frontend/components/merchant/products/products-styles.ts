import type { CSSProperties } from 'react'
import { tokens } from '@/lib/design/tokens'

const c = tokens.color
const r = tokens.radius
const f = tokens.font.sans

export const P: Record<string, CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, fontFamily: f, color: c.text, position: 'relative' },

  statsStrip: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
  statCard: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: r.lg, padding: '14px 16px', boxShadow: tokens.shadow.card,
  },
  statLabel: {
    fontSize: 11, color: c.textMuted, margin: '0 0 4px',
    textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500,
  },
  statValue: { fontSize: 22, fontWeight: 700, margin: '0 0 2px', letterSpacing: '-0.02em', color: c.navy },
  statSub: { fontSize: 11, color: c.textFaint, margin: 0 },

  body: { display: 'flex', gap: 16, alignItems: 'flex-start' },

  catSidebar: {
    width: 190, flexShrink: 0, background: c.surface,
    border: `1px solid ${c.border}`, borderRadius: r.lg,
    padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 4,
    position: 'sticky', top: 0, boxShadow: tokens.shadow.card,
  },
  catSidebarHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 4px 8px', borderBottom: `1px solid ${c.border}`, marginBottom: 4,
  },
  sidebarTitle: {
    fontSize: 11, fontWeight: 600, color: c.textMuted, margin: 0,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  addCatIconBtn: {
    width: 22, height: 22, borderRadius: r.sm,
    border: `1px solid ${c.border}`, background: c.surfaceLow,
    cursor: 'pointer', fontSize: 15, color: c.textMuted,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  addCatRow: { display: 'flex', gap: 4, padding: '0 0 6px' },
  addCatConfirmBtn: {
    width: 30, height: 30, borderRadius: r.sm, border: 'none',
    background: c.primary, color: '#fff', cursor: 'pointer', fontSize: 12, flexShrink: 0,
  },
  catList: { display: 'flex', flexDirection: 'column', gap: 2 },
  catItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 8px', borderRadius: r.md, border: 'none',
    background: 'transparent', cursor: 'pointer', width: '100%',
    textAlign: 'start', fontSize: 13, color: c.textMuted, transition: 'background 0.15s', fontFamily: f,
  },
  catItemActive: { background: c.primarySoft, color: c.primary, fontWeight: 500 },
  catItemName: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  catBadge: {
    fontSize: 10, fontWeight: 600, padding: '1px 6px',
    background: c.surfaceLow, color: c.textMuted, borderRadius: 4, flexShrink: 0,
  },

  mainContent: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  searchInput: {
    flex: 1, minWidth: 160, padding: '8px 14px', borderRadius: r.md,
    border: `1.5px solid ${c.border}`, fontSize: 13,
    background: c.surface, color: c.navy, outline: 'none', fontFamily: f,
    transition: 'border-color 0.15s',
  },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: 8 },
  select: {
    padding: '8px 10px', borderRadius: r.md, border: `1.5px solid ${c.border}`,
    fontSize: 12, background: c.surface, color: c.textMuted, cursor: 'pointer', fontFamily: f,
  },
  viewToggle: { display: 'flex', border: `1px solid ${c.border}`, borderRadius: r.md, overflow: 'hidden' },
  viewBtn: { padding: '7px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: c.textMuted, fontFamily: f },
  viewBtnActive: { background: c.primary, color: '#fff' },
  addBtn: {
    padding: '8px 16px', borderRadius: r.md, border: 'none',
    background: c.primary, color: '#fff', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: f,
  },
  resultCount: { fontSize: 12, color: c.textMuted, margin: 0 },

  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 },
  productCard: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: r.lg, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: tokens.shadow.card,
  },
  productImgWrap: { position: 'relative', height: 140, background: c.surfaceLow, flexShrink: 0 },
  productImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  productImgPlaceholder: {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 28, color: c.textFaint,
  },
  statusDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: '50%', border: '1.5px solid #fff',
  },
  productInfo: { padding: '12px 12px 6px', flex: 1 },
  productName: { fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: c.navy, lineHeight: 1.3 },
  productCat: { fontSize: 11, color: c.textMuted, margin: '0 0 8px' },
  productPriceRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  productPrice: { fontSize: 14, fontWeight: 700, color: c.primary },
  productSales: { fontSize: 11, color: c.textMuted, margin: 0 },
  stockTag: { fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4 },
  stockTagOk: { background: c.successSoft, color: c.success },
  stockTagLow: { background: c.warningSoft, color: c.warning },
  stockTagOut: { background: c.dangerSoft, color: c.danger },
  productCardActions: { display: 'flex', borderTop: `1px solid ${c.border}`, padding: '6px 6px' },
  cardActionBtn: {
    flex: 1, padding: '6px 4px', border: 'none', background: 'transparent',
    cursor: 'pointer', fontSize: 11, color: c.textMuted, borderRadius: r.sm,
    transition: 'background 0.15s', fontFamily: f,
  },

  listWrap: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: r.lg, overflow: 'hidden', boxShadow: tokens.shadow.card,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: c.surfaceLow },
  th: {
    fontSize: 11, color: c.textMuted, fontWeight: 600, textAlign: 'start',
    padding: '10px 14px', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap',
  },
  tr: { cursor: 'default' },
  trAlt: { background: c.surfaceLow },
  td: { fontSize: 12, padding: '11px 14px', verticalAlign: 'middle', borderBottom: `1px solid ${c.border}` },
  listProductCell: { display: 'flex', alignItems: 'center', gap: 10 },
  listThumb: {
    width: 36, height: 36, borderRadius: r.sm, background: c.surfaceLow,
    flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  listProductName: { fontSize: 13, fontWeight: 500, margin: 0, color: c.navy },
  listProductDesc: { fontSize: 11, color: c.textFaint, margin: '2px 0 0' },
  listStatusPill: { fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: r.sm },
  listStatusActive: { background: c.successSoft, color: c.success },
  listStatusInactive: { background: c.surfaceLow, color: c.textMuted },
  listActions: { display: 'flex', gap: 4 },
  listActionBtn: {
    padding: '4px 8px', borderRadius: r.sm, border: `1px solid ${c.border}`,
    background: c.surfaceLow, cursor: 'pointer', fontSize: 11, color: c.textMuted, fontFamily: f,
  },

  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 0' },
  emptyTitle: { fontSize: 15, fontWeight: 500, color: c.textMuted, margin: 0 },
  emptySub: { fontSize: 12, color: c.textFaint, margin: 0 },

  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,20,40,0.4)', zIndex: 40 },
  closeBtn: {
    width: 28, height: 28, borderRadius: r.sm, border: `1px solid ${c.border}`,
    background: c.surfaceLow, cursor: 'pointer', fontSize: 18, color: c.textMuted,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  modal: {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: 520, maxWidth: '94vw', maxHeight: '90vh',
    background: c.surface, borderRadius: r.xl, zIndex: 50,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: tokens.shadow.pop,
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px 14px', borderBottom: `1px solid ${c.border}`, flexShrink: 0,
  },
  modalTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: c.navy },
  modalBody: { overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '14px 20px', borderTop: `1px solid ${c.border}`, flexShrink: 0,
  },

  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldRow: { display: 'flex', gap: 12 },
  label: { fontSize: 12, fontWeight: 600, color: c.textMuted },
  req: { color: c.danger },
  input: {
    padding: '9px 12px', borderRadius: r.md, border: `1.5px solid ${c.border}`,
    fontSize: 13, background: c.surface, color: c.navy,
    outline: 'none', fontFamily: f, boxSizing: 'border-box', width: '100%',
    transition: 'border-color 0.15s',
  },
  inputError: { borderColor: c.danger },
  errorMsg: { fontSize: 11, color: c.danger, margin: 0 },
  textarea: {
    padding: '9px 12px', borderRadius: r.md, border: `1.5px solid ${c.border}`,
    fontSize: 13, background: c.surface, color: c.navy,
    outline: 'none', fontFamily: f, resize: 'vertical', width: '100%', boxSizing: 'border-box',
  },
  catChips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  catChip: {
    padding: '5px 12px', borderRadius: r.sm, border: `1px solid ${c.border}`,
    background: c.surfaceLow, cursor: 'pointer', fontSize: 12, color: c.textMuted, fontFamily: f,
  },
  catChipActive: { background: c.primary, color: '#fff', border: `1px solid ${c.primary}` },
  imagesRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  imgWrap: { position: 'relative' },
  imgThumb: { width: 60, height: 60, objectFit: 'cover', borderRadius: r.md, border: `1px solid ${c.border}`, display: 'block' },
  imgRemove: {
    position: 'absolute', top: -6, right: -6, width: 18, height: 18,
    borderRadius: '50%', background: c.danger, color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 11,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  addImgBtn: {
    width: 60, height: 60, borderRadius: r.md, border: `2px dashed ${c.borderStrong}`,
    background: c.surfaceLow, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  addImgLabel: { fontSize: 10, color: c.textMuted },
  statusToggle: { display: 'flex', border: `1px solid ${c.border}`, borderRadius: r.md, overflow: 'hidden', width: 'fit-content' },
  statusBtn: { padding: '7px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: c.textMuted, fontFamily: f },
  statusBtnActive: { background: c.primary, color: '#fff' },
  cancelBtn: {
    padding: '9px 18px', borderRadius: r.md, border: `1px solid ${c.border}`,
    background: c.surfaceLow, cursor: 'pointer', fontSize: 13, color: c.textMuted, fontFamily: f,
  },
  saveBtn: {
    padding: '9px 20px', borderRadius: r.md, border: 'none',
    background: c.primary, color: '#fff', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: f,
  },
  deleteBtn: {
    padding: '9px 20px', borderRadius: r.md, border: 'none',
    background: c.danger, color: '#fff', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: f,
  },

  confirmModal: {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: 360, background: c.surface, borderRadius: r.lg, zIndex: 50,
    padding: '24px 24px 20px', boxShadow: tokens.shadow.pop,
  },
  confirmTitle: { fontSize: 16, fontWeight: 700, margin: '0 0 10px', color: c.navy },
  confirmDesc: { fontSize: 13, color: c.textMuted, margin: '0 0 20px', lineHeight: 1.5 },
  confirmActions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
}
