/**
 * Loading skeleton for the orders list page.
 * Used as the Suspense fallback — must NOT use any context hooks.
 */
export default function OrdersSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading orders" style={{ minHeight: '60vh', background: '#f9f9f9' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 24px 64px' }}>
        {/* Heading */}
        <div style={{ width: 180, height: 28, background: '#e5e7eb', borderRadius: 8, marginBottom: 24 }} />

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ width: 80, height: 34, background: '#e5e7eb', borderRadius: 8 }} />
          ))}
        </div>

        {/* Order cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ background: '#e5e7eb', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ width: 100, height: 16, background: '#d1d5db', borderRadius: 4 }} />
                  <div style={{ width: 80, height: 12, background: '#d1d5db', borderRadius: 4 }} />
                </div>
                <div style={{ width: 80, height: 24, background: '#d1d5db', borderRadius: 20 }} />
              </div>
              <div style={{ width: '70%', height: 14, background: '#d1d5db', borderRadius: 4, marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 100, height: 34, background: '#d1d5db', borderRadius: 8 }} />
                <div style={{ width: 80, height: 34, background: '#d1d5db', borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        [aria-busy="true"] > * { animation: ords-pulse 1.5s ease-in-out infinite; }
        @keyframes ords-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  )
}
