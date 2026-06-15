'use client'

/**
 * Storefront pages index — landing page for the visual builder.
 *
 * Shows:
 *  - Storefront status (DRAFT / PUBLISHED) with publish/unpublish actions
 *  - Theme color editor (live preview of header/accent/text/etc)
 *  - List of pages → click to edit, or create a new one
 *  - Media library button (opens drawer)
 *
 * Each page click navigates to /dashboard/design/[pageId] (the builder).
 */

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMerchantAuth } from '@/store/auth-store'
import { storefrontService } from '@/services/storefront.service'
import type {
  PageSummary,
  StorefrontTemplateResponse,
  ThemeResponse,
} from '@/types/storefront.types'
// ThemeResponse used for state typing only
import { PAGE_TYPES } from '@/types/storefront.types'
import { normalizeStorefrontColors, type StorefrontColors } from '@/components/merchant/onboarding/types'
import { MediaLibraryDrawer } from './MediaLibraryDrawer'
import { DesignStudioPage } from './DesignStudioPage'
import { AiChatPanel } from './AiChatPanel'
import type { AiStoreContext } from './AiChatPanel'

const S = {
  page: { padding: '8px 0 40px' } as const,
  card: { background: '#fff', borderRadius: 14, padding: '24px 26px', border: '1px solid #ede8df' } as const,
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 } as const,
  cardTitle: { fontSize: 17, fontWeight: 700, margin: 0, color: '#0F0E0C' } as const,
  cardSub: { fontSize: 12, color: '#888', margin: '2px 0 0' } as const,
  primaryBtn: { background: '#0F0E0C', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const,
  ghostBtn: { background: 'none', color: '#0F0E0C', border: '1px solid #e8e3d8', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const,
  dangerBtn: { background: '#FCEBEB', color: '#A32D2D', border: '1px solid #f7c1c1', borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const,
  statusPill: (status: string) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: status === 'PUBLISHED' ? '#EAF3DE' : '#FAEEDA',
    color: status === 'PUBLISHED' ? '#3B6D11' : '#854F0B',
  }),
  themeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 16 } as const,
  themeSwatch: { display: 'flex', alignItems: 'center', gap: 10 } as const,
  swatchPreview: { width: 28, height: 28, borderRadius: 6, border: '1px solid #e8e3d8', flexShrink: 0 } as const,
  swatchLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 500 } as const,
  swatchInput: { fontSize: 12, color: '#0F0E0C', fontFamily: 'ui-monospace, monospace', border: 'none', outline: 'none', background: 'transparent', width: 80 } as const,
  pageList: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  pageRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#fafafa', borderRadius: 10, border: '1px solid #f0ebe1', transition: 'background 0.12s' } as const,
  pageLink: { textDecoration: 'none', color: 'inherit', flex: 1 } as const,
  modal: { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  backdrop: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 } as const,
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e9ecef', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 14 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#555' } as const,
}

function NewPageModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (title: string, slug: string, pageType: string) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [pageType, setPageType] = useState('CUSTOM')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !slug.trim()) {
      setError('Title and slug are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(title.trim(), slug.trim(), pageType)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
      setSaving(false)
    }
  }

  return (
    <>
      <div style={S.backdrop} onClick={onClose} />
      <div style={S.modal}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 18px' }}>New Page</h2>
        {error && (
          <div role="alert" style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <label style={S.label}>Title</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, '-')) {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
              }
            }}
            placeholder="About Us"
            style={S.input}
            autoFocus
          />

          <label style={S.label}>Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
            placeholder="about-us"
            style={{ ...S.input, fontFamily: 'ui-monospace, monospace' }}
          />

          <label style={S.label}>Page type</label>
          <select
            value={pageType}
            onChange={(e) => setPageType(e.target.value)}
            style={{ ...S.input, cursor: 'pointer' }}
          >
            {PAGE_TYPES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={saving} style={S.ghostBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ ...S.primaryBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating…' : 'Create Page'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export function StorefrontPagesIndex() {
  const auth = useMerchantAuth()
  const storeId = auth.storeId

  const [template, setTemplate] = useState<StorefrontTemplateResponse | null>(null)
  const [theme, setTheme] = useState<ThemeResponse | null>(null)
  const [pages, setPages] = useState<PageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadAll = useCallback(async () => {
    if (storeId === null) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const [templateR, themeR, pagesR] = await Promise.all([
      storefrontService.getStorefront(storeId, auth.getAuthHeader()),
      storefrontService.getTheme(storeId, auth.getAuthHeader()),
      storefrontService.listPages(storeId, auth.getAuthHeader()),
    ])
    // Storefront may not be initialised yet — surface that nicely.
    if (!templateR.ok) {
      setError(templateR.error)
      setLoading(false)
      return
    }
    setTemplate(templateR.data)
    if (themeR.ok) setTheme(themeR.data)
    if (pagesR.ok) setPages(pagesR.data)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  useEffect(() => { void loadAll() }, [loadAll])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleInit = async () => {
    if (storeId === null) return
    setActionBusy(true)
    const result = await storefrontService.initStorefront(storeId, {}, auth.getAuthHeader())
    setActionBusy(false)
    if (!result.ok) {
      showToast(result.error)
      return
    }
    setTemplate(result.data)
    void loadAll()
    showToast('✓ Storefront initialised')
  }

  const handlePublish = async () => {
    if (storeId === null) return
    setActionBusy(true)
    const result = await storefrontService.publishStorefront(storeId, auth.getAuthHeader())
    setActionBusy(false)
    if (!result.ok) {
      showToast(result.error)
      return
    }
    setTemplate(result.data)
    showToast('✓ Storefront published')
  }

  const handleUnpublish = async () => {
    if (storeId === null) return
    setActionBusy(true)
    const result = await storefrontService.unpublishStorefront(storeId, auth.getAuthHeader())
    setActionBusy(false)
    if (!result.ok) {
      showToast(result.error)
      return
    }
    setTemplate(result.data)
    showToast('✓ Storefront unpublished')
  }

  const handleSaveColors = async (colors: StorefrontColors) => {
    if (storeId === null) return
    setActionBusy(true)
    const result = await storefrontService.updateTheme(
      storeId,
      {
        background: colors.background,
        header: colors.header,
        footer: colors.footer,
        accent: colors.accent,
        text: colors.text,
        card: colors.card,
      },
      auth.getAuthHeader()
    )
    setActionBusy(false)
    if (!result.ok) {
      showToast(result.error)
      return
    }
    setTheme(result.data)
    showToast('✓ Theme saved')
  }

  const handleCreatePage = async (title: string, slug: string, pageType: string) => {
    if (storeId === null) return
    const result = await storefrontService.createPage(
      storeId,
      { title, slug, pageType, isPublished: false, showInNav: true },
      auth.getAuthHeader()
    )
    if (!result.ok) throw new Error(result.error)
    void loadAll()
    showToast(`✓ Created "${result.data.title}"`)
  }

  const handleDeletePage = async (pageId: number, title: string) => {
    if (storeId === null) return
    if (!confirm(`Delete page "${title}"? This cannot be undone.`)) return
    const result = await storefrontService.deletePage(storeId, pageId, auth.getAuthHeader())
    if (!result.ok) {
      showToast(result.error)
      return
    }
    setPages((prev) => prev.filter((p) => p.pageId !== pageId))
    showToast(`✓ Deleted "${title}"`)
  }

  // ── Render guards ──────────────────────────────────────────────────────────

  const designColors = useMemo(
    () => (theme ? normalizeStorefrontColors(theme) : undefined),
    [theme]
  )

  if (storeId === null) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: '#0F0E0C' }}>No store yet</p>
          <p style={{ fontSize: 13, color: '#888' }}>Create a store first to start customising your storefront.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid #e9ecef', borderTopColor: '#0F0E0C', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div role="alert" style={{ textAlign: 'center', maxWidth: 480, background: '#FCEBEB', color: '#A32D2D', borderRadius: 12, padding: 24, border: '1px solid #F7C1C1' }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>Storefront not initialised yet</p>
          <p style={{ fontSize: 13, margin: '0 0 14px' }}>{error}</p>
          <button type="button" style={S.primaryBtn} onClick={handleInit} disabled={actionBusy}>
            {actionBusy ? 'Initialising…' : 'Initialise Storefront'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 300, background: '#0F0E0C', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Lifecycle */}
      {template && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={S.cardHeader}>
            <div>
              <p style={S.cardTitle}>Storefront</p>
              <p style={S.cardSub}>
                v{template.version} · {template.pages.length} page{template.pages.length !== 1 ? 's' : ''}
                {template.publishedAt && ` · Last published ${new Date(template.publishedAt).toLocaleDateString()}`}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={S.statusPill(template.status)}>{template.status}</span>
              {template.status === 'PUBLISHED' ? (
                <button onClick={handleUnpublish} disabled={actionBusy} style={S.ghostBtn}>
                  Unpublish
                </button>
              ) : (
                <button onClick={handlePublish} disabled={actionBusy} style={S.primaryBtn}>
                  Publish
                </button>
              )}
              <button onClick={() => setMediaOpen(true)} style={S.ghostBtn}>
                Media Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Design studio — color editor + AI color advisor */}
      <div style={{ ...S.card, marginBottom: 20, padding: '24px 26px' }}>
        <DesignStudioPage
          storeName={template?.storeName}
          initialColors={designColors}
          onSave={handleSaveColors}
          saving={actionBusy}
        />
      </div>

      {/* Pages list */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <div>
            <p style={S.cardTitle}>Pages</p>
            <p style={S.cardSub}>Click a page to open the visual builder.</p>
          </div>
          <button onClick={() => setNewPageOpen(true)} style={S.primaryBtn}>
            + New Page
          </button>
        </div>

        {pages.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
            No pages yet — click <strong>New Page</strong> to get started.
          </p>
        ) : (
          <div style={S.pageList}>
            {pages
              .slice()
              .sort((a, b) => a.navOrder - b.navOrder)
              .map((page) => (
                <div key={page.pageId} style={S.pageRow}>
                  <Link href={`/dashboard/design/${page.pageId}`} style={S.pageLink}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 18, opacity: 0.5 }}>☷</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>{page.title}</p>
                        <p style={{ fontSize: 12, color: '#888', margin: 0, fontFamily: 'ui-monospace, monospace' }}>
                          /{page.slug} · {page.pageType} · {(page.components ?? []).length} component{(page.components ?? []).length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={S.statusPill(page.isPublished ? 'PUBLISHED' : 'DRAFT')}>
                      {page.isPublished ? 'Live' : 'Draft'}
                    </span>
                    <button
                      type="button"
                      style={S.dangerBtn}
                      onClick={() => handleDeletePage(page.pageId, page.title)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {newPageOpen && (
        <NewPageModal onClose={() => setNewPageOpen(false)} onSubmit={handleCreatePage} />
      )}
      {mediaOpen && storeId !== null && (
        <MediaLibraryDrawer storeId={storeId} onClose={() => setMediaOpen(false)} />
      )}

      <AiChatPanel
        context={
          {
            storeName: template?.storeName,
            status: template?.status,
            themeColors: theme
              ? {
                  background: theme.background,
                  header: theme.header,
                  footer: theme.footer,
                  accent: theme.accent,
                  text: theme.text,
                  card: theme.card,
                }
              : undefined,
            pages: pages.map((p) => ({
              title: p.title,
              slug: p.slug,
              pageType: p.pageType,
              componentCount: (p.components ?? []).length,
            })),
          } satisfies AiStoreContext
        }
        quickPrompts={[
          'Suggest pages for my store',
          'Evaluate my theme colors',
          'How do I increase conversions?',
          'Is my store ready to publish?',
        ]}
      />
    </div>
  )
}
