'use client'

/**
 * Merchant wallet / earnings page.
 *
 * Features:
 *  - Store wallet balance display
 *  - Revenue stats cards
 *  - Transaction history table with type badges
 *  - Empty state for new merchants
 *
 * INT-34 resolved: useMerchantWallet calls the real backend API.
 * No component changes needed after integration.
 */

import { useMemo } from 'react'
import { useMerchantWallet } from '@/hooks/useWallet'
import { useMerchantAuth } from '@/store/auth-store'
import { TRANSACTION_TYPE_CONFIG } from '@/types/wallet.types'
import type { WalletTransactionResponse } from '@/types/wallet.types'

const S = {
  page: { padding: '8px 0 40px' } as const,
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 } as const,
  statCard: (accent: boolean) => ({ background: accent ? '#0F0E0C' : '#fff', borderRadius: 14, padding: '22px 24px', border: '1px solid #ede8df', color: accent ? '#fff' : '#0F0E0C' }),
  statLabel: (accent: boolean) => ({ fontSize: 12, color: accent ? 'rgba(255,255,255,0.6)' : '#888', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 500 }),
  statValue: { fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' } as const,
  table: { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #ede8df' },
  th: { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #f0ebe1', background: '#faf8f5' },
  td: { padding: '14px 16px', fontSize: 14, color: '#0F0E0C', borderBottom: '1px solid #f7f4ef' } as const,
}

function formatEGP(amount: number): string {
  return `EGP ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function TransactionRow({ txn }: { txn: WalletTransactionResponse }) {
  const cfg = TRANSACTION_TYPE_CONFIG[txn.type] ?? { label: txn.type, color: '#888', sign: '+' as const }
  return (
    <tr className="txn-row">
      <td style={S.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${cfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: cfg.color, flexShrink: 0 }}>
            {cfg.sign}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 2px' }}>{txn.description}</p>
            {txn.referenceId && <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>Ref: {txn.referenceId}</p>}
          </div>
        </div>
      </td>
      <td style={S.td}>
        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${cfg.color}18`, color: cfg.color }}>
          {cfg.label}
        </span>
      </td>
      <td style={{ ...S.td, fontWeight: 700, color: cfg.color, textAlign: 'right' }}>
        {cfg.sign} {formatEGP(txn.amount)}
      </td>
      <td style={{ ...S.td, color: '#888', textAlign: 'right' }}>
        {formatEGP(txn.balanceAfter)}
      </td>
      <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>
        {new Date(txn.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </td>
    </tr>
  )
}

export function WalletPage() {
  const auth = useMerchantAuth()
  const storeId = auth.storeId
  // Pass the getAuthHeader FUNCTION (stable ref), not its return value — see useWallet.ts.
  const { wallet, transactions, isLoading, error, refresh } = useMerchantWallet(storeId, auth.getAuthHeader)

  const stats = useMemo(() => {
    const credits = transactions.filter((t) => ['CREDIT', 'TOPUP', 'REFUND'].includes(t.type) || TRANSACTION_TYPE_CONFIG[t.type]?.sign === '+')
    const debits = transactions.filter((t) => TRANSACTION_TYPE_CONFIG[t.type]?.sign === '-')
    const totalIn = credits.reduce((s, t) => s + t.amount, 0)
    const totalOut = debits.reduce((s, t) => s + t.amount, 0)
    return { totalIn, totalOut, txCount: transactions.length }
  }, [transactions])

  return (
    <div style={S.page}>
      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Balance + Stats */}
      <div style={S.statsGrid}>
        <div style={S.statCard(true)}>
          <p style={S.statLabel(true)}>Store Balance</p>
          {isLoading ? (
            <div style={{ width: 120, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.1)' }} />
          ) : (
            <p style={S.statValue}>{wallet ? formatEGP(wallet.balance) : 'EGP 0.00'}</p>
          )}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '6px 0 0' }}>
            {wallet?.currency ?? 'EGP'} · FlowMerce Wallet
          </p>
        </div>
        <div style={S.statCard(false)}>
          <p style={S.statLabel(false)}>Total Revenue</p>
          <p style={S.statValue}>{formatEGP(stats.totalIn)}</p>
          <p style={{ fontSize: 12, color: '#15803d', margin: '6px 0 0' }}>All-time earnings</p>
        </div>
        <div style={S.statCard(false)}>
          <p style={S.statLabel(false)}>Total Paid Out</p>
          <p style={S.statValue}>{formatEGP(stats.totalOut)}</p>
          <p style={{ fontSize: 12, color: '#888', margin: '6px 0 0' }}>Refunds + payouts</p>
        </div>
        <div style={S.statCard(false)}>
          <p style={S.statLabel(false)}>Transactions</p>
          <p style={S.statValue}>{stats.txCount}</p>
          <p style={{ fontSize: 12, color: '#888', margin: '6px 0 0' }}>All time</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#0F0E0C' }}>Transaction History</h2>
        <button onClick={refresh} style={{ background: 'none', border: '1px solid #e8e3d8', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#555' }}>
          ↻ Refresh
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0F0E0C', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : transactions.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '56px 24px', textAlign: 'center', border: '1px solid #ede8df' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>No transactions yet</p>
          <p style={{ color: '#aaa', fontSize: 14, margin: 0 }}>Revenue from completed orders will appear here.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Description', 'Type', 'Amount', 'Balance After', 'Date'].map((h) => (
                  <th key={h} style={{ ...S.th, textAlign: ['Amount', 'Balance After'].includes(h) ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => <TransactionRow key={txn.transactionId} txn={txn} />)}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .txn-row:hover td { background: #faf8f5; }
      `}</style>
    </div>
  )
}
