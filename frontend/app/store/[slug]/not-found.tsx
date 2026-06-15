'use client'

import Link from 'next/link'

export default function StoreNotFound() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
      padding: '40px 24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        {/* 404 illustration */}
        <div style={{ fontSize: 80, fontWeight: 800, color: '#e5e7eb', lineHeight: 1, marginBottom: 16, letterSpacing: '-0.04em' }}>
          404
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px', color: '#1a1a1a' }}>
          Page not found
        </h1>
        <p style={{ fontSize: 15, color: '#999', margin: '0 0 28px', lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          Check the URL or head back to the store.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.history.back()}
            style={{
              background: '#f3f4f6', color: '#333',
              border: 'none', borderRadius: 10,
              padding: '12px 24px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            Go Back
          </button>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center',
            background: '#1a1a1a', color: '#fff',
            borderRadius: 10, padding: '12px 24px',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            Home Page
          </Link>
        </div>
      </div>
    </div>
  )
}
