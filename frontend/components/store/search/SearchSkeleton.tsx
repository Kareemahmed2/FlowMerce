/**
 * Loading skeleton for the search page.
 * Used as the Suspense fallback — must NOT use any context hooks (no store colors).
 */
export default function SearchSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading search results"
      style={{ minHeight: '70vh', background: '#f9f9f9' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 64px' }}>
        {/* Search bar skeleton */}
        <div style={{ height: 52, background: '#e5e7eb', borderRadius: 12, marginBottom: 28, maxWidth: 800, animation: 'pulse 1.5s ease-in-out infinite' }} />

        {/* Toolbar skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ width: 160, height: 20, background: '#e5e7eb', borderRadius: 6 }} />
          <div style={{ width: 140, height: 36, background: '#e5e7eb', borderRadius: 8 }} />
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
          {/* Filter skeleton */}
          <div style={{ background: '#e5e7eb', borderRadius: 12, height: 360 }} />

          {/* Results skeleton */}
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 20,
            }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ background: '#e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ aspectRatio: '1', background: '#d1d5db' }} />
                  <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ height: 12, background: '#d1d5db', borderRadius: 4, width: '60%' }} />
                    <div style={{ height: 16, background: '#d1d5db', borderRadius: 4 }} />
                    <div style={{ height: 12, background: '#d1d5db', borderRadius: 4, width: '40%' }} />
                    <div style={{ height: 36, background: '#d1d5db', borderRadius: 8, marginTop: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.5 }
        }
        [aria-busy="true"] * { animation: pulse 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
