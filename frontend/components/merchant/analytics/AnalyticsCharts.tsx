'use client'

import type { DailyPoint } from '@/lib/local-store/analytics-from-orders'

export type ChartMetric = 'revenue' | 'orders' | 'visitors' | 'conversion'

type BarChartProps = {
  data: DailyPoint[]
  metric: ChartMetric
}

export function BarChart({ data, metric }: BarChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ height: 184, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AAA', fontSize: 12 }}>
        No data
      </div>
    )
  }

  const values = data.map((d) => d[metric])
  const max = Math.max(...values, 1)
  const W = 560
  const H = 160
  const PAD = 8
  const barW = Math.max(4, (W - PAD * 2) / Math.max(values.length, 1) - 4)

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 24}`}
      style={{ width: '100%', display: 'block' }}
      preserveAspectRatio="none"
    >
      {values.map((v, i) => {
        const bh = Math.max(2, (v / max) * H)
        const x = PAD + i * ((W - PAD * 2) / Math.max(values.length, 1)) + 2
        const y = H - bh
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx={3} fill="#B5905A" opacity={0.85} />
            {data.length <= 10 && (
              <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize={10} fill="#AAA">
                {data[i]?.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

type LineChartProps = {
  data: DailyPoint[]
  metric: ChartMetric
  color?: string
}

export function LineChart({ data, metric, color = '#B5905A' }: LineChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AAA', fontSize: 12 }}>
        No data
      </div>
    )
  }

  const values = data.map((d) => d[metric])
  const max = Math.max(...values, 1)
  const min = Math.min(...values)
  const range = max - min || 1
  const W = 560
  const H = 120
  const PAD = 8
  const denom = Math.max(values.length - 1, 1)

  const pts = values.map((v, i) => [
    PAD + (i / denom) * (W - PAD * 2),
    PAD + (1 - (v - min) / range) * (H - PAD * 2),
  ]) as [number, number][]

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  const area =
    last && first
      ? `${line} L${last[0]},${H} L${first[0]},${H} Z`
      : line

  const gradId = `lg_${metric}_${color.replace('#', '')}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 120, display: 'block' }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.12} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#FFF" stroke={color} strokeWidth={1.5} />
      ))}
    </svg>
  )
}
