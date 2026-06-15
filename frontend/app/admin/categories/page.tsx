'use client'

/**
 * Admin Categories page — manage the global /categories list.
 *
 * Wired to categoryService (5 endpoints):
 *   GET    /categories          → list
 *   POST   /categories          → create (ADMIN)
 *   PUT    /categories/{id}     → update (ADMIN)
 *   DELETE /categories/{id}     → delete (ADMIN)
 *
 * Mirrors the patterns of /admin/users, /admin/merchants, /admin/stores.
 * Uses the admin layout (sidebar + auth context).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMerchantAuth } from '@/store/auth-store'
import { categoryService } from '@/services/category.service'
import type { CategoryResponse } from '@/types/category.types'

const S = {
  toolbar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' },
  search:  { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: '1px solid #e9ecef', fontSize: 14, outline: 'none', fontFamily: 'inherit' } as const,
  table:   { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e9ecef' },
  th:      { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #f0f0f0', background: '#fafafa' },
  td:      { padding: '14px 16px', fontSize: 13, color: '#0F0E0C', borderBottom: '1px solid #f7f7f7' } as const,
  filterBtn: (active: boolean) => ({ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: active ? '2px solid #1e1b4b' : '1px solid #e9ecef', background: active ? '#1e1b4b' : '#fff', color: active ? '#fff' : '#555', cursor: 'pointer' }),
  primaryBtn: { background: '#1e1b4b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const,
  editBtn: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' } as const,
  deleteBtn: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' } as const,
  badge: (bg: string, color: string) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color }),
  modal: { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 460, zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  backdrop: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 } as const,
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e9ecef', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 14 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#555' } as const,
}

interface CategoryFormState {
  name: string
  description: string
}

function CategoryModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string
  initial: CategoryFormState
  onClose: () => void
  onSubmit: (data: CategoryFormState) => Promise<void>
}) {
  const [form, setForm] = useState<CategoryFormState>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Category name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ name: form.name.trim(), description: form.description.trim() })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <>
      <div style={S.backdrop} onClick={onClose} role="presentation" />
      <div style={S.modal}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 18px' }}>{title}</h2>
        {error && (
          <div role="alert" style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <label style={S.label}>Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Apparel"
            style={S.input}
            autoFocus
          />

          <label style={S.label}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Optional"
            rows={3}
            style={{ ...S.input, resize: 'vertical' as const, minHeight: 70 }}
          />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #e9ecef', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: '#555' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ ...S.primaryBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default function AdminCategoriesPage() {
  const auth = useMerchantAuth()
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<CategoryResponse | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<CategoryResponse | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const result = await categoryService.getAll()
    if (result.ok) setCategories(result.data)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    if (!search.trim()) return categories
    const q = search.toLowerCase()
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)
    )
  }, [categories, search])

  const handleCreate = async (data: CategoryFormState) => {
    const result = await categoryService.create(
      { name: data.name, description: data.description || undefined },
      auth.getAuthHeader()
    )
    if (!result.ok) throw new Error(result.error)
    setCategories((prev) => [...prev, result.data])
    showToast(`✓ Category "${result.data.name}" created`)
  }

  const handleUpdate = async (data: CategoryFormState) => {
    if (!editTarget) return
    const result = await categoryService.update(
      editTarget.categoryId,
      { name: data.name, description: data.description || undefined },
      auth.getAuthHeader()
    )
    if (!result.ok) throw new Error(result.error)
    setCategories((prev) =>
      prev.map((c) => (c.categoryId === result.data.categoryId ? result.data : c))
    )
    showToast(`✓ "${result.data.name}" updated`)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const result = await categoryService.delete(confirmDelete.categoryId, auth.getAuthHeader())
    setDeleting(false)
    if (!result.ok) {
      showToast(`Delete failed: ${result.error}`)
      return
    }
    setCategories((prev) => prev.filter((c) => c.categoryId !== confirmDelete.categoryId))
    showToast(`✓ "${confirmDelete.name}" deleted`)
    setConfirmDelete(null)
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 300, background: '#1e1b4b', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e9ecef' }}>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Total Categories</p>
          <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#1e1b4b' }}>{categories.length}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e9ecef' }}>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Global</p>
          <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#15803d' }}>
            {categories.filter((c) => c.storeId == null).length}
          </p>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e9ecef' }}>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Store-scoped</p>
          <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#0891b2' }}>
            {categories.filter((c) => c.storeId != null).length}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories…"
          style={S.search}
        />
        <button onClick={load} style={S.filterBtn(false)}>↻</button>
        <button onClick={() => setCreateOpen(true)} style={S.primaryBtn}>
          + New Category
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e9ecef', borderTopColor: '#1e1b4b', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['ID', 'Name', 'Description', 'Scope', 'Actions'].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#aaa', padding: '40px 0' }}>
                    No categories found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.categoryId} className="admin-tr">
                    <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>#{c.categoryId}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{c.name}</td>
                    <td style={{ ...S.td, color: '#666', maxWidth: 360 }}>
                      {c.description ?? <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={S.td}>
                      {c.storeId == null ? (
                        <span style={S.badge('#f0fdf4', '#15803d')}>Global</span>
                      ) : (
                        <span style={S.badge('#eff6ff', '#1d4ed8')}>Store #{c.storeId}</span>
                      )}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={S.editBtn} onClick={() => setEditTarget(c)}>
                          Edit
                        </button>
                        <button style={S.deleteBtn} onClick={() => setConfirmDelete(c)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modals */}
      {createOpen && (
        <CategoryModal
          title="New Category"
          initial={{ name: '', description: '' }}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}
      {editTarget && (
        <CategoryModal
          key={editTarget.categoryId}
          title={`Edit ${editTarget.name}`}
          initial={{ name: editTarget.name, description: editTarget.description ?? '' }}
          onClose={() => setEditTarget(null)}
          onSubmit={handleUpdate}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <>
          <div style={S.backdrop} onClick={() => setConfirmDelete(null)} />
          <div style={{ ...S.modal, maxWidth: 400 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>Delete Category?</h2>
            <p style={{ fontSize: 14, color: '#666', textAlign: 'center', margin: '0 0 24px' }}>
              <strong>{confirmDelete.name}</strong> will be permanently removed.
            </p>
            <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '10px 14px', margin: '0 0 20px' }}>
              Products assigned to this category may need to be re-categorised.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, height: 44, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0 20px', height: 44, background: 'none', border: '1px solid #e9ecef', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#555' }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .admin-tr:hover td { background: #fafafa; }
      `}</style>
    </div>
  )
}
