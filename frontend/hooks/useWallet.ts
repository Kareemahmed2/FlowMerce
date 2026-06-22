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
// Takes the stable getAuthHeader FUNCTION (from useCustomerAuth()), not its
// return value — that function builds a fresh header object on every call,
// so using the object itself as an effect dependency caused an infinite
// fetch loop (new object -> effect reruns -> setState -> rerender -> ...).
export function useWallet(getAuthHeader?: () => Record<string, string>): WalletState {
  const [wallet, setWallet] = useState<WalletResponse | null>(null)
  const [transactions, setTransactions] = useState<WalletTransactionResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTopUpLoading, setIsTopUpLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchWallet = useCallback(async () => {
    setIsLoading(true)
    setError('')
    const result = await walletService.getMyWallet(getAuthHeader?.())
    setIsLoading(false)
    if (result.ok) setWallet(result.data)
    else setError(result.error)
  }, [getAuthHeader])

  const fetchTransactions = useCallback(async () => {
    const result = await walletService.getMyTransactions(getAuthHeader?.())
    if (result.ok) setTransactions(result.data)
    else setError(result.error)
  }, [getAuthHeader])

  // Initial load — both calls in parallel
  useSafeEffect((isMounted) => {
    setIsLoading(true)
    Promise.all([
      walletService.getMyWallet(getAuthHeader?.()),
      walletService.getMyTransactions(getAuthHeader?.()),
    ]).then(([wResult, txResult]) => {
      if (!isMounted()) return
      setIsLoading(false)
      if (wResult.ok) setWallet(wResult.data)
      else setError(wResult.error)
      if (txResult.ok) setTransactions(txResult.data)
      else if (!wResult.ok) setError(txResult.error)
    })
  }, [getAuthHeader])

  const topUp = useCallback(async (amount: number): Promise<{ ok: boolean; message: string }> => {
    setIsTopUpLoading(true)
    const result = await walletService.topUpWallet({ amount }, getAuthHeader?.())
    if (!result.ok) {
      setIsTopUpLoading(false)
      return { ok: false, message: result.error }
    }
    setWallet(result.data)
    const txResult = await walletService.getMyTransactions(getAuthHeader?.())
    if (txResult.ok) setTransactions(txResult.data)
    setIsTopUpLoading(false)
    return { ok: true, message: `EGP ${amount.toFixed(2)} added to your wallet.` }
  }, [getAuthHeader])

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
  getAuthHeader?: () => Record<string, string>
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
      walletService.getStoreWallet(storeId, getAuthHeader?.()),
      walletService.getStoreTransactions(storeId, getAuthHeader?.()),
    ])
    setIsLoading(false)
    if (wResult.ok) setWallet(wResult.data)
    else setError(wResult.error)
    if (txResult.ok) setTransactions(txResult.data)
    else if (!wResult.ok) setError(txResult.error)
  }, [storeId, getAuthHeader])

  useSafeEffect((isMounted) => {
    if (!storeId) return
    setIsLoading(true)
    Promise.all([
      walletService.getStoreWallet(storeId, getAuthHeader?.()),
      walletService.getStoreTransactions(storeId, getAuthHeader?.()),
    ]).then(([wResult, txResult]) => {
      if (!isMounted()) return
      setIsLoading(false)
      if (wResult.ok) setWallet(wResult.data)
      else setError(wResult.error)
      if (txResult.ok) setTransactions(txResult.data)
      else if (!wResult.ok) setError(txResult.error)
    })
  }, [storeId, getAuthHeader])

  return { wallet, transactions, isLoading, error, refresh: load }
}
