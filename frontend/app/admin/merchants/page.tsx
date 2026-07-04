'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminService } from '@/services/admin.service'
import { useMerchantAuth } from '@/store/auth-store'
import type { AdminMerchantResponse } from '@/types/admin.types'

const S = {
  toolbar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' },
  search:  { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: '1px solid #e9ecef', fontSize: 14, outline: 'none', fontFamily: 'inherit' } as const,
  table:   { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e9ecef' },
  th:      { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #f0f0f0', background: '#fafafa' },
  td:      { padding: '14px 16px', fontSize: 13, color: '#0F0E0C', borderBottom: '1px solid #f7f7f7' } as const,
  filterBtn: (active: boolean) => ({ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: active ? '2px solid #1e1b4b' : '1px solid #e9ecef', background: active ? '#1e1b4b' : '#fff', color: active ? '#fff' : '#555', cursor: 'pointer' }),
  badge: (bg: string, color: string) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color }),
  verifyBtn: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' } as const,
  deleteBtn: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' } as const,
}

type FilterMode = 'ALL' | 'VERIFIED' | 'PENDING'

export default function AdminMerchantsPage() {
  const auth = useMerchantAuth()
  const [merchants, setMerchants] = useState<AdminMerchantResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('ALL')
  const [confirmDelete, setConfirmDelete] = useState<AdminMerchantResponse | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const result = await adminService.getMerchants(auth.getAuthHeader())
    if (result.ok) setMerchants(result.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let result = merchants
    if (filter === 'VERIFIED') result = result.filter((m) => m.isVerified)
    if (filter === 'PENDING') result = result.filter((m) => !m.isVerified)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((m) => m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.businessName ?? '').toLowerCase().includes(q))
    }
    return result
  }, [merchants, search, filter])

  const handleVerify = async (m: AdminMerchantResponse) => {
    const result = await adminService.verifyMerchant(m.merchantId, auth.getAuthHeader())
    if (result.ok) {
      setMerchants((prev) => prev.map((x) => x.userId === result.data.userId ? result.data : x))
      showToast(`✓ ${m.fullName} verified`)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const result = await adminService.deleteMerchant(confirmDelete.merchantId, auth.getAuthHeader())
    if (result.ok) {
      setMerchants((prev) => prev.filter((m) => m.userId !== confirmDelete.userId))
      setConfirmDelete(null)
      showToast(`Merchant ${confirmDelete.email} deleted`)
    } else {
      showToast(result.error)
    }
    setDeleting(false)
  }

  const pendingCount = merchants.filter((m) => !m.isVerified).length

  return (
    <div style={{ paddingBottom: 40 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 300, background: '#1e1b4b', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Pending verification banner */}
      {pendingCount > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px', color: '#c2410c' }}>{pendingCount} merchant{pendingCount > 1 ? 's' : ''} awaiting verification</p>
            <p style={{ fontSize: 12, color: '#d97706', margin: 0 }}>Review and verify merchant accounts before they can publish stores.</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search merchants…" style={S.search} />
        {(['ALL', 'VERIFIED', 'PENDING'] as FilterMode[]).map((f) => (
          <button key={f} style={S.filterBtn(filter === f)} onClick={() => setFilter(f)}>
            {f === 'ALL' ? `All (${merchants.length})` : f === 'VERIFIED' ? `Verified (${merchants.filter((m) => m.isVerified).length})` : `Pending (${pendingCount})`}
          </button>
        ))}
        <button onClick={load} style={S.filterBtn(false)}>↻</button>
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
                {['ID', 'Name', 'Email', 'Business', 'Stores', 'Verified', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#aaa', padding: '40px 0' }}>No merchants found.</td></tr>
              ) : filtered.map((m) => (
                <tr key={m.userId} className="admin-tr">
                  <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>#{m.userId}</td>
                  <td style={{ ...S.td, fontWeight: 500 }}>{m.fullName}</td>
                  <td style={{ ...S.td, color: '#555' }}>{m.email}</td>
                  <td style={{ ...S.td, color: '#888' }}>{m.businessName ?? '—'}</td>
                  <td style={{ ...S.td, textAlign: 'center' }}>{m.storeCount}</td>
                  <td style={S.td}>
                    {m.isVerified
                      ? <span style={S.badge('#f0fdf4', '#15803d')}>Verified</span>
                      : <span style={S.badge('#fff7ed', '#c2410c')}>Pending</span>
                    }
                  </td>
                  <td style={S.td}><span style={S.badge(m.isActive ? '#f0fdf4' : '#fef2f2', m.isActive ? '#15803d' : '#dc2626')}>{m.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>{new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!m.isVerified && <button style={S.verifyBtn} onClick={() => handleVerify(m)}>Verify</button>}
                      <button style={S.deleteBtn} onClick={() => setConfirmDelete(m)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} onClick={() => setConfirmDelete(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>Delete Merchant?</h2>
            <p style={{ fontSize: 13, color: '#666', textAlign: 'center', margin: '0 0 20px' }}>{confirmDelete.fullName} · {confirmDelete.businessName ?? confirmDelete.email}</p>
            <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '10px 14px', margin: '0 0 20px' }}>This will permanently delete the merchant account and all associated stores.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, height: 44, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0 20px', height: 44, background: 'none', border: '1px solid #e9ecef', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#555' }}>Cancel</button>
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
