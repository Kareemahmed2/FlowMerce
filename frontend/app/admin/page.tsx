'use client'

/**
 * Admin dashboard overview — quick-stat cards + recent activity.
 *
 * TODO(BACKEND-INTEGRATION): Replace mock counts with real API aggregates.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { adminService } from '@/services/admin.service'
import { useMerchantAuth } from '@/store/auth-store'

const S = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 } as const,
  card: (color: string) => ({ background: '#fff', borderRadius: 14, padding: '22px 24px', border: `1px solid #e2e8f0`, borderTop: `3px solid ${color}`, boxShadow: '0 1px 3px rgba(30,41,59,0.05)' }),
  label: { fontSize: 11, color: '#75777d', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 },
  value: { fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: '#1e293b' } as const,
  sub:   { fontSize: 12, color: '#75777d', margin: '6px 0 0' } as const,
  section: { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 24, boxShadow: '0 1px 3px rgba(30,41,59,0.05)' } as const,
  sectionHeader: { padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as const,
  sectionTitle: { fontSize: 15, fontWeight: 700, margin: 0, color: '#1e293b' } as const,
  row: { padding: '14px 20px', borderBottom: '1px solid #f2f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 } as const,
  navLink: { color: '#4f46e5', fontWeight: 600, textDecoration: 'none', fontSize: 13 } as const,
}

interface Stats { users: number; merchants: number; stores: number; orders: number }

export default function AdminDashboardPage() {
  const auth = useMerchantAuth()
  const [stats, setStats] = useState<Stats>({ users: 0, merchants: 0, stores: 0, orders: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      adminService.getUsers(auth.getAuthHeader()),
      adminService.getMerchants(auth.getAuthHeader()),
      adminService.getStores(auth.getAuthHeader()),
      adminService.getAllOrders(0, 1, auth.getAuthHeader()),
    ]).then(([usersR, merchantsR, storesR, ordersR]) => {
      setStats({
        users: usersR.ok ? usersR.data.length : 0,
        merchants: merchantsR.ok ? merchantsR.data.length : 0,
        stores: storesR.ok ? storesR.data.length : 0,
        orders: ordersR.ok ? ordersR.data.totalElements : 0,
      })
    }).finally(() => setLoading(false))
  }, [])

  const statCards = [
    { label: 'Total Users',      value: stats.users,     color: '#4f46e5', link: '/admin/users',     desc: 'All roles' },
    { label: 'Merchants',        value: stats.merchants,  color: '#0891b2', link: '/admin/merchants', desc: 'Registered sellers' },
    { label: 'Active Stores',    value: stats.stores,     color: '#15803d', link: '/admin/stores',    desc: 'All storefronts' },
    { label: 'Total Orders',     value: stats.orders,     color: '#d97706', link: '/admin/orders',    desc: 'All time' },
  ]

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Stats */}
      <div style={S.grid}>
        {statCards.map((c) => (
          <div key={c.label} style={S.card(c.color)}>
            <p style={S.label}>{c.label}</p>
            {loading ? (
              <div style={{ width: 60, height: 32, borderRadius: 6, background: '#f3f4f6' }} />
            ) : (
              <p style={{ ...S.value, color: c.color }}>{c.value.toLocaleString()}</p>
            )}
            <p style={S.sub}>
              {c.desc} · <Link href={c.link} style={{ color: c.color, textDecoration: 'none', fontWeight: 600 }}>View →</Link>
            </p>
          </div>
        ))}
      </div>

      {/* Quick-nav sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

        <div style={S.section}>
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>Quick Actions</h2>
          </div>
          {[
            { label: 'Manage Users',      sub: 'View, search, delete accounts',           href: '/admin/users',     icon: '◉' },
            { label: 'Verify Merchants',  sub: 'Approve pending merchant accounts',        href: '/admin/merchants', icon: '⊞' },
            { label: 'Monitor Stores',    sub: 'View all storefronts and their status',    href: '/admin/stores',    icon: '◎' },
            { label: 'Browse All Orders', sub: 'Paginated view of every order',            href: '/admin/orders',    icon: '▦' },
          ].map((a) => (
            <Link key={a.href} href={a.href} style={{ ...S.row, textDecoration: 'none', color: '#1e293b', transition: 'background 0.12s' }} className="admin-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                  {a.icon}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>{a.label}</p>
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>{a.sub}</p>
                </div>
              </div>
              <span style={{ color: '#ccc', fontSize: 16 }}>›</span>
            </Link>
          ))}
        </div>

        <div style={S.section}>
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>System Info</h2>
          </div>
          {[
            { label: 'Backend URL',       value: process.env.NEXT_PUBLIC_API_URL || 'Mock Mode (no URL set)' },
            { label: 'Mode',              value: process.env.NEXT_PUBLIC_API_URL ? 'Live API' : 'Mock / Local' },
            { label: 'Environment',       value: process.env.NODE_ENV ?? 'development' },
            { label: 'Date',              value: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
          ].map((r) => (
            <div key={r.label} style={S.row}>
              <span style={{ color: '#888' }}>{r.label}</span>
              <span style={{ fontWeight: 500, fontSize: 13, maxWidth: 200, textAlign: 'right', color: r.label === 'Mode' && r.value === 'Mock / Local' ? '#c2410c' : '#0F0E0C' }}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`.admin-row:hover { background: #f9fafb !important; }`}</style>
    </div>
  )
}
