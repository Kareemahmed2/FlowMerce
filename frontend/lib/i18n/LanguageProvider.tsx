'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { dictionary, type Locale } from './dictionary'

interface I18nContextValue {
  locale: Locale
  dir: 'ltr' | 'rtl'
  setLocale: (l: Locale) => void
  toggleLocale: () => void
  /** Translate a key; falls back to the key itself if missing. */
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'flowmerce.locale'

function applyDocument(locale: Locale) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.lang = locale
  el.dir = locale === 'ar' ? 'rtl' : 'ltr'
}

export function LanguageProvider({
  children,
  defaultLocale = 'en',
}: {
  children: React.ReactNode
  defaultLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    const stored = (typeof window !== 'undefined'
      ? (window.localStorage.getItem(STORAGE_KEY) as Locale | null)
      : null)
    const initial = stored && (stored === 'en' || stored === 'ar') ? stored : defaultLocale
    setLocaleState(initial)
    applyDocument(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    applyDocument(l)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, l)
  }, [])

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'ar' : 'en')
  }, [locale, setLocale])

  const t = useCallback(
    (key: string) => dictionary[locale][key] ?? dictionary.en[key] ?? key,
    [locale]
  )

  const value = useMemo<I18nContextValue>(
    () => ({ locale, dir: locale === 'ar' ? 'rtl' : 'ltr', setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within a LanguageProvider')
  }
  return ctx
}
