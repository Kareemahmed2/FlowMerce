'use client'

/**
 * Merchant payments management page.
 *
 * Features:
 *  - Payment list with status badges
 *  - Confirm COD / bank transfer payments
 *  - Issue refunds with amount + reason
 *  - Payment detail drawer
 *  - Filter by status
 *
 * INT-34 resolved: paymentService calls the real backend API.
 * No component changes needed after integration.
 */

import { useCallback, useEffect, useState } from 'react'
import { paymentService } from '@/services/payment.service'
import { useMerchantAuth } from '@/store/auth-store'
import { PAYMENT_STATUS_CONFIG, getPaymentMethodLabel } from '@/types/payment.types'
import type { PaymentResponse, PaymentStatus, RefundRequest, ConfirmPaymentRequest } from '@/types/payment.types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function methodLabel(method: string): string {
  return getPaymentMethodLabel(method)
}

function formatEGP(n: number) {
  return `EGP ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = {
  page: { padding: '8px 0 40px' } as const,
  toolbar: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' },
  filterBtn: (active: boolean) => ({ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: active ? '2px solid #0F0E0C' : '1px solid #e8e3d8', background: active ? '#0F0E0C' : '#fff', color: active ? '#fff' : '#555', cursor: 'pointer', transition: 'all 0.15s' }),
  table: { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #ede8df' },
  th: { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #f0ebe1', background: '#faf8f5' },
  td: { padding: '14px 16px', fontSize: 13, color: '#0F0E0C', borderBottom: '1px solid #f7f4ef' } as const,
  actionBtn: (variant: 'confirm' | 'refund' | 'view') => {
    const styles = {
      confirm: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
      refund: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
      view: { background: '#f7f4ef', color: '#555', border: '1px solid #e8e3d8' },
    }
    return { ...styles[variant], borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s' }
  },
  backdrop: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 },
  modal: { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  drawer: { position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: 420, background: '#fff', zIndex: 201, boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', overflowY: 'auto' as const, padding: 28 },
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  payment,
  onClose,
  onConfirm,
}: {
  payment: PaymentResponse
  onClose: () => void
  onConfirm: (req: ConfirmPaymentRequest) => Promise<void>
}) {
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid #e8e3d8', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }

  return (
    <>
      <div style={S.backdrop} onClick={onClose} />
      <div style={S.modal}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Confirm Payment</h2>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>
          Order #{payment.orderId} · {formatEGP(payment.amount)} · {methodLabel(payment.paymentMethod)}
        </p>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: '#555' }}>Reference Number (optional)</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Bank transaction ID" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: '#555' }}>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer confirmed cash delivery" style={inputStyle} />
        </div>
        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 14px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={async () => { setLoading(true); try { await onConfirm({ reference: reference || undefined, note: note || undefined }); onClose() } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setLoading(false) } }}
            disabled={loading}
            style={{ flex: 1, height: 44, background: '#15803d', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Confirming…' : '✓ Confirm Payment'}
          </button>
          <button onClick={onClose} style={{ padding: '0 20px', height: 44, background: 'none', border: '1px solid #e8e3d8', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#555' }}>Cancel</button>
        </div>
      </div>
    </>
  )
}

// ── Refund Modal ──────────────────────────────────────────────────────────────

function RefundModal({
  payment,
  onClose,
  onRefund,
}: {
  payment: PaymentResponse
  onClose: () => void
  onRefund: (req: RefundRequest) => Promise<void>
}) {
  const [amount, setAmount] = useState(String(payment.amount))
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid #e8e3d8', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }

  return (
    <>
      <div style={S.backdrop} onClick={onClose} />
      <div style={S.modal}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Issue Refund</h2>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>Order #{payment.orderId} · Paid: {formatEGP(payment.amount)}</p>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: '#555' }}>Refund Amount (EGP) *</label>
          <input type="number" min={0.01} max={payment.amount} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
          <p style={{ fontSize: 12, color: '#aaa', margin: '4px 0 0' }}>Max: {formatEGP(payment.amount)}</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: '#555' }}>Reason *</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer requested refund" style={inputStyle} />
        </div>
        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 14px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={async () => {
              if (!reason.trim()) { setError('Reason is required'); return }
              const n = parseFloat(amount)
              if (!n || n <= 0 || n > payment.amount) { setError('Invalid amount'); return }
              setLoading(true)
              try { await onRefund({ amount: n, reason }); onClose() }
              catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setLoading(false) }
            }}
            disabled={loading}
            style={{ flex: 1, height: 44, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Processing…' : 'Issue Refund'}
          </button>
          <button onClick={onClose} style={{ padding: '0 20px', height: 44, background: 'none', border: '1px solid #e8e3d8', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#555' }}>Cancel</button>
        </div>
      </div>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<PaymentStatus | 'ALL'> = ['ALL', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']

export function PaymentsPage() {
  const auth = useMerchantAuth()
  const [payments, setPayments] = useState<PaymentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<PaymentStatus | 'ALL'>('ALL')
  const [confirmTarget, setConfirmTarget] = useState<PaymentResponse | null>(null)
  const [refundTarget, setRefundTarget] = useState<PaymentResponse | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadPayments = useCallback(async () => {
    if (!auth.storeId) return
    setLoading(true)
    const result = await paymentService.getStorePayments(auth.storeId, auth.getAuthHeader())
    if (result.ok) setPayments(result.data)
    setLoading(false)
  }, [auth.storeId, auth.getAuthHeader])

  useEffect(() => { loadPayments() }, [loadPayments])

  const filtered = filter === 'ALL' ? payments : payments.filter((p) => p.status === filter)

  const handleConfirm = async (req: ConfirmPaymentRequest) => {
    if (!confirmTarget) return
    // INT-16: MERCHANT endpoint requires auth header.
    const result = await paymentService.confirmPayment(confirmTarget.paymentId, req, auth.getAuthHeader())
    if (result.ok) {
      setPayments((prev) => prev.map((p) => p.paymentId === result.data.paymentId ? result.data : p))
      showToast('✓ Payment confirmed')
    }
  }

  const handleRefund = async (req: RefundRequest) => {
    if (!refundTarget) return
    // INT-17: MERCHANT endpoint requires auth header.
    const result = await paymentService.refundPayment(refundTarget.paymentId, req, auth.getAuthHeader())
    if (result.ok) {
      setPayments((prev) => prev.map((p) => p.paymentId === result.data.paymentId ? result.data : p))
      showToast('↩ Refund issued')
    }
  }

  return (
    <div style={S.page}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 300, background: '#0F0E0C', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Filter pills */}
      <div style={S.toolbar}>
        {STATUS_FILTERS.map((s) => (
          <button key={s} style={S.filterBtn(filter === s)} onClick={() => setFilter(s)}>
            {s === 'ALL' ? 'All Payments' : (PAYMENT_STATUS_CONFIG[s as PaymentStatus]?.label ?? s)}
            {s !== 'ALL' && ` (${payments.filter((p) => p.status === s).length})`}
          </button>
        ))}
        <button onClick={loadPayments} style={{ ...S.filterBtn(false), marginLeft: 'auto' }}>↻ Refresh</button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0F0E0C', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '48px 24px', textAlign: 'center', border: '1px solid #ede8df' }}>
          <p style={{ color: '#aaa', fontSize: 15 }}>No payments found.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Payment ID', 'Order', 'Method', 'Amount', 'Status', 'Date', 'Actions'].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const cfg = PAYMENT_STATUS_CONFIG[p.status] ?? { label: p.status, bg: '#f3f4f6', color: '#555', border: '#d1d5db' }
                const canConfirm = p.status === 'PENDING' && (p.paymentMethod === 'COD' || p.paymentMethod === 'BANK_TRANSFER')
                const canRefund = p.status === 'COMPLETED'
                return (
                  <tr key={p.paymentId} className="pmt-row">
                    <td style={{ ...S.td, color: '#888', fontSize: 12 }}>#{p.paymentId}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>Order #{p.orderId}</td>
                    <td style={S.td}>{methodLabel(p.paymentMethod)}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{formatEGP(p.amount)}</td>
                    <td style={S.td}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>
                      {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canConfirm && <button style={S.actionBtn('confirm')} onClick={() => setConfirmTarget(p)}>Confirm</button>}
                        {canRefund && <button style={S.actionBtn('refund')} onClick={() => setRefundTarget(p)}>Refund</button>}
                        {!canConfirm && !canRefund && <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmTarget && (
        <ConfirmModal payment={confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={handleConfirm} />
      )}
      {refundTarget && (
        <RefundModal payment={refundTarget} onClose={() => setRefundTarget(null)} onRefund={handleRefund} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pmt-row:hover td { background: #faf8f5; }
      `}</style>
    </div>
  )
}
