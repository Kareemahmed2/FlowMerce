'use client'

/**
 * Customer wallet page.
 * Route: /store/[slug]/account/wallet
 *
 * Features:
 *  - Balance display with currency
 *  - Top-up modal (simulated — no real payment gateway needed)
 *  - Transaction history with type badges
 *  - Auth guard (redirect to login if not logged in)
 *
 * TODO(BACKEND-INTEGRATION): No page changes needed — all data comes through
 * useWallet() which calls walletService. Just ensure customer JWT is attached
 * via the httpClient interceptor.
 */

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useStore } from '@/components/store/StoreProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { textOnBg, formatPrice } from '@/components/store/store-types'
import { useWallet } from '@/hooks/useWallet'
import { TRANSACTION_TYPE_CONFIG } from '@/types/wallet.types'

const TOP_UP_AMOUNTS = [100, 250, 500, 1000, 2000, 5000]

export default function WalletPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const store = useStore()
  const auth = useCustomerAuth()
  // INT-35: pass auth header so wallet endpoints get the BUYER JWT.
  const { wallet, transactions, isLoading, isTopUpLoading, error, topUp } = useWallet(
    auth.isLoggedIn ? auth.getAuthHeader() : undefined
  )

  const base = `/store/${slug}`
  const accent = store.colors.accent

  const [showTopUp, setShowTopUp] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState<number | ''>('')
  const [topUpResult, setTopUpResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Auth guard
  if (!auth.isLoggedIn) {
    return (
      <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>Please sign in</h2>
          <p style={{ color: '#999', fontSize: 14, margin: '0 0 20px' }}>You need to be logged in to view your wallet.</p>
          <Link href={`${base}/login`} style={{ display: 'inline-block', background: accent, color: textOnBg(accent), padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
        </div>
      </div>
    )
  }

  const handleTopUp = async () => {
    if (!topUpAmount || topUpAmount <= 0) return
    const result = await topUp(Number(topUpAmount))
    setTopUpResult(result)
    if (result.ok) {
      setTopUpAmount('')
      setTimeout(() => { setTopUpResult(null); setShowTopUp(false) }, 2000)
    }
  }

  return (
    <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px 64px' }}>

        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 13, color: '#999' }}>
          <Link href={base} style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
          <span>/</span>
          <Link href={`${base}/profile`} style={{ color: '#999', textDecoration: 'none' }}>Account</Link>
          <span>/</span>
          <span style={{ color: store.colors.text, fontWeight: 500 }}>Wallet</span>
        </nav>

        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 28px', letterSpacing: '-0.02em' }}>My Wallet</h1>

        {/* Balance card */}
        <div style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
          borderRadius: 20, padding: '36px 32px', color: textOnBg(accent),
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 20, marginBottom: 28,
          boxShadow: `0 8px 32px ${accent}40`,
        }}>
          <div>
            <p style={{ fontSize: 13, opacity: 0.8, margin: '0 0 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Available Balance</p>
            {isLoading ? (
              <div style={{ width: 160, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.2)' }} />
            ) : (
              <p style={{ fontSize: 40, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
                {wallet ? formatPrice(wallet.balance) : 'EGP 0.00'}
              </p>
            )}
            <p style={{ fontSize: 13, opacity: 0.7, margin: '8px 0 0' }}>
              {wallet?.currency ?? 'EGP'} · FlowMerce Wallet
            </p>
          </div>

          <button
            onClick={() => { setShowTopUp(true); setTopUpResult(null) }}
            style={{
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
              color: 'inherit', borderRadius: 12, padding: '12px 24px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)',
              transition: 'background 0.2s',
            }}
          >
            + Top Up Wallet
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Transactions */}
        <div style={{ background: store.colors.card, borderRadius: 16, border: '1px solid #00000008', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Transaction History</h2>
          </div>

          {isLoading ? (
            <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <p style={{ color: '#999', fontSize: 14, margin: 0 }}>No transactions yet. Top up your wallet to get started.</p>
            </div>
          ) : (
            <div>
              {transactions.map((txn) => {
                const cfg = TRANSACTION_TYPE_CONFIG[txn.type] ?? { label: txn.type, color: '#666', sign: '+' as const }
                return (
                  <div
                    key={txn.transactionId}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 24px', borderBottom: '1px solid #f9fafb',
                      transition: 'background 0.15s',
                    }}
                    className="txn-row"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Icon circle */}
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: `${cfg.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16,
                      }}>
                        {cfg.sign === '+' ? '↑' : '↓'}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 2px' }}>{txn.description}</p>
                        <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
                          {new Date(txn.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px', color: cfg.color }}>
                        {cfg.sign} {formatPrice(txn.amount)}
                      </p>
                      <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
                        Balance: {formatPrice(txn.balanceAfter)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top-up modal */}
      {showTopUp && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowTopUp(false) }}
        >
          <div style={{
            background: store.colors.card, borderRadius: 20, padding: 32,
            width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Top Up Wallet</h2>
            <p style={{ fontSize: 13, color: '#999', margin: '0 0 24px' }}>
              Add funds to your FlowMerce Wallet (simulated — no real payment)
            </p>

            {/* Quick amounts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {TOP_UP_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopUpAmount(amt)}
                  style={{
                    padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    border: topUpAmount === amt ? `2px solid ${accent}` : '1px solid #e5e7eb',
                    background: topUpAmount === amt ? `${accent}10` : 'transparent',
                    color: topUpAmount === amt ? accent : store.colors.text,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  EGP {amt.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6, color: '#666' }}>
                Or enter a custom amount (EGP)
              </label>
              <input
                type="number"
                min={1}
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 750"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Result message */}
            {topUpResult && (
              <div style={{
                padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13,
                background: topUpResult.ok ? '#f0fdf4' : '#fef2f2',
                color: topUpResult.ok ? '#16a34a' : '#dc2626',
              }}>
                {topUpResult.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleTopUp}
                disabled={!topUpAmount || Number(topUpAmount) <= 0 || isTopUpLoading}
                style={{
                  flex: 1, height: 48, background: accent, color: textOnBg(accent),
                  border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
                  cursor: !topUpAmount || isTopUpLoading ? 'not-allowed' : 'pointer',
                  opacity: !topUpAmount ? 0.5 : 1, transition: 'opacity 0.2s',
                }}
              >
                {isTopUpLoading ? 'Processing…' : topUpAmount ? `Add EGP ${Number(topUpAmount).toLocaleString()}` : 'Add Funds'}
              </button>
              <button
                onClick={() => setShowTopUp(false)}
                style={{
                  padding: '0 20px', height: 48, background: 'none',
                  border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14,
                  fontWeight: 500, cursor: 'pointer', color: '#666',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .txn-row:hover { background: #fafafa; }
      `}</style>
    </div>
  )
}
