'use client'

import { S } from './dashboard-styles'

export function DashboardComingSoon({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={S.comingSoon}>
      <span style={{ fontSize: 36, opacity: 0.15 }}>{icon}</span>
      <p style={S.comingSoonText}>{label} page coming soon</p>
      <p style={S.comingSoonSub}>This section is under construction.</p>
    </div>
  )
}
