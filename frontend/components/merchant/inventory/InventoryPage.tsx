'use client'

/**
 * Merchant inventory management page.
 *
 * Features:
 *  - Full inventory table with stock level indicators
 *  - Low stock / out-of-stock badges
 *  - Restock modal (add quantity + note)
 *  - Stock history drawer per product
 *  - Summary stats cards (total, low stock, out of stock)
 *  - Search/filter by name
 *
 * INT-34 resolved: inventoryService calls the real backend API.
 * No component changes needed — all data flows through inventoryService.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { inventoryService } from '@/services/inventory.service'
import { productService } from '@/services/product.service'
import { computeInventorySummary, isLowStock, isOutOfStock } from '@/types/inventory.types'
// P4: useFlowmerceStore removed — storeId comes from auth context directly.
import type {
  InventoryAdjustRequest,
  InventoryResponse,
  InventoryStrategyType,
  InventoryTransaction,
  RestockRequest,
} from '@/types/inventory.types'
import { useMerchantAuth } from '@/store/auth-store'

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = {
  page: { padding: '8px 0 40px' } as const,
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 } as const,
  statCard: { background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid #ede8df' } as const,
  statLabel: { fontSize: 12, color: '#888', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 500 },
  statValue: { fontSize: 28, fontWeight: 700, margin: 0, color: '#0F0E0C' } as const,
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const },
  searchInput: { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: '1px solid #e8e3d8', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff' } as const,
  table: { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #ede8df' },
  th: { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #f0ebe1', background: '#faf8f5' },
  td: { padding: '14px 16px', fontSize: 14, color: '#0F0E0C', borderBottom: '1px solid #f7f4ef' } as const,
  badge: (bg: string, color: string) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color }),
  actionBtn: { background: 'none', border: '1px solid #e8e3d8', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#444', transition: 'background 0.15s' } as const,
  backdrop: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 },
  modal: { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' as const },
  drawer: { position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: 420, background: '#fff', zIndex: 201, boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', overflowY: 'auto' as const, padding: 24 },
}

function stockBadge(item: InventoryResponse) {
  if (isOutOfStock(item)) return <span style={S.badge('#fef2f2', '#dc2626')}>Out of Stock</span>
  if (isLowStock(item)) return <span style={S.badge('#fff7ed', '#c2410c')}>Low Stock</span>
  return <span style={S.badge('#f0fdf4', '#15803d')}>In Stock</span>
}

// ── Adjust Stock Modal ───────────────────────────────────────────────────────
// Used for defective items, manual corrections, etc. Quantity is a signed delta:
//   positive = add to available, negative = remove from available.

const STRATEGIES: { value: InventoryStrategyType; label: string; desc: string }[] = [
  { value: 'NORMAL', label: 'Normal', desc: 'Standard adjustment with no special handling.' },
  { value: 'RESERVED', label: 'Reserved Stock', desc: 'Touches reserved-only bucket (e.g. pre-order reconciliation).' },
  { value: 'FLASH', label: 'Flash Sale', desc: 'Adjustments related to flash-sale allocations.' },
]

function AdjustModal({
  product,
  onClose,
  onConfirm,
}: {
  product: InventoryResponse
  onClose: () => void
  onConfirm: (req: InventoryAdjustRequest) => Promise<void>
}) {
  const [delta, setDelta] = useState('')
  const [strategy, setStrategy] = useState<InventoryStrategyType>('NORMAL')
  const [reason, setReason] = useState<'defective' | 'correction' | 'shrinkage' | 'other'>('correction')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const numericDelta = parseInt(delta, 10)
  const isValid = !isNaN(numericDelta) && numericDelta !== 0
  const newQty = isValid ? Math.max(0, product.availableQuantity + numericDelta) : product.availableQuantity

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) {
      setError('Enter a non-zero quantity (use negative numbers to deduct)')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onConfirm({
        productId: product.productId,
        quantity: numericDelta,
        strategyType: strategy,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjustment failed')
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid #e8e3d8', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }

  return (
    <>
      <div style={S.backdrop} onClick={onClose} />
      <div style={S.modal}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Adjust Stock</h2>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>{product.productName}</p>

        <div style={{ background: '#f7f4ef', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <div><span style={{ color: '#888' }}>Current: </span><strong>{product.availableQuantity}</strong></div>
          <div><span style={{ color: '#888' }}>After: </span><strong style={{ color: numericDelta < 0 ? '#dc2626' : numericDelta > 0 ? '#15803d' : '#0F0E0C' }}>{newQty}</strong></div>
        </div>

        {error && (
          <div role="alert" style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#555' }}>
            Quantity change <span style={{ fontWeight: 400, color: '#888' }}>(positive adds, negative removes)</span>
          </label>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="e.g. -3 for defective"
            style={{ ...inputStyle, marginBottom: 14 }}
            autoFocus
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#555' }}>
            Reason
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
            style={{ ...inputStyle, marginBottom: 14, cursor: 'pointer' }}
          >
            <option value="correction">Manual correction</option>
            <option value="defective">Defective / damaged</option>
            <option value="shrinkage">Shrinkage / loss</option>
            <option value="other">Other</option>
          </select>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#555' }}>
            Strategy
          </label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as InventoryStrategyType)}
            style={{ ...inputStyle, marginBottom: 6, cursor: 'pointer' }}
          >
            {STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 20px' }}>
            {STRATEGIES.find((s) => s.value === strategy)?.desc}
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={loading} style={{ ...S.actionBtn, padding: '10px 18px' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isValid}
              style={{
                ...S.actionBtn,
                padding: '10px 22px',
                background: !isValid || loading ? '#aaa' : '#0F0E0C',
                color: '#fff',
                border: 'none',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Adjusting…' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ── Restock Modal ─────────────────────────────────────────────────────────────

function RestockModal({
  product,
  onClose,
  onConfirm,
}: {
  product: InventoryResponse
  onClose: () => void
  onConfirm: (req: RestockRequest) => Promise<void>
}) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const quantity = parseInt(qty, 10)
    if (!quantity || quantity <= 0) { setError('Enter a valid quantity'); return }
    setLoading(true)
    try {
      await onConfirm({ quantity, note: note.trim() || undefined })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restock failed')
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid #e8e3d8', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }

  return (
    <>
      <div style={S.backdrop} onClick={onClose} />
      <div style={S.modal}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Restock Product</h2>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>{product.productName}</p>

        <div style={{ background: '#f7f4ef', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 24, fontSize: 13 }}>
          <div><span style={{ color: '#888' }}>Current: </span><strong>{product.availableQuantity}</strong></div>
          <div><span style={{ color: '#888' }}>Reserved: </span><strong>{product.reservedQuantity}</strong></div>
          <div><span style={{ color: '#888' }}>On Hand: </span><strong>{product.totalQuantity}</strong></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: '#555' }}>Add Quantity *</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 50" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: '#555' }}>Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Supplier delivery received" style={inputStyle} />
          </div>
          {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 14px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={loading} style={{ flex: 1, height: 44, background: '#0F0E0C', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Saving…' : qty ? `Add ${qty} units` : 'Add Stock'}
            </button>
            <button type="button" onClick={onClose} style={{ padding: '0 20px', height: 44, background: 'none', border: '1px solid #e8e3d8', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#555' }}>Cancel</button>
          </div>
        </form>
      </div>
    </>
  )
}

// ── History Drawer ─────────────────────────────────────────────────────────────

function HistoryDrawer({
  product,
  history,
  loading,
  onClose,
}: {
  product: InventoryResponse
  history: InventoryTransaction[]
  loading: boolean
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const typeColors: Record<string, string> = {
    RESTOCK: '#16a34a', ADJUSTMENT: '#2563eb', SALE: '#dc2626',
    RETURN: '#7c3aed', DAMAGE: '#6b7280',
  }

  return (
    <>
      <div style={S.backdrop} onClick={onClose} />
      <div style={{ ...S.drawer, ...(isMobile ? { width: '100vw', left: 0 } : {}) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>Stock History</h2>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{product.productName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1 }}>×</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0F0E0C', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : history.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>No stock history yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {history.map((t) => {
              const color = typeColors[t.type] ?? '#888'
              const sign = t.quantityChange >= 0 ? '+' : ''
              return (
                <div key={t.txnId ?? `txn-${t.createdAt}`} style={{ borderBottom: '1px solid #f3f4f6', padding: '14px 0', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{sign}{t.quantityChange}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase' }}>{(t.type ?? '').replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 11, color: '#aaa' }}>{new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#666', margin: '0 0 2px' }}>{t.note ?? 'No note'}</p>
                    <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>Balance after: <strong style={{ color: '#555' }}>{t.qtyAfter}</strong></p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryResponse[]>([])
  const auth = useMerchantAuth()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [restockTarget, setRestockTarget] = useState<InventoryResponse | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<InventoryResponse | null>(null)
  const [historyTarget, setHistoryTarget] = useState<InventoryResponse | null>(null)
  const [history, setHistory] = useState<InventoryTransaction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [toast, setToast] = useState('')

  const storeId = auth.storeId

  const loadInventory = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    // The backend inventory response has no product name/image, so enrich each
    // row from the store's product catalog (merge by productId).
    const [invResult, prodResult] = await Promise.all([
      inventoryService.getStoreInventory(storeId, auth.getAuthHeader()),
      productService.getStoreProducts(storeId, auth.getAuthHeader()),
    ])
    if (invResult.ok) {
      const productMap = new Map<number, { name: string; image: string | null }>()
      if (prodResult.ok) {
        for (const p of prodResult.data) {
          productMap.set(p.productId, { name: p.name, image: p.media?.[0]?.mediaUrl ?? null })
        }
      }
      setInventory(
        invResult.data.map((item) => {
          const prod = productMap.get(item.productId)
          return {
            ...item,
            productName: prod?.name ?? `Product #${item.productId}`,
            productImage: prod?.image ?? null,
          }
        })
      )
    }
    setLoading(false)
  }, [storeId, auth.getAuthHeader])

  useEffect(() => { loadInventory() }, [loadInventory])

  const summary = useMemo(() => computeInventorySummary(inventory), [inventory])

  const filtered = useMemo(() => {
    if (!search.trim()) return inventory
    const q = search.toLowerCase()
    return inventory.filter(
      (i) => (i.productName ?? '').toLowerCase().includes(q) || String(i.productId).includes(q)
    )
  }, [inventory, search])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleRestock = async (req: RestockRequest) => {
    if (!restockTarget || !storeId) return
    const result = await inventoryService.restockProduct(storeId, restockTarget.productId, req, auth.getAuthHeader())
    if (result.ok) {
      await loadInventory()
      showToast(`✓ Added ${req.quantity} units to ${restockTarget.productName}`)
    }
  }

  const handleAdjust = async (req: InventoryAdjustRequest) => {
    if (!adjustTarget) return
    const result = await inventoryService.adjustStock(req, auth.getAuthHeader())
    if (!result.ok) throw new Error(result.error)
    await loadInventory()
    const verb = req.quantity > 0 ? 'Added' : 'Removed'
    showToast(`✓ ${verb} ${Math.abs(req.quantity)} units (${req.strategyType ?? 'NORMAL'})`)
  }

  const openHistory = async (item: InventoryResponse) => {
    if (!storeId) return
    setHistoryTarget(item)
    setHistoryLoading(true)
    const result = await inventoryService.getStockHistory(storeId, item.productId, auth.getAuthHeader())
    if (result.ok) setHistory(result.data)
    setHistoryLoading(false)
  }

  return (
    <div style={S.page}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 300, background: '#0F0E0C', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Stats */}
      <div style={S.statsGrid}>
        {[
          { label: 'Total Products', value: summary.totalProducts, color: '#0F0E0C' },
          { label: 'In Stock', value: summary.totalProducts - summary.outOfStockCount - summary.lowStockCount, color: '#15803d' },
          { label: 'Low Stock', value: summary.lowStockCount, color: '#c2410c' },
          { label: 'Out of Stock', value: summary.outOfStockCount, color: '#dc2626' },
        ].map((s) => (
          <div key={s.label} style={S.statCard}>
            <p style={S.statLabel}>{s.label}</p>
            <p style={{ ...S.statValue, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          style={S.searchInput}
        />
        <button onClick={loadInventory} style={{ ...S.actionBtn, padding: '10px 16px' }}>↻ Refresh</button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0F0E0C', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '48px 24px', textAlign: 'center', border: '1px solid #ede8df' }}>
          <p style={{ color: '#aaa', fontSize: 15 }}>{search ? 'No products match your search.' : 'No inventory data yet. Add products to see stock levels.'}</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Product', 'Available', 'Reserved', 'On Hand', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.productId} style={{ transition: 'background 0.12s' }} className="inv-row">
                  <td style={S.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {item.productImage && (
                        <img src={item.productImage} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid #f0ebe1' }} />
                      )}
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{item.productName}</span>
                    </div>
                  </td>
                  <td style={{ ...S.td, fontWeight: 700, color: isOutOfStock(item) ? '#dc2626' : isLowStock(item) ? '#c2410c' : '#15803d' }}>
                    {item.availableQuantity}
                  </td>
                  <td style={{ ...S.td, color: '#888' }}>{item.reservedQuantity}</td>
                  <td style={{ ...S.td, color: '#888' }}>{item.totalQuantity}</td>
                  <td style={S.td}>{stockBadge(item)}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setRestockTarget(item)} style={{ ...S.actionBtn, color: '#0F0E0C', background: '#f7f4ef' }}>+ Restock</button>
                      <button onClick={() => setAdjustTarget(item)} style={S.actionBtn} title="Adjust for defective items, manual corrections, etc.">± Adjust</button>
                      <button onClick={() => openHistory(item)} style={S.actionBtn}>History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Restock modal */}
      {restockTarget && (
        <RestockModal
          product={restockTarget}
          onClose={() => setRestockTarget(null)}
          onConfirm={handleRestock}
        />
      )}

      {/* Adjust modal */}
      {adjustTarget && (
        <AdjustModal
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onConfirm={handleAdjust}
        />
      )}

      {/* History drawer */}
      {historyTarget && (
        <HistoryDrawer
          product={historyTarget}
          history={history}
          loading={historyLoading}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .inv-row:hover { background: #faf8f5; }
      `}</style>
    </div>
  )
}
