import type { CSSProperties } from 'react'
import { tokens } from '@/lib/design/tokens'

const c = tokens.color
const r = tokens.radius
const f = tokens.font.sans

/** Design Studio page styles — "SaaS Commerce Modern" */
export const S: Record<string, CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, fontFamily: f, color: c.text },

  topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: c.navy },
  pageSub: { fontSize: 12, color: c.textFaint, margin: '3px 0 0' },
  topBarActions: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  unsavedBadge: {
    fontSize: 11, color: c.warning, background: c.warningSoft,
    padding: '4px 10px', borderRadius: r.sm, fontWeight: 500,
  },
  saveBtn: {
    padding: '9px 20px', borderRadius: r.md, border: 'none',
    background: c.primary, color: '#fff', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: f,
  },

  mainLayout: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16, alignItems: 'flex-start',
  },

  panelLabel: {
    fontSize: 11, fontWeight: 600, color: c.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px',
  },

  previewPanel: { display: 'flex', flexDirection: 'column', gap: 12 },
  previewHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  pageTabs: { display: 'flex', background: c.surfaceLow, borderRadius: r.md, padding: 3, gap: 2 },
  pageTab: {
    padding: '5px 10px', borderRadius: r.sm, border: 'none',
    background: 'transparent', cursor: 'pointer', fontSize: 11,
    color: c.textMuted, fontFamily: f, transition: 'background 0.15s',
  },
  pageTabActive: { background: c.surface, color: c.navy, fontWeight: 500 },
  previewFrame: { border: `1px solid ${c.border}`, borderRadius: r.lg, overflow: 'hidden', background: c.surface },
  previewInner: { overflow: 'hidden' },

  contrastSection: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: r.lg, padding: '14px 14px', boxShadow: tokens.shadow.card,
  },
  contrastGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  contrastCard: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
    background: c.surfaceLow, borderRadius: r.md, border: `1px solid ${c.border}`,
  },
  contrastSwatches: { display: 'flex', flexShrink: 0 },
  contrastSwatch: { width: 22, height: 22, borderRadius: r.sm, border: '1.5px solid #fff' },
  contrastLabel: { fontSize: 11, fontWeight: 500, color: c.textMuted, margin: 0, lineHeight: 1.3 },
  contrastRatio: { fontSize: 12, fontWeight: 700, color: c.navy, margin: '1px 0 0' },
  contrastBadge: { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, flexShrink: 0 },

  colorPanel: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: r.lg, padding: '16px', display: 'flex', flexDirection: 'column', gap: 16,
    boxShadow: tokens.shadow.card,
  },
  presetsSection: {},
  sectionMiniTitle: {
    fontSize: 10, fontWeight: 600, color: c.textFaint,
    textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px',
  },
  presetsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  presetBtn: {
    border: `1px solid ${c.border}`, borderRadius: r.md, padding: '8px 6px',
    background: c.surfaceLow, cursor: 'pointer', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: 5,
    transition: 'border-color 0.15s', fontFamily: f,
  },
  presetSwatches: { display: 'flex', gap: 2 },
  presetSwatch: { width: 14, height: 14, borderRadius: 3, border: '1px solid rgba(0,0,0,0.07)' },
  presetName: { fontSize: 9, color: c.textMuted, fontWeight: 500, textAlign: 'center', lineHeight: 1.2 },

  colorFields: { display: 'flex', flexDirection: 'column', gap: 14 },
  colorSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  colorRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  colorRowLeft: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  colorPickerWrap: { position: 'relative', flexShrink: 0 },
  colorSwatch: { width: 34, height: 34, borderRadius: r.md, border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer' },
  colorInput: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' },
  colorFieldLabel: { fontSize: 12, fontWeight: 500, margin: 0, color: c.navy },
  colorFieldDesc: { fontSize: 10, color: c.textFaint, margin: '1px 0 0' },
  hexInput: {
    width: 76, padding: '5px 8px', borderRadius: r.sm,
    border: `1px solid ${c.border}`, fontSize: 11, fontFamily: 'monospace',
    color: c.textMuted, background: c.surfaceLow, outline: 'none', textTransform: 'uppercase', flexShrink: 0,
    transition: 'border-color 0.15s',
  },

  aiPanel: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: r.lg, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', minHeight: 560, boxShadow: tokens.shadow.card,
  },
  aiPanelHeader: { padding: '14px 16px 10px', borderBottom: `1px solid ${c.border}`, flexShrink: 0 },
  aiSub: { fontSize: 11, color: c.primary, margin: '2px 0 0' },
  quickPrompts: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
    padding: '10px 12px', borderBottom: `1px solid ${c.border}`, flexShrink: 0,
  },
  quickPromptBtn: {
    padding: '5px 10px', borderRadius: r.sm, border: `1px solid ${c.border}`,
    background: c.surfaceLow, cursor: 'pointer', fontSize: 11, color: c.textMuted,
    fontFamily: f, transition: 'background 0.15s',
  },
  chatMessages: {
    flex: 1, overflowY: 'auto', padding: '12px',
    display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0,
  },
  chatEmpty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: '30px 20px', textAlign: 'center',
  },
  chatEmptyText: { fontSize: 12, color: c.textFaint, margin: 0, lineHeight: 1.5 },
  bubble: { padding: '9px 12px', borderRadius: r.md, maxWidth: '88%' },
  bubbleUser: { alignSelf: 'flex-end', background: c.navy, color: '#fff' },
  bubbleAI: { alignSelf: 'flex-start', background: c.surfaceLow, border: `1px solid ${c.border}` },
  aiTag: {
    fontSize: 9, fontWeight: 700, color: c.primary,
    textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px',
  },
  bubbleText: { fontSize: 12, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  chatInputWrap: {
    display: 'flex', gap: 8, padding: '10px 12px',
    borderTop: `1px solid ${c.border}`, flexShrink: 0, alignItems: 'flex-end',
  },
  chatInput: {
    flex: 1, padding: '8px 10px', borderRadius: r.md,
    border: `1.5px solid ${c.border}`, fontSize: 12, fontFamily: f,
    color: c.navy, outline: 'none', resize: 'none', background: c.surface,
    transition: 'border-color 0.15s',
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: r.md, border: 'none',
    background: c.primary, color: '#fff', cursor: 'pointer',
    fontSize: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.15s',
  },
  sendBtnDisabled: { background: c.border, cursor: 'not-allowed' },
  chatHint: { fontSize: 10, color: c.textFaint, margin: '0 0 8px', textAlign: 'center' },
}
