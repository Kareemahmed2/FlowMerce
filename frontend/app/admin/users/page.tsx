'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminService } from '@/services/admin.service'
import { useMerchantAuth } from '@/store/auth-store'
import type { AdminUserResponse } from '@/types/admin.types'
import type { UserRole } from '@/types/auth.types'

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; color: string }> = {
  ADMIN:    { label: 'Admin',    bg: '#fef2f2', color: '#dc2626' },
  MERCHANT: { label: 'Merchant', bg: '#eff6ff', color: '#1d4ed8' },
  BUYER:    { label: 'Customer', bg: '#f0fdf4', color: '#15803d' },
  GUEST:    { label: 'Guest',    bg: '#f3f4f6', color: '#6b7280' },
}

const S = {
  toolbar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' },
  search:  { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: '1px solid #e9ecef', fontSize: 14, outline: 'none', fontFamily: 'inherit' } as const,
  table:   { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e9ecef' },
  th:      { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #f0f0f0', background: '#fafafa' },
  td:      { padding: '14px 16px', fontSize: 13, color: '#0F0E0C', borderBottom: '1px solid #f7f7f7' } as const,
  filterBtn: (active: boolean) => ({ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: active ? '2px solid #1e1b4b' : '1px solid #e9ecef', background: active ? '#1e1b4b' : '#fff', color: active ? '#fff' : '#555', cursor: 'pointer' }),
  deleteBtn: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' } as const,
  badge:     (bg: string, color: string) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color }),
}

const ROLE_FILTERS: Array<'ALL' | UserRole> = ['ALL', 'MERCHANT', 'BUYER', 'ADMIN']

export default function AdminUsersPage() {
  const auth = useMerchantAuth()
  const [users, setUsers] = useState<AdminUserResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL')
  const [confirmDelete, setConfirmDelete] = useState<AdminUserResponse | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const result = await adminService.getUsers(auth.getAuthHeader())
    if (result.ok) setUsers(result.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let result = roleFilter === 'ALL' ? users : users.filter((u) => u.role === roleFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    return result
  }, [users, search, roleFilter])

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const result = await adminService.deleteUser(confirmDelete.userId, auth.getAuthHeader())
    if (result.ok) {
      setUsers((prev) => prev.filter((u) => u.userId !== confirmDelete.userId))
      setConfirmDelete(null)
      showToast(`User ${confirmDelete.email} deleted`)
    }
    setDeleting(false)
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 300, background: '#1e1b4b', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {(['ALL', 'MERCHANT', 'BUYER', 'ADMIN'] as const).map((r) => {
          const count = r === 'ALL' ? users.length : users.filter((u) => u.role === r).length
          const cfg = r === 'ALL' ? { label: 'Total', bg: '#f3f4f6', color: '#0F0E0C' } : ROLE_CONFIG[r]
          return (
            <div key={r} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e9ecef' }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{cfg.label}</p>
              <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: cfg.color }}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" style={S.search} />
        {ROLE_FILTERS.map((r) => (
          <button key={r} style={S.filterBtn(roleFilter === r)} onClick={() => setRoleFilter(r)}>
            {r === 'ALL' ? 'All Roles' : ROLE_CONFIG[r as UserRole]?.label ?? r}
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
                {['ID', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#aaa', padding: '40px 0' }}>No users found.</td></tr>
              ) : filtered.map((u) => {
                const rc = ROLE_CONFIG[u.role] ?? { label: u.role, bg: '#f3f4f6', color: '#888' }
                return (
                  <tr key={u.userId} className="admin-tr">
                    <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>#{u.userId}</td>
                    <td style={{ ...S.td, fontWeight: 500 }}>{u.fullName}</td>
                    <td style={{ ...S.td, color: '#555' }}>{u.email}</td>
                    <td style={{ ...S.td, color: '#888' }}>{u.phone ?? '—'}</td>
                    <td style={S.td}><span style={S.badge(rc.bg, rc.color)}>{rc.label}</span></td>
                    <td style={S.td}><span style={S.badge(u.isActive ? '#f0fdf4' : '#fef2f2', u.isActive ? '#15803d' : '#dc2626')}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style={S.td}>
                      {u.role !== 'ADMIN' && (
                        <button style={S.deleteBtn} onClick={() => setConfirmDelete(u)}>Delete</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} onClick={() => setConfirmDelete(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>Delete User?</h2>
            <p style={{ fontSize: 13, color: '#666', textAlign: 'center', margin: '0 0 4px' }}>{confirmDelete.fullName}</p>
            <p style={{ fontSize: 13, color: '#aaa', textAlign: 'center', margin: '0 0 24px' }}>{confirmDelete.email}</p>
            <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '10px 14px', margin: '0 0 20px' }}>
              This action is permanent and cannot be undone. All user data will be lost.
            </p>
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
