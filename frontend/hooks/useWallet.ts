'use client'

/**
 * useWallet / useMerchantWallet — wallet state and top-up actions.
 *
 * Consumes walletService which returns ApiResult<T> — no throws,
 * all error handling is explicit via result.ok checks.
 *
 * TODO(BACKEND-INTEGRATION): No changes to this hook needed after integration.
 * Only walletService method bodies change (httpClient calls replace mock logic).
 */

import { useCallback, useState } from 'react'
import { walletService } from '@/services/wallet.service'
import { useSafeEffect } from '@/lib/react/use-safe-effect'
import type { WalletResponse, WalletState, WalletTransactionResponse } from '@/types/wallet.types'

// ── Customer wallet ────────────────────────────────────────────────────────────

// INT-35: customer wallet endpoints require a BUYER token.
// Pass authHeaders from useCustomerAuth().getAuthHeader() at the call site.
export function useWallet(authHeaders?: Record<string, string>): WalletState {
  const [wallet, setWallet] = useState<WalletResponse | null>(null)
  const [transactions, setTransactions] = useState<WalletTransactionResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTopUpLoading, setIsTopUpLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchWallet = useCallback(async () => {
    setIsLoading(true)
    setError('')
    const result = await walletService.getMyWallet(authHeaders)
    setIsLoading(false)
    if (result.ok) setWallet(result.data)
    else setError(result.error)
  }, [authHeaders])

  const fetchTransactions = useCallback(async () => {
    const result = await walletService.getMyTransactions(authHeaders)
    if (result.ok) setTransactions(result.data)
    else setError(result.error)
  }, [authHeaders])

  // Initial load — both calls in parallel
  useSafeEffect((isMounted) => {
    setIsLoading(true)
    Promise.all([
      walletService.getMyWallet(authHeaders),
      walletService.getMyTransactions(authHeaders),
    ]).then(([wResult, txResult]) => {
      if (!isMounted()) return
      setIsLoading(false)
      if (wResult.ok) setWallet(wResult.data)
      else setError(wResult.error)
      if (txResult.ok) setTransactions(txResult.data)
      else if (!wResult.ok) setError(txResult.error)
    })
  }, [authHeaders])

  const topUp = useCallback(async (amount: number): Promise<{ ok: boolean; message: string }> => {
    setIsTopUpLoading(true)
    const result = await walletService.topUpWallet({ amount }, authHeaders)
    if (!result.ok) {
      setIsTopUpLoading(false)
      return { ok: false, message: result.error }
    }
    setWallet(result.data)
    const txResult = await walletService.getMyTransactions(authHeaders)
    if (txResult.ok) setTransactions(txResult.data)
    setIsTopUpLoading(false)
    return { ok: true, message: `EGP ${amount.toFixed(2)} added to your wallet.` }
  }, [authHeaders])

  return { wallet, transactions, isLoading, isTopUpLoading, error, fetchWallet, fetchTransactions, topUp }
}

// ── Merchant wallet ────────────────────────────────────────────────────────────

export interface MerchantWalletState {
  wallet: WalletResponse | null
  transactions: WalletTransactionResponse[]
  isLoading: boolean
  error: string
  refresh: () => Promise<void>
}

export function useMerchantWallet(
  storeId: number | null,
  authHeaders?: Record<string, string>
): MerchantWalletState {
  const [wallet, setWallet] = useState<WalletResponse | null>(null)
  const [transactions, setTransactions] = useState<WalletTransactionResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!storeId) return
    setIsLoading(true)
    setError('')
    const [wResult, txResult] = await Promise.all([
      walletService.getStoreWallet(storeId, authHeaders),
      walletService.getStoreTransactions(storeId, authHeaders),
    ])
    setIsLoading(false)
    if (wResult.ok) setWallet(wResult.data)
    else setError(wResult.error)
    if (txResult.ok) setTransactions(txResult.data)
    else if (!wResult.ok) setError(txResult.error)
  }, [storeId, authHeaders])

  useSafeEffect((isMounted) => {
    if (!storeId) return
    setIsLoading(true)
    Promise.all([
      walletService.getStoreWallet(storeId, authHeaders),
      walletService.getStoreTransactions(storeId, authHeaders),
    ]).then(([wResult, txResult]) => {
      if (!isMounted()) return
      setIsLoading(false)
      if (wResult.ok) setWallet(wResult.data)
      else setError(wResult.error)
      if (txResult.ok) setTransactions(txResult.data)
      else if (!wResult.ok) setError(txResult.error)
    })
  }, [storeId])

  return { wallet, transactions, isLoading, error, refresh: load }
}
