'use client'

type Row = { day: string; revenue: number; orders: number }

export function RevenueChart({
  data,
  activeMetric,
}: {
  data: Row[]
  activeMetric: string
}) {
  const values = data.map((d) => (activeMetric === 'orders' ? d.orders : d.revenue))
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const W = 560
  const H = 140
  const PAD = 12
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2)
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2)
    return [x, y] as const
  })
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 140, display: 'block' }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B5905A" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#B5905A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGrad)" />
      <path
        d={linePath}
        fill="none"
        stroke="#B5905A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#FFFFFF" stroke="#B5905A" strokeWidth="2" />
      ))}
    </svg>
  )
}
