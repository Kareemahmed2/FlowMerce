'use client'

/**
 * Storefront visual builder.
 *
 * 3-pane layout:
 *   ┌────────┬──────────────────────────────────────┬──────────────────────┐
 *   │ Palette│ Canvas (drag-to-reorder components)  │ Inspector (selected) │
 *   └────────┴──────────────────────────────────────┴──────────────────────┘
 *
 * Backend endpoints (per storefront.service.ts):
 *   - listComponents / addComponent / updateComponent / deleteComponent / reorderComponents
 *   - getPage / updatePage (page-level metadata: title, slug, isPublished, showInNav)
 *   - addDecorator / updateDecorator / deleteDecorator
 *
 * Drag-and-drop: uses native HTML5 drag-and-drop API (no extra dependency).
 * Reorder is committed to the backend after each drop via reorderComponents.
 *
 * Component `content` is stored as a free-form string. We treat it as JSON so
 * the inspector can edit key/value pairs cleanly.
 */

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMerchantAuth } from '@/store/auth-store'
import { storefrontService } from '@/services/storefront.service'
import type {
  ComponentResponse,
  DecoratorResponse,
  PageResponse,
} from '@/types/storefront.types'
import { COMPONENT_PALETTE } from '@/types/storefront.types'
import { AiChatPanel } from './AiChatPanel'
import type { AiStoreContext } from './AiChatPanel'

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: { display: 'grid', gridTemplateColumns: '240px 1fr 320px', gap: 0, height: 'calc(100vh - 120px)', minHeight: 480 } as const,
  pane: { background: '#fff', overflowY: 'auto' as const, padding: 18, borderRight: '1px solid #ede8df' } as const,
  paneTitle: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#888', margin: '0 0 14px' },
  paletteItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#faf8f5', borderRadius: 10, marginBottom: 8, cursor: 'grab', border: '1px solid transparent', userSelect: 'none' as const, transition: 'all 0.12s' },
  paletteItemIcon: { fontSize: 16, width: 24, textAlign: 'center' as const, color: '#0F0E0C' } as const,
  paletteItemLabel: { fontSize: 13, fontWeight: 500 } as const,
  canvas: { background: '#f6f4ef', overflowY: 'auto' as const, padding: 28, borderRight: '1px solid #ede8df' } as const,
  canvasInner: { maxWidth: 720, margin: '0 auto' } as const,
  pageHeader: { background: '#fff', borderRadius: 12, padding: '18px 22px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const, border: '1px solid #ede8df' } as const,
  componentRow: { background: '#fff', borderRadius: 10, padding: '14px 16px', marginBottom: 10, border: '1px solid #ede8df', cursor: 'pointer', transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 12 } as const,
  componentRowActive: { border: '2px solid #0F0E0C', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } as const,
  componentRowDragging: { opacity: 0.4 } as const,
  componentRowDropTarget: { borderTop: '2px solid #0F0E0C' } as const,
  dragHandle: { fontSize: 14, color: '#aaa', cursor: 'grab', userSelect: 'none' as const, padding: '0 4px' } as const,
  componentIcon: { fontSize: 16, width: 28, textAlign: 'center' as const } as const,
  componentName: { fontSize: 14, fontWeight: 600, margin: 0 } as const,
  componentMeta: { fontSize: 11, color: '#888', margin: '2px 0 0' } as const,
  inspectorInput: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e3d8', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 10 },
  inspectorLabel: { display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.04em' } as const,
  primaryBtn: { background: '#0F0E0C', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const,
  ghostBtn: { background: 'none', color: '#0F0E0C', border: '1px solid #e8e3d8', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const,
  dangerBtn: { background: '#FCEBEB', color: '#A32D2D', border: '1px solid #f7c1c1', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const,
  visibilityToggle: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' } as const,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function paletteEntry(componentType: string): { type: string; label: string; icon: string; defaultContent: string } {
  return (
    COMPONENT_PALETTE.find((p) => p.type === componentType) ?? {
      type: componentType,
      label: componentType,
      icon: '◻',
      defaultContent: '{}',
    }
  )
}

function tryParseJson(s: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(s)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

// ── Inspector — content editor ───────────────────────────────────────────────

function ContentInspector({
  component,
  onChange,
}: {
  component: ComponentResponse
  onChange: (next: ComponentResponse) => void
}) {
  const initialJson = tryParseJson(component.content) ?? {}
  const [fields, setFields] = useState<Record<string, unknown>>(initialJson)
  const [rawMode, setRawMode] = useState(false)
  const [rawValue, setRawValue] = useState(component.content)

  // Re-sync when selected component changes externally
  useEffect(() => {
    setFields(tryParseJson(component.content) ?? {})
    setRawValue(component.content)
  }, [component.componentId, component.content])

  const commit = useCallback((next: Record<string, unknown>) => {
    setFields(next)
    onChange({ ...component, content: JSON.stringify(next) })
  }, [component, onChange])

  const keys = Object.keys(fields)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={S.inspectorLabel}>Content</span>
        <button
          type="button"
          onClick={() => setRawMode((v) => !v)}
          style={{ ...S.ghostBtn, fontSize: 11, padding: '4px 10px' }}
        >
          {rawMode ? 'Form' : 'Raw JSON'}
        </button>
      </div>

      {rawMode ? (
        <>
          <textarea
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value)}
            onBlur={() => {
              const parsed = tryParseJson(rawValue)
              if (parsed) {
                commit(parsed)
              } else {
                // Keep the raw string as-is for free-form content
                onChange({ ...component, content: rawValue })
              }
            }}
            rows={10}
            style={{ ...S.inspectorInput, fontFamily: 'ui-monospace, monospace', minHeight: 220 }}
          />
          <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
            Raw value sent to the backend.
          </p>
        </>
      ) : (
        <>
          {keys.length === 0 ? (
            <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 10px' }}>
              No fields yet. Switch to Raw JSON to add some.
            </p>
          ) : (
            keys.map((key) => {
              const value = fields[key]
              return (
                <div key={key} style={{ marginBottom: 10 }}>
                  <label style={S.inspectorLabel}>{key}</label>
                  {typeof value === 'boolean' ? (
                    <label style={S.visibilityToggle}>
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => commit({ ...fields, [key]: e.target.checked })}
                      />
                      {value ? 'On' : 'Off'}
                    </label>
                  ) : typeof value === 'number' ? (
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => commit({ ...fields, [key]: Number(e.target.value) })}
                      style={S.inspectorInput}
                    />
                  ) : (
                    <input
                      type="text"
                      value={typeof value === 'string' ? value : JSON.stringify(value)}
                      onChange={(e) => commit({ ...fields, [key]: e.target.value })}
                      style={S.inspectorInput}
                    />
                  )}
                </div>
              )
            })
          )}
        </>
      )}
    </div>
  )
}

// ── Decorators sub-panel ─────────────────────────────────────────────────────

function DecoratorsPanel({
  storeId,
  component,
  onChanged,
}: {
  storeId: number
  component: ComponentResponse
  onChanged: () => void
}) {
  const auth = useMerchantAuth()
  const [decorators, setDecorators] = useState<DecoratorResponse[]>(component.decorators ?? [])
  const [adding, setAdding] = useState(false)
  const [newData, setNewData] = useState('')
  const [newPriority, setNewPriority] = useState('0')

  useEffect(() => {
    setDecorators(component.decorators ?? [])
  }, [component.componentId, component.decorators])

  const refresh = async () => {
    const r = await storefrontService.listDecorators(storeId, component.componentId, auth.getAuthHeader())
    if (r.ok) {
      setDecorators(r.data)
      onChanged()
    }
  }

  const handleAdd = async () => {
    if (!newData.trim()) return
    const r = await storefrontService.addDecorator(
      storeId,
      component.componentId,
      { data: newData.trim(), priority: Number(newPriority) || 0 },
      auth.getAuthHeader()
    )
    if (r.ok) {
      setNewData('')
      setNewPriority('0')
      setAdding(false)
      await refresh()
    }
  }

  const handleDelete = async (decoratorId: number) => {
    const r = await storefrontService.deleteDecorator(
      storeId,
      component.componentId,
      decoratorId,
      auth.getAuthHeader()
    )
    if (r.ok) await refresh()
  }

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #ede8df' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={S.inspectorLabel}>Decorators</span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          style={{ ...S.ghostBtn, fontSize: 11, padding: '4px 10px' }}
        >
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {adding && (
        <div style={{ background: '#faf8f5', padding: 10, borderRadius: 8, marginBottom: 10 }}>
          <input
            type="number"
            placeholder="Priority"
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            style={{ ...S.inspectorInput, marginBottom: 6 }}
          />
          <textarea
            placeholder='Data (e.g. {"badge":"NEW"})'
            value={newData}
            onChange={(e) => setNewData(e.target.value)}
            rows={3}
            style={{ ...S.inspectorInput, fontFamily: 'ui-monospace, monospace', marginBottom: 6 }}
          />
          <button type="button" style={S.primaryBtn} onClick={handleAdd}>Save</button>
        </div>
      )}

      {decorators.length === 0 ? (
        <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>No decorators yet.</p>
      ) : (
        decorators.map((d) => (
          <div key={d.decoratorId} style={{ background: '#faf8f5', padding: 8, borderRadius: 8, marginBottom: 6, fontSize: 11, fontFamily: 'ui-monospace, monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{ margin: '0 0 2px', color: '#888' }}>P{d.priority}</p>
              <p style={{ margin: 0, color: '#0F0E0C', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{d.data}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(d.decoratorId)}
              style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontSize: 14, padding: 0 }}
              title="Delete decorator"
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  )
}

// ── Builder ──────────────────────────────────────────────────────────────────

export function StorefrontBuilder({ pageId }: { pageId: number }) {
  const auth = useMerchantAuth()
  const storeId = auth.storeId

  const [page, setPage] = useState<PageResponse | null>(null)
  const [components, setComponents] = useState<ComponentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [savingMeta, setSavingMeta] = useState(false)
  const [savingInspector, setSavingInspector] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const selected = useMemo(
    () => components.find((c) => c.componentId === selectedId) ?? null,
    [components, selectedId]
  )

  // Debounced save for content changes
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (storeId === null) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const result = await storefrontService.getPage(storeId, pageId, auth.getAuthHeader())
    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }
    setPage(result.data)
    setComponents(result.data.components.slice().sort((a, b) => a.sortOrder - b.sortOrder))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, pageId])

  useEffect(() => { void load() }, [load])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const handleAddFromPalette = async (componentType: string) => {
    if (storeId === null) return
    const entry = paletteEntry(componentType)
    const r = await storefrontService.addComponent(
      storeId,
      pageId,
      {
        componentType,
        name: entry.label,
        content: entry.defaultContent,
        isVisible: true,
        sortOrder: components.length,
      },
      auth.getAuthHeader()
    )
    if (!r.ok) {
      showToast(r.error)
      return
    }
    setComponents((prev) => [...prev, r.data])
    setSelectedId(r.data.componentId)
    showToast(`✓ Added ${entry.label}`)
  }

  const handleDeleteComponent = async (componentId: number) => {
    if (storeId === null) return
    if (!confirm('Delete this component?')) return
    const r = await storefrontService.deleteComponent(storeId, pageId, componentId, auth.getAuthHeader())
    if (!r.ok) {
      showToast(r.error)
      return
    }
    setComponents((prev) => prev.filter((c) => c.componentId !== componentId))
    if (selectedId === componentId) setSelectedId(null)
  }

  const handleToggleVisible = async (component: ComponentResponse) => {
    if (storeId === null) return
    const r = await storefrontService.updateComponent(
      storeId,
      pageId,
      component.componentId,
      { isVisible: !component.isVisible },
      auth.getAuthHeader()
    )
    if (!r.ok) {
      showToast(r.error)
      return
    }
    setComponents((prev) => prev.map((c) => (c.componentId === r.data.componentId ? r.data : c)))
  }

  const handleInspectorChange = (next: ComponentResponse) => {
    // Optimistic local update
    setComponents((prev) => prev.map((c) => (c.componentId === next.componentId ? next : c)))

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (storeId === null) return
      setSavingInspector(true)
      const r = await storefrontService.updateComponent(
        storeId,
        pageId,
        next.componentId,
        { name: next.name, content: next.content, isVisible: next.isVisible },
        auth.getAuthHeader()
      )
      setSavingInspector(false)
      if (!r.ok) showToast(r.error)
    }, 500)
  }

  // Page metadata save (title, slug, isPublished, showInNav)
  const handlePageMetaSave = async (patch: Partial<PageResponse>) => {
    if (storeId === null || !page) return
    setSavingMeta(true)
    const r = await storefrontService.updatePage(
      storeId,
      pageId,
      {
        title:           patch.title           ?? page.title,
        slug:            patch.slug            ?? page.slug,
        pageType:        patch.pageType        ?? page.pageType,
        isPublished:     patch.isPublished     ?? page.isPublished,
        showInNav:       patch.showInNav       ?? page.showInNav,
        navOrder:        patch.navOrder        ?? page.navOrder,
        metaDescription: patch.metaDescription ?? page.metaDescription ?? undefined,
      },
      auth.getAuthHeader()
    )
    setSavingMeta(false)
    if (!r.ok) {
      showToast(r.error)
      return
    }
    setPage(r.data)
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  const onDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggingIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Required for Firefox to fire drag events
    e.dataTransfer.setData('text/plain', String(index))
  }

  const onDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dropTargetIndex !== index) setDropTargetIndex(index)
  }

  const onDragEnd = () => {
    setDraggingIndex(null)
    setDropTargetIndex(null)
  }

  const onDrop = (targetIndex: number) => async (e: React.DragEvent) => {
    e.preventDefault()
    if (draggingIndex === null || draggingIndex === targetIndex || storeId === null) {
      onDragEnd()
      return
    }
    // Reorder in local state
    const next = components.slice()
    const [moved] = next.splice(draggingIndex, 1)
    next.splice(targetIndex, 0, moved)
    const renumbered = next.map((c, i) => ({ ...c, sortOrder: i }))
    setComponents(renumbered)
    onDragEnd()

    // Commit to backend
    const r = await storefrontService.reorderComponents(
      storeId,
      pageId,
      renumbered.map((c) => ({ componentId: c.componentId, sortOrder: c.sortOrder })),
      auth.getAuthHeader()
    )
    if (!r.ok) {
      showToast(r.error)
      await load() // re-load to recover from server state
    }
  }

  // ── Render guards ──────────────────────────────────────────────────────────

  if (storeId === null) {
    return <p style={{ padding: 40, color: '#888' }}>No store selected.</p>
  }
  if (loading) {
    return <p style={{ padding: 40, color: '#888' }}>Loading builder…</p>
  }
  if (error || !page) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: '#A32D2D', fontWeight: 600 }}>Couldn’t load page: {error}</p>
        <Link href="/dashboard/design" style={{ color: '#0F0E0C', textDecoration: 'underline', fontSize: 13 }}>
          ← Back to pages
        </Link>
      </div>
    )
  }

  return (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 300, background: '#0F0E0C', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Top page header */}
      <div style={S.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/dashboard/design" style={{ color: '#0F0E0C', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            ←
          </Link>
          <div>
            <input
              type="text"
              value={page.title}
              onChange={(e) => setPage({ ...page, title: e.target.value })}
              onBlur={(e) => handlePageMetaSave({ title: e.target.value })}
              style={{ fontSize: 18, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', padding: 0, color: '#0F0E0C', width: 300 }}
            />
            <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0', fontFamily: 'ui-monospace, monospace' }}>
              /{page.slug} · {page.pageType}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={page.showInNav}
              onChange={(e) => handlePageMetaSave({ showInNav: e.target.checked })}
            />
            Show in nav
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={page.isPublished}
              onChange={(e) => handlePageMetaSave({ isPublished: e.target.checked })}
            />
            Published
          </label>
          {savingMeta && <span style={{ fontSize: 11, color: '#aaa' }}>Saving…</span>}
        </div>
      </div>

      {/* Three-pane builder */}
      <div style={S.page}>
        {/* Palette */}
        <aside style={S.pane}>
          <p style={S.paneTitle}>Components</p>
          {COMPONENT_PALETTE.map((entry) => (
            <button
              key={entry.type}
              type="button"
              style={S.paletteItem}
              onClick={() => void handleAddFromPalette(entry.type)}
              title={`Add ${entry.label}`}
            >
              <span style={S.paletteItemIcon}>{entry.icon}</span>
              <span style={S.paletteItemLabel}>{entry.label}</span>
            </button>
          ))}
        </aside>

        {/* Canvas */}
        <section style={S.canvas}>
          <div style={S.canvasInner}>
            {components.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#888' }}>
                <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Empty canvas</p>
                <p style={{ fontSize: 13, margin: 0 }}>Click a component on the left to add it here.</p>
              </div>
            ) : (
              components.map((c, i) => {
                const entry = paletteEntry(c.componentType)
                const isSelected = selectedId === c.componentId
                const isDragging = draggingIndex === i
                const isDropTarget = dropTargetIndex === i && draggingIndex !== i

                return (
                  <div
                    key={c.componentId}
                    draggable
                    onDragStart={onDragStart(i)}
                    onDragOver={onDragOver(i)}
                    onDragEnd={onDragEnd}
                    onDrop={onDrop(i)}
                    onClick={() => setSelectedId(c.componentId)}
                    style={{
                      ...S.componentRow,
                      ...(isSelected ? S.componentRowActive : {}),
                      ...(isDragging ? S.componentRowDragging : {}),
                      ...(isDropTarget ? S.componentRowDropTarget : {}),
                      ...(c.isVisible ? {} : { opacity: 0.55 }),
                    }}
                  >
                    <span style={S.dragHandle} title="Drag to reorder">⋮⋮</span>
                    <span style={S.componentIcon}>{entry.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={S.componentName}>{c.name}</p>
                      <p style={S.componentMeta}>
                        {c.componentType} · order {c.sortOrder} {c.decorators.length > 0 && `· ${c.decorators.length} decorator${c.decorators.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleToggleVisible(c)
                      }}
                      style={{ ...S.ghostBtn, padding: '4px 10px', fontSize: 11 }}
                      title={c.isVisible ? 'Hide on storefront' : 'Show on storefront'}
                    >
                      {c.isVisible ? '👁' : '⌀'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDeleteComponent(c.componentId)
                      }}
                      style={{ ...S.dangerBtn, padding: '4px 10px', fontSize: 11 }}
                      title="Delete component"
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* AI assistant — floating panel */}
        <AiChatPanel
          context={
            {
              currentPage: page
                ? {
                    title: page.title,
                    slug: page.slug,
                    pageType: page.pageType,
                    components: components.map((c) => ({
                      name: c.name,
                      componentType: c.componentType,
                    })),
                  }
                : undefined,
            } satisfies AiStoreContext
          }
          quickPrompts={[
            'Suggest components for this page',
            'How should I arrange the components?',
            'What content works best for a Hero?',
            'How can I improve this page?',
          ]}
        />

        {/* Inspector */}
        <aside style={{ ...S.pane, borderRight: 'none' }}>
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ ...S.paneTitle, margin: 0 }}>Inspector</p>
                {savingInspector && <span style={{ fontSize: 11, color: '#aaa' }}>Saving…</span>}
              </div>

              <label style={S.inspectorLabel}>Name</label>
              <input
                type="text"
                value={selected.name}
                onChange={(e) =>
                  handleInspectorChange({ ...selected, name: e.target.value })
                }
                style={S.inspectorInput}
              />

              <label style={S.inspectorLabel}>Type</label>
              <input
                type="text"
                value={selected.componentType}
                readOnly
                style={{ ...S.inspectorInput, background: '#faf8f5', color: '#888', fontFamily: 'ui-monospace, monospace' }}
              />

              <ContentInspector
                component={selected}
                onChange={handleInspectorChange}
              />

              <DecoratorsPanel
                storeId={storeId}
                component={selected}
                onChanged={() => void load()}
              />
            </>
          ) : (
            <div style={{ padding: '40px 8px', textAlign: 'center', color: '#888' }}>
              <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>Nothing selected</p>
              <p style={{ fontSize: 12, margin: 0 }}>Click a component on the canvas to edit it.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
