'use client'

import { useI18n } from '@/lib/i18n/LanguageProvider'

/**
 * Compact EN/AR switch. Drop into any top bar / header.
 * Flipping to AR sets <html dir="rtl"> globally via the provider.
 */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n()

  return (
    <div
      className={`inline-flex items-center rounded-full border border-border bg-card p-0.5 text-xs font-semibold ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          locale === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale('ar')}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          locale === 'ar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        ع
      </button>
    </div>
  )
}
