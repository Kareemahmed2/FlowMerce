'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useStore } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import ProductCard from '@/components/store/ProductCard'

type SortKey = 'default' | 'price_asc' | 'price_desc' | 'name_asc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default', label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A–Z' },
]

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>()
  const store = useStore()
  const base = useStoreBase()
  const [sort, setSort] = useState<SortKey>('default')

  const catId = parseInt(id, 10)
  const category = store.categories.find((c) => c.id === catId)

  // ── Not found ───────────────────────────────────────────────────────────────
  if (!category) {
    return (
      <div style={{
        background: '#f7f9fb', minHeight: '60vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: '#eceef0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', color: '#75777d',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
            Category not found
          </h2>
          <p style={{ color: '#75777d', fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 }}>
            This category doesn&apos;t exist or was removed.
          </p>
          <Link href={base} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: '#1e293b', textDecoration: 'none', fontWeight: 600, fontSize: 14,
          }} className="sf-back-link">
            ← Back to store
          </Link>
        </div>
      </div>
    )
  }

  // ── Sort products ────────────────────────────────────────────────────────────
  const sorted = [...category.products].sort((a, b) => {
    const pa = typeof a.price === 'string' ? parseFloat(a.price) : a.price
    const pb = typeof b.price === 'string' ? parseFloat(b.price) : b.price
    if (sort === 'price_asc') return pa - pb
    if (sort === 'price_desc') return pb - pa
    if (sort === 'name_asc') return a.name.localeCompare(b.name)
    return 0
  })

  return (
    <div style={{ background: '#f7f9fb', color: '#191c1e', minHeight: '100%' }}>
      {/* ── Category header strip ──────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px 32px' }}>
          {/* Breadcrumb */}
          <nav style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 16, fontSize: 13, color: '#75777d',
          }}>
            <Link href={base} style={{ color: '#75777d', textDecoration: 'none', transition: 'color 0.15s' }} className="sf-breadcrumb-link">
              Home
            </Link>
            <span style={{ color: '#c5c6cd' }}>/</span>
            <span style={{ color: '#1e293b', fontWeight: 500 }}>{category.name}</span>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{
                fontSize: 26, fontWeight: 800, color: '#1e293b',
                margin: '0 0 4px', letterSpacing: '-0.02em',
              }}>
                {category.name}
              </h1>
              <p style={{ fontSize: 14, color: '#75777d', margin: 0 }}>
                {category.products.length} {category.products.length === 1 ? 'product' : 'products'}
              </p>
            </div>

            {/* Sort control */}
            {category.products.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#75777d', fontWeight: 500 }}>Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  style={{
                    height: 38, padding: '0 12px',
                    borderRadius: 9, border: '1.5px solid #e2e8f0',
                    background: '#fff', color: '#1e293b',
                    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                    cursor: 'pointer', outline: 'none',
                    appearance: 'none', paddingRight: 32,
                  }}
                  className="sf-sort-select"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Products grid ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '36px 32px 72px' }}>
        {sorted.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 24,
          }}>
            {sorted.map((p) => (
              <ProductCard key={p.id} product={p} categoryName={category.name} />
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center', padding: '80px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', background: '#eceef0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75777d',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <p style={{ color: '#75777d', fontSize: 15, fontWeight: 500, margin: 0 }}>
              No products in this category yet.
            </p>
            <Link href={base} style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>
              Explore all products →
            </Link>
          </div>
        )}
      </div>

      <style>{`
        .sf-back-link:hover { text-decoration: underline !important; }
        .sf-breadcrumb-link:hover { color: #1e293b !important; }
        .sf-sort-select:focus { border-color: #4f46e5 !important; }
      `}</style>
    </div>
  )
}
