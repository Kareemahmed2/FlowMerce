import React from 'react'
import type { Metadata } from 'next'
import { MerchantAuthProvider } from '@/store/auth-store'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { Toaster } from 'sonner'
import NotificationListener from '@/components/NotificationListener'

import './globals.css'

export const metadata: Metadata = {
  title: 'FlowMerce',
  description:
    'Create and manage your e-commerce store — onboarding, dashboard, and storefront.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
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
