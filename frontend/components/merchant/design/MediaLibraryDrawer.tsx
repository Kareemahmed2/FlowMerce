'use client'

/**
 * Media library drawer — list, add (by URL), and delete media items.
 *
 * Backend endpoints:
 *   GET    /stores/{storeId}/storefront/media
 *   POST   /stores/{storeId}/storefront/media
 *   DELETE /stores/{storeId}/storefront/media/{mediaId}
 *
 * NOTE: Backend accepts media as URL-only (no file upload). For now we provide
 * an "add by URL" form. A future file-upload endpoint can plug into the same UI.
 */

import { useEffect, useState } from 'react'
import { useMerchantAuth } from '@/store/auth-store'
import { storefrontService } from '@/services/storefront.service'
import type { StorefrontMediaResponse } from '@/types/storefront.types'

const S = {
  backdrop: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 },
  drawer: { position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: 460, background: '#fff', zIndex: 301, boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', overflowY: 'auto' as const, padding: 24 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 } as const,
  title: { fontSize: 18, fontWeight: 700, margin: 0 } as const,
  closeBtn: { background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#888' } as const,
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e8e3d8', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 10 },
  primaryBtn: { background: '#0F0E0C', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const,
  mediaList: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 18 } as const,
  mediaCard: { background: '#faf8f5', borderRadius: 10, overflow: 'hidden', border: '1px solid #f0ebe1', position: 'relative' as const } as const,
  mediaImg: { width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' as const, display: 'block' } as const,
  mediaPlaceholder: { width: '100%', aspectRatio: '4 / 3', background: '#ede8df', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 } as const,
  mediaName: { fontSize: 11, color: '#555', padding: '8px 10px', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' } as const,
  deleteBtn: { position: 'absolute' as const, top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 12, cursor: 'pointer', lineHeight: '20px', padding: 0 },
}

export function MediaLibraryDrawer({
  storeId,
  onClose,
}: {
  storeId: number
  onClose: () => void
}) {
  const auth = useMerchantAuth()
  const [media, setMedia] = useState<StorefrontMediaResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const result = await storefrontService.listMedia(storeId, auth.getAuthHeader())
    if (result.ok) setMedia(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError('Media URL is required')
      return
    }
    setSaving(true)
    setError('')
    const result = await storefrontService.saveMedia(
      storeId,
      { url: url.trim(), name: name.trim() || undefined, mediaType: 'IMAGE' },
      auth.getAuthHeader()
    )
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setMedia((prev) => [...prev, result.data])
    setUrl('')
    setName('')
  }

  const handleDelete = async (mediaId: number) => {
    if (!confirm('Delete this media item?')) return
    const result = await storefrontService.deleteMedia(storeId, mediaId, auth.getAuthHeader())
    if (!result.ok) {
      setError(result.error)
      return
    }
    setMedia((prev) => prev.filter((m) => m.mediaId !== mediaId))
  }

  return (
    <>
      <div style={S.backdrop} onClick={onClose} />
      <aside style={S.drawer}>
        <header style={S.header}>
          <h2 style={S.title}>Media Library</h2>
          <button onClick={onClose} style={S.closeBtn} aria-label="Close">
            ×
          </button>
        </header>

        <form onSubmit={handleAdd}>
          {error && (
            <div role="alert" style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
              {error}
            </div>
          )}
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            style={S.input}
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional name"
            style={S.input}
          />
          <button type="submit" disabled={saving} style={{ ...S.primaryBtn, opacity: saving ? 0.6 : 1, width: '100%' }}>
            {saving ? 'Adding…' : '+ Add Media'}
          </button>
        </form>

        {loading ? (
          <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>Loading…</p>
        ) : media.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
            No media yet. Add a URL above.
          </p>
        ) : (
          <div style={S.mediaList}>
            {media.map((m) => (
              <div key={m.mediaId} style={S.mediaCard}>
                {m.url ? (
                  <img src={m.url} alt={m.name ?? ''} style={S.mediaImg} />
                ) : (
                  <div style={S.mediaPlaceholder}>No URL</div>
                )}
                <button
                  type="button"
                  style={S.deleteBtn}
                  onClick={() => handleDelete(m.mediaId)}
                  title="Delete"
                >
                  ×
                </button>
                <p style={S.mediaName}>{m.name ?? m.url}</p>
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  )
}
