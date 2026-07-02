import React from 'react'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { MerchantAuthProvider } from '@/store/auth-store'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { Toaster } from 'sonner'
import NotificationListener from '@/components/NotificationListener'

import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'FlowMerce',
  description:
    'Create and manage your e-commerce store — onboarding, dashboard, and storefront.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" dir="ltr">
      <body className={`${inter.className} font-sans antialiased`}>
        {/*
          LanguageProvider drives <html lang/dir> for bilingual AR/EN + RTL.
          MerchantAuthProvider lives here so all pages (login, dashboard, onboarding)
          share the same role-aware session state.
          CustomerAuthProvider remains scoped to /store/[slug] in that layout.
        */}
        <LanguageProvider>
          <MerchantAuthProvider>
            <Toaster position="top-right" richColors />
            <NotificationListener />
            {children}
          </MerchantAuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
