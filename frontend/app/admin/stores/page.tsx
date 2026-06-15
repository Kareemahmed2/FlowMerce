'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminService } from '@/services/admin.service'
import { useMerchantAuth } from '@/store/auth-store'
import { STORE_STATUS_CONFIG } from '@/types/admin.types'
import type { AdminStoreResponse, StoreStatus } from '@/types/admin.types'

const S = {
  toolbar:   { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' },
  search:    { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: '1px solid #e9ecef', fontSize: 14, outline: 'none', fontFamily: 'inherit' } as const,
  table:     { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e9ecef' },
  th:        { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #f0f0f0', background: '#fafafa' },
  td:        { padding: '14px 16px', fontSize: 13, color: '#0F0E0C', borderBottom: '1px solid #f7f7f7' } as const,
  filterBtn: (active: boolean) => ({ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: active ? '2px solid #1e1b4b' : '1px solid #e9ecef', background: active ? '#1e1b4b' : '#fff', color: active ? '#fff' : '#555', cursor: 'pointer' }),
}

const STATUS_FILTERS: Array<'ALL' | StoreStatus> = ['ALL', 'PUBLISHED', 'DRAFT', 'PAUSED', 'DEACTIVATED']

export default function AdminStoresPage() {
  const auth = useMerchantAuth()
  const [stores, setStores] = useState<AdminStoreResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | StoreStatus>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    const result = await adminService.getStores(auth.getAuthHeader())
    if (result.ok) setStores(result.data)
    setLoading(false)
  }, [auth.getAuthHeader])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let result = statusFilter === 'ALL' ? stores : stores.filter((s) => s.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      // CON-6: search by storeName, storeId, or storeUrl only (merchantName/email not in DTO)
      result = result.filter(
        (s) =>
          s.storeName.toLowerCase().includes(q) ||
          (s.storeUrl ?? '').toLowerCase().includes(q) ||
          String(s.merchantId).includes(q)
      )
    }
    return result
  }, [stores, search, statusFilter])

  const published = stores.filter((s) => s.status === 'PUBLISHED').length
  const draft = stores.filter((s) => s.status === 'DRAFT').length

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Stores', value: stores.length, color: '#1e1b4b' },
          { label: 'Published',    value: published,     color: '#15803d' },
          { label: 'Draft',        value: draft,         color: '#888' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e9ecef' }}>
            <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: s.color }}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, URL or merchant ID…" style={S.search} />
        {STATUS_FILTERS.map((f) => (
          <button key={f} style={S.filterBtn(statusFilter === f)} onClick={() => setStatusFilter(f)}>
            {f === 'ALL' ? 'All Stores' : STORE_STATUS_CONFIG[f as StoreStatus]?.label ?? f}
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
                {['ID', 'Store Name', 'URL', 'Merchant ID', 'Status', 'Created', 'View'].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#aaa', padding: '40px 0' }}>No stores found.</td></tr>
              ) : filtered.map((s) => {
                const sc = STORE_STATUS_CONFIG[s.status] ?? { label: s.status, bg: '#f3f4f6', color: '#888' }
                return (
                  <tr key={s.storeId} className="admin-tr">
                    <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>#{s.storeId}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{s.storeName}</td>
                    <td style={{ ...S.td, color: '#4f46e5', fontSize: 12 }}>{s.storeUrl ?? '—'}</td>
                    <td style={{ ...S.td, color: '#555', fontSize: 12 }}>
                      {s.merchantName ?? `#${s.merchantId}`}
                      {s.merchantEmail && <span style={{ color: '#aaa', display: 'block', fontSize: 11 }}>{s.merchantEmail}</span>}
                    </td>
                    <td style={S.td}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>
                      {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={S.td}>
                      {s.status === 'PUBLISHED' && s.storeUrl && (
                        <Link href={`/store/${s.storeUrl}`} target="_blank" style={{ color: '#4f46e5', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                          Visit ↗
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .admin-tr:hover td { background: #fafafa; }
      `}</style>
    </div>
  )
}
