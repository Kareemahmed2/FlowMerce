'use client'

import type { ReactNode } from 'react'
import { S } from './settings-styles'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div style={S.field}>
      <label style={S.label}>{label}</label>
      {children}
      {hint && !error ? <p style={S.hint}>{hint}</p> : null}
      {error ? <p style={S.errorMsg}>{error}</p> : null}
    </div>
  )
}

export function Toggle({
  value,
  onChange,
  label,
  sub,
  disabled,
}: {
  value: boolean
  onChange: (v: boolean) => void
  label: string
  sub?: string
  disabled?: boolean
}) {
  return (
    <div style={S.toggleRow}>
      <div style={{ flex: 1 }}>
        <p style={S.toggleLabel}>{label}</p>
        {sub ? <p style={S.toggleSub}>{sub}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        style={{ ...S.toggleBtn, ...(value ? S.toggleBtnOn : S.toggleBtnOff), ...(disabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
        onClick={() => onChange(!value)}
      >
        <span style={{ ...S.toggleThumb, ...(value ? S.toggleThumbOn : {}) }} />
      </button>
    </div>
  )
}

export function SectionCard({
  title,
  sub,
  children,
}: {
  title: string
  sub?: string
  children: ReactNode
}) {
  return (
    <div style={S.sectionCard}>
      <div style={S.sectionCardHeader}>
        <p style={S.sectionCardTitle}>{title}</p>
        {sub ? <p style={S.sectionCardSub}>{sub}</p> : null}
      </div>
      <div style={S.sectionCardBody}>{children}</div>
    </div>
  )
}
