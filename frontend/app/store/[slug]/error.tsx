'use client'

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
        {/* Error icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px', color: '#1a1a1a' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 15, color: '#999', margin: '0 0 8px', lineHeight: 1.6 }}>
          An unexpected error occurred while loading this page.
          Please try again or go back to the store.
        </p>
        {error.digest && (
          <p style={{ fontSize: 12, color: '#ccc', margin: '0 0 24px', fontFamily: 'monospace' }}>
            Error ID: {error.digest}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => reset()}
            style={{
              background: '#ef4444', color: '#fff',
              border: 'none', borderRadius: 10,
              padding: '12px 24px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', transition: 'opacity 0.2s',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.history.back()}
            style={{
              background: '#f3f4f6', color: '#333',
              border: 'none', borderRadius: 10,
              padding: '12px 24px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
