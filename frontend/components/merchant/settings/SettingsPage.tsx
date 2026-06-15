'use client'

import type {
  MerchantSettingsState,
  NotificationsSettingsSlice,
  ShippingSettingsSlice,
  StoreSettingsSlice,
  TaxSettingsSlice,
} from '@/lib/local-store/settings-types'
import {
  clearAllLocalMerchantData,
  exportAllLocalData,
  loadMerchantSettings,
  saveMerchantSettings,
} from '@/lib/local-store/settings-storage'
import { patchPersistedStore } from '@/lib/local-store/store'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SETTINGS_SECTIONS, type SettingsSectionId } from './settings-constants'
import { S } from './settings-styles'
import { useMerchantAuth } from '@/store/auth-store'
import { merchantService } from '@/services/merchant.service'
import { storeService } from '@/services/store.service'
import { userService } from '@/services/user.service'
import { uploadService } from '@/services/upload.service'
import { PAYMENT_METHOD_CONFIG, toBackendPaymentMethod } from '@/types/payment.types'
import type { BackendPaymentMethod } from '@/types/payment.types'

function Field({
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

function Toggle({
  value,
  onChange,
  label,
  sub,
}: {
  value: boolean
  onChange: (v: boolean) => void
  label: string
  sub?: string
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
        style={{ ...S.toggleBtn, ...(value ? S.toggleBtnOn : S.toggleBtnOff) }}
        onClick={() => onChange(!value)}
      >
        <span style={{ ...S.toggleThumb, ...(value ? S.toggleThumbOn : {}) }} />
      </button>
    </div>
  )
}

function SectionCard({
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

function StoreInfoSection({
  data,
  onChange,
  authHeaders,
}: {
  data: StoreSettingsSlice
  onChange: (v: StoreSettingsSlice) => void
  authHeaders?: Record<string, string>
}) {
  const logoRef = useRef<HTMLInputElement>(null)
  const [logoHover, setLogoHover] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    onChange({ ...data, logo: localUrl })
    setLogoUploading(true)
    const result = await uploadService.uploadImage(file, authHeaders ?? {})
    setLogoUploading(false)
    if (result.ok) {
      URL.revokeObjectURL(localUrl)
      onChange({ ...data, logo: result.data.url })
    }
    // On failure, keep local blob URL for this session
  }

  const placeholder = ((data.name ?? '').slice(0, 2) || '◈').toUpperCase()

  return (
    <>
      <SectionCard title="Brand Identity" sub="Your store's public-facing name and logo.">
        <div style={S.logoRow}>
          <div
            style={S.logoWrap}
            onClick={() => logoRef.current?.click()}
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
          >
            {data.logo ? (
              <img src={data.logo} style={S.logoImg} alt="Logo" />
            ) : (
              <div style={S.logoPlaceholder}>{placeholder}</div>
            )}
            <div style={{ ...S.logoOverlay, opacity: logoHover ? 1 : 0 }}>Edit</div>
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { void handleLogo(e) }}
          />
          <div style={{ flex: 1 }}>
            <Field label="Store Name">
              <input
                style={S.input}
                value={data.name}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <Field
          label="Store URL"
          hint={`Your store will be at https://${data.url || 'your-store'}.flowmerce.io`}
        >
          <div style={S.urlInput}>
            <span style={S.urlPrefix}>flowmerce.io/</span>
            <input
              style={{ ...S.input, borderLeft: 'none', borderRadius: '0 8px 8px 0', flex: 1 }}
              value={data.url}
              onChange={(e) =>
                onChange({
                  ...data,
                  url: e.target.value.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9-]/g, ''),
                })
              }
            />
          </div>
        </Field>

        <Field label="Description">
          <textarea
            style={S.textarea}
            rows={3}
            value={data.description}
            onChange={(e) => onChange({ ...data, description: e.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Contact Information" sub="Used for customer support and order communications.">
        <div style={S.twoCol}>
          <Field label="Support Email">
            <input
              style={S.input}
              type="email"
              value={data.email}
              onChange={(e) => onChange({ ...data, email: e.target.value })}
            />
          </Field>
          <Field label="Phone Number">
            <input style={S.input} value={data.phone} onChange={(e) => onChange({ ...data, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="Business Address">
          <input style={S.input} value={data.address} onChange={(e) => onChange({ ...data, address: e.target.value })} />
        </Field>
      </SectionCard>

      <SectionCard title="Regional Settings">
        <div style={S.threeCol}>
          <Field label="Currency">
            <select style={S.select} value={data.currency} onChange={(e) => onChange({ ...data, currency: e.target.value })}>
              {['EGP', 'USD', 'EUR', 'SAR', 'AED'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Timezone">
            <select style={S.select} value={data.timezone} onChange={(e) => onChange({ ...data, timezone: e.target.value })}>
              {['Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Europe/London', 'America/New_York'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <select style={S.select} value={data.language} onChange={(e) => onChange({ ...data, language: e.target.value })}>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </Field>
        </div>
      </SectionCard>
    </>
  )
}

// ── Backend gateway config ────────────────────────────────────────────────────

const GATEWAY_ORDER: BackendPaymentMethod[] = [
  'STRIPE', 'PAYMOB', 'FAWRY_PAY', 'BANK_TRANSFER', 'INSTAPAY', 'COD', 'FLOWMERCE_WALLET',
]

function parseStoredMethods(raw: unknown): BackendPaymentMethod[] {
  const list: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string' && raw.length > 0
      ? (() => { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : raw.split(',') } catch { return raw.split(',') } })()
      : []
  return list.map((s) => toBackendPaymentMethod(s.trim())).filter(Boolean)
}

const CATEGORY_LABELS: Record<string, string> = {
  online: 'Online Payments',
  transfer: 'Bank & Instant Transfer',
  cash: 'Cash',
  wallet: 'Digital Wallet',
}

function PaymentSection({ storeId }: { storeId: number | null }) {
  const auth    = useMerchantAuth()
  const [methods,  setMethods]  = useState<BackendPaymentMethod[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)

  useEffect(() => {
    if (storeId === null) { setLoading(false); return }
    storeService.getStoreById(storeId, auth.getAuthHeader()).then((r) => {
      if (r.ok) setMethods(parseStoredMethods(r.data.paymentMethods))
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  const toggle = (id: BackendPaymentMethod) =>
    setMethods((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id])

  const handleSave = async () => {
    if (storeId === null) return
    setSaving(true)
    setError('')
    const r = await storeService.updatePaymentMethods(storeId, { methods }, auth.getAuthHeader())
    setSaving(false)
    if (!r.ok) { setError(r.error); return }
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2500)
  }

  // Group gateways by category
  const grouped = GATEWAY_ORDER.reduce<Record<string, BackendPaymentMethod[]>>((acc, id) => {
    const cat = PAYMENT_METHOD_CONFIG[id].category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(id)
    return acc
  }, {})

  if (loading) {
    return (
      <SectionCard title="Payment Gateways" sub="Choose which payment methods are available at checkout.">
        <p style={{ fontSize: 13, color: '#aaa' }}>Loading...</p>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Payment Gateways" sub="Choose which payment methods are available at checkout.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {(Object.keys(grouped) as string[]).map((cat) => (
          <div key={cat}>
            <p style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: '#aaa', margin: '0 0 10px',
            }}>
              {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped[cat].map((id) => {
                const cfg    = PAYMENT_METHOD_CONFIG[id]
                const active = methods.includes(id)
                return (
                  <div
                    key={id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '16px 18px', borderRadius: 12,
                      border: active ? '1.5px solid #0F0E0C' : '1px solid #ede8df',
                      background: active ? '#0F0E0C' : '#fff',
                      cursor: 'pointer', transition: 'all 0.15s',
                      userSelect: 'none',
                    }}
                    onClick={() => toggle(id)}
                    role="switch"
                    aria-checked={active}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && toggle(id)}
                  >
                    <span style={{
                      fontSize: 26, lineHeight: 1, width: 36, textAlign: 'center', flexShrink: 0,
                    }}>
                      {cfg.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 14, fontWeight: 600, margin: 0,
                        color: active ? '#fff' : '#0F0E0C',
                      }}>
                        {cfg.label}
                      </p>
                      <p style={{
                        fontSize: 12, margin: '3px 0 0',
                        color: active ? 'rgba(255,255,255,0.65)' : '#999',
                      }}>
                        {cfg.subtitle}
                      </p>
                    </div>
                    {/* Toggle pill */}
                    <div style={{
                      width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                      background: active ? '#fff' : '#e5e7eb',
                      position: 'relative', transition: 'background 0.2s',
                    }}>
                      <div style={{
                        position: 'absolute', top: 3,
                        left: active ? 23 : 3,
                        width: 18, height: 18, borderRadius: '50%',
                        background: active ? '#0F0E0C' : '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                        transition: 'left 0.2s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 13, color: '#dc2626', marginTop: 16 }}>{error}</p>
      )}

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          type="button"
          style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }}
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? 'Saving...' : success ? '✓ Saved' : 'Save Changes'}
        </button>
        <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
          {methods.length} method{methods.length !== 1 ? 's' : ''} active
        </p>
      </div>
    </SectionCard>
  )
}

const SHIPPING_CARRIERS = [
  { key: 'bosta' as const, name: 'Bosta', desc: 'Cairo & Alexandria, 1-2 days' },
  { key: 'aramex' as const, name: 'Aramex', desc: 'Nationwide, 2-4 days' },
  { key: 'dhl' as const, name: 'DHL', desc: 'International, 3-7 days' },
]

function ShippingSection({
  data,
  onChange,
}: {
  data: ShippingSettingsSlice
  onChange: (v: ShippingSettingsSlice) => void
}) {
  return (
    <>
      <SectionCard title="Shipping Rates" sub="Configure base shipping costs for your customers.">
        <div style={S.twoCol}>
          <Field label="Default Shipping Cost (EGP)" hint="Applied to all orders unless free shipping applies.">
            <input
              style={S.input}
              type="number"
              value={data.defaultCost}
              onChange={(e) => onChange({ ...data, defaultCost: e.target.value })}
            />
          </Field>
          <Field
            label="Free Shipping Threshold (EGP)"
            hint="Orders above this amount get free shipping. Set 0 to disable."
          >
            <input
              style={S.input}
              type="number"
              value={data.freeThreshold}
              onChange={(e) => onChange({ ...data, freeThreshold: e.target.value })}
            />
          </Field>
        </div>
        {+data.freeThreshold > 0 ? (
          <div style={S.infoBox}>
            ✓ Free shipping on orders above <strong>{Number(data.freeThreshold).toLocaleString()} EGP</strong>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Delivery Providers" sub="Connect carriers to offer real-time tracking.">
        {SHIPPING_CARRIERS.map((c) => (
          <Toggle
            key={c.key}
            value={data[c.key]}
            onChange={(v) => onChange({ ...data, [c.key]: v })}
            label={c.name}
            sub={c.desc}
          />
        ))}
      </SectionCard>
    </>
  )
}

function NotificationsSection({
  data,
  onChange,
}: {
  data: NotificationsSettingsSlice
  onChange: (v: NotificationsSettingsSlice) => void
}) {
  const groups: {
    title: string
    items: { key: keyof NotificationsSettingsSlice; label: string; sub: string }[]
  }[] = [
    {
      title: 'Order Updates',
      items: [
        { key: 'orderPlaced', label: 'New order placed', sub: 'Get notified when a customer places an order' },
        { key: 'orderShipped', label: 'Order shipped', sub: 'When you mark an order as shipped' },
        { key: 'orderDelivered', label: 'Order delivered', sub: 'Confirmation of delivery' },
      ],
    },
    {
      title: 'Store Alerts',
      items: [
        { key: 'lowStock', label: 'Low stock warning', sub: 'When a product drops to 5 or fewer units' },
        { key: 'newReview', label: 'New customer review', sub: 'When a customer leaves a product review' },
        { key: 'aiSuggestions', label: 'AI design suggestions', sub: 'When the AI has new recommendations for your store' },
      ],
    },
  ]

  return (
    <>
      {groups.map((g) => (
        <SectionCard key={g.title} title={g.title}>
          {g.items.map((item) => (
            <Toggle
              key={item.key}
              value={data[item.key] as boolean}
              onChange={(v) => onChange({ ...data, [item.key]: v })}
              label={item.label}
              sub={item.sub}
            />
          ))}
        </SectionCard>
      ))}

      <SectionCard title="Email Digest" sub="Receive a summary of your store performance.">
        <div style={S.radioGroup}>
          {(
            [
              { value: 'daily' as const, label: 'Daily digest', sub: 'Every morning at 8 AM' },
              { value: 'weekly' as const, label: 'Weekly digest', sub: 'Every Monday morning' },
              { value: 'never' as const, label: 'No digest', sub: 'Only individual notifications' },
            ] as const
          ).map((opt) => (
            <label key={opt.value} style={S.radioItem}>
              <input
                type="radio"
                name="emailDigest"
                value={opt.value}
                checked={data.emailDigest === opt.value}
                onChange={() => onChange({ ...data, emailDigest: opt.value })}
                style={{ margin: 0 }}
              />
              <div>
                <p style={S.radioLabel}>{opt.label}</p>
                <p style={S.radioSub}>{opt.sub}</p>
              </div>
            </label>
          ))}
        </div>
      </SectionCard>
    </>
  )
}

function TaxSection({
  data,
  onChange,
}: {
  data: TaxSettingsSlice
  onChange: (v: TaxSettingsSlice) => void
}) {
  return (
    <SectionCard title="Tax Settings" sub="Configure how tax is calculated and displayed.">
      <Toggle value={data.enabled} onChange={(v) => onChange({ ...data, enabled: v })} label="Enable Tax" sub="Apply tax to all orders" />

      {data.enabled ? (
        <>
          <div style={{ ...S.twoCol, marginTop: 16 }}>
            <Field label="Tax Rate (%)" hint="e.g. 14 for Egyptian VAT">
              <input style={S.input} type="number" value={data.rate} onChange={(e) => onChange({ ...data, rate: e.target.value })} />
            </Field>
            <Field label="VAT Registration Number">
              <input style={S.input} value={data.vatNumber} onChange={(e) => onChange({ ...data, vatNumber: e.target.value })} />
            </Field>
          </div>

          <Toggle
            value={data.inclusive}
            onChange={(v) => onChange({ ...data, inclusive: v })}
            label="Tax-inclusive pricing"
            sub="Prices shown to customers already include tax"
          />

          {data.rate ? (
            <div style={S.infoBox}>
              A product priced at 500 EGP will show as{' '}
              <strong>
                {data.inclusive
                  ? `500 EGP (includes ${data.rate}% tax)`
                  : `${(500 * (1 + +data.rate / 100)).toFixed(0)} EGP after ${data.rate}% tax`}
              </strong>
            </div>
          ) : null}
        </>
      ) : null}
    </SectionCard>
  )
}

function SecuritySection({
  twoFactor,
  onTwoFactorChange,
}: {
  twoFactor: boolean
  onTwoFactorChange: (v: boolean) => void
}) {
  const auth = useMerchantAuth()
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  const handlePwChange = async () => {
    if (!pwForm.current) {
      setPwError('Enter your current password')
      return
    }
    if (pwForm.next.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Passwords do not match')
      return
    }
    setPwError('')
    setPwSaving(true)
    const result = await userService.changePassword(
      {
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
        confirmNewPassword: pwForm.confirm,
      },
      auth.getAuthHeader()
    )
    setPwSaving(false)
    if (!result.ok) {
      setPwError(result.error)
      return
    }
    setPwSuccess(true)
    setPwForm({ current: '', next: '', confirm: '' })
    setTimeout(() => setPwSuccess(false), 3000)
  }

  return (
    <>
      <SectionCard title="Change Password">
        <div style={S.pwFields}>
          <Field label="Current Password">
            <input
              style={S.input}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={pwForm.current}
              onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
            />
          </Field>
          <Field label="New Password">
            <input
              style={S.input}
              type="password"
              autoComplete="new-password"
              placeholder="min. 8 characters"
              value={pwForm.next}
              onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
            />
          </Field>
          <Field label="Confirm New Password">
            <input
              style={S.input}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={pwForm.confirm}
              onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
            />
          </Field>
        </div>
        {pwError ? <p style={S.errorMsg}>{pwError}</p> : null}
        {pwSuccess ? (
          <p style={{ ...S.hint, color: '#3B6D11' }}>✓ Password updated successfully</p>
        ) : null}
        <button
          type="button"
          style={{
            ...S.saveBtn,
            marginTop: 12,
            alignSelf: 'flex-start',
            opacity: pwSaving ? 0.6 : 1,
            cursor: pwSaving ? 'not-allowed' : 'pointer',
          }}
          onClick={handlePwChange}
          disabled={pwSaving}
        >
          {pwSaving ? 'Updating…' : 'Update Password'}
        </button>
      </SectionCard>

      <SectionCard title="Two-Factor Authentication" sub="Add an extra layer of security to your account.">
        <Toggle
          value={twoFactor}
          onChange={onTwoFactorChange}
          label="Enable 2FA"
          sub="Require a verification code on each login"
        />
        {twoFactor ? (
          <div style={{ ...S.infoBox, marginTop: 12 }}>
            ✦ You will be asked to scan a QR code on next login to set up your authenticator app.
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Active Sessions">
        <div style={S.sessionRow}>
          <div style={S.sessionIcon}>🖥</div>
          <div style={{ flex: 1 }}>
            <p style={S.sessionDevice}>This browser</p>
            <p style={S.sessionMeta}>Current session · local dev</p>
          </div>
          <span style={S.sessionCurrent}>Current</span>
        </div>
      </SectionCard>
    </>
  )
}

function DangerSection({
  urlSlug,
  onPause,
  onExport,
  onDelete,
}: {
  urlSlug: string
  onPause: () => void
  onExport: () => void
  onDelete: () => void
}) {
  const [confirm, setConfirm] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const expected = urlSlug.trim() || 'DELETE'

  return (
    <div style={S.dangerZone}>
      <div style={S.dangerHeader}>
        <span style={{ fontSize: 16, color: '#A32D2D' }}>⚠</span>
        <p style={S.dangerTitle}>Danger Zone</p>
      </div>

      <div style={S.dangerItem}>
        <div>
          <p style={S.dangerItemTitle}>Pause Store</p>
          <p style={S.dangerItemDesc}>
            Temporarily hide your store from customers. Orders in progress will not be affected.
          </p>
        </div>
        <button type="button" style={S.warnBtn} onClick={onPause}>
          Pause Store
        </button>
      </div>

      <div style={S.dangerItem}>
        <div>
          <p style={S.dangerItemTitle}>Export All Data</p>
          <p style={S.dangerItemDesc}>
            Download local store, orders, and settings JSON (until your API provides export).
          </p>
        </div>
        <button type="button" style={S.warnBtn} onClick={onExport}>
          Export Data
        </button>
      </div>

      <div style={{ ...S.dangerItem, borderColor: '#F7C1C1' }}>
        <div>
          <p style={{ ...S.dangerItemTitle, color: '#A32D2D' }}>Delete Store</p>
          <p style={S.dangerItemDesc}>
            Permanently delete local store data in this browser. This action cannot be undone.
          </p>
        </div>
        <button type="button" style={S.deleteBtn} onClick={() => setShowDelete((v) => !v)}>
          Delete Store
        </button>
      </div>

      {showDelete ? (
        <div style={S.deleteConfirmBox}>
          <p style={S.deleteConfirmText}>
            Type <strong>{expected}</strong> to confirm permanent deletion:
          </p>
          <input style={S.input} placeholder={expected} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button
            type="button"
            style={{
              ...S.deleteBtn,
              opacity: confirm === expected ? 1 : 0.4,
            }}
            disabled={confirm !== expected}
            onClick={onDelete}
          >
            I understand, delete my store permanently
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function SettingsPage() {
  const auth = useMerchantAuth()
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('store')
  const [settings, setSettings] = useState<MerchantSettingsState | null>(null)
  const [saved, setSaved] = useState<MerchantSettingsState | null>(null)
  const [savedBanner, setSavedBanner] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // The merchant's current store (loaded from backend) — used to wire updates
  const [storeId, setStoreId] = useState<number | null>(null)

  useEffect(() => {
    const s = loadMerchantSettings()
    setSettings(s)
    setSaved(s)
  }, [])

  // Load real merchant + first store from backend, override localStorage where available.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      merchantService.getMyProfile(auth.getAuthHeader()),
      storeService.getMyStores(auth.getAuthHeader()),
    ]).then(([profileR, storesR]) => {
      if (cancelled) return

      // Merge merchant business name into the local "store name" if it's still default.
      if (profileR.ok) {
        setSettings((prev) =>
          prev && (!prev.store.name || prev.store.name === 'My Store')
            ? { ...prev, store: { ...prev.store, name: profileR.data.businessName } }
            : prev
        )
      }

      if (storesR.ok && storesR.data.length > 0) {
        const first = storesR.data[0]
        setStoreId(first.storeId)
        // Sync store info into the form (without overwriting user edits if they've already typed).
        setSettings((prev) => {
          if (!prev) return prev
          const isDefaultName = !prev.store.name || prev.store.name === 'My Store'
          return {
            ...prev,
            store: {
              ...prev.store,
              name: isDefaultName ? first.storeName : prev.store.name,
              url: prev.store.url || first.storeUrl,
            },
          }
        })
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isDirty = settings && saved ? JSON.stringify(settings) !== JSON.stringify(saved) : false

  const update =
    <K extends keyof MerchantSettingsState>(key: K) =>
    (val: MerchantSettingsState[K]) => {
      setSettings((prev) => (prev ? { ...prev, [key]: val } : prev))
    }

  const handleSave = async () => {
    if (!settings) return
    setIsSaving(true)
    setSaveError('')

    // INT-25: primary save goes to the backend; keep local copy only as offline fallback.
    saveMerchantSettings(settings)

    // Sync to backend whenever we know a storeId.
    if (storeId !== null) {
      // Push store info + brand to backend in parallel.
      const [storeRes, brandRes] = await Promise.all([
        storeService.updateStore(
          storeId,
          {
            storeName: settings.store.name,
            description: settings.store.description,
          },
          auth.getAuthHeader()
        ),
        storeService.updateBrand(
          storeId,
          {
            brandName: settings.store.name,
            logoUrl: settings.store.logo || null,
          },
          auth.getAuthHeader()
        ),
      ])

      const firstErr = [storeRes, brandRes].find((r) => !r.ok)
      if (firstErr && !firstErr.ok) {
        setSaveError(firstErr.error)
        setIsSaving(false)
        return
      }
    }

    // Update business name — only create profile if it doesn't exist yet.
    // 409 = already exists, which is fine (brand name is already synced via updateBrand above).
    if (settings.store.name) {
      const existingProfile = await merchantService.getMyProfile(auth.getAuthHeader())
      if (!existingProfile.ok) {
        // Profile missing — create it
        const profileR = await merchantService.createProfile(
          { businessName: settings.store.name },
          auth.getAuthHeader()
        )
        if (!profileR.ok && profileR.status !== 409) {
          setSaveError(profileR.error)
          setIsSaving(false)
          return
        }
      }
      // Profile already exists — business name is handled by updateBrand above, nothing to do
    }

    setSaved(settings)
    setSavedBanner(true)
    setIsSaving(false)
    setTimeout(() => setSavedBanner(false), 2500)
  }

  const handleReset = () => {
    if (saved) setSettings(saved)
  }

  const handlePause = async () => {
    patchPersistedStore({ published: false })
    if (storeId !== null) {
      await storeService.unpublishStore(storeId, auth.getAuthHeader())
    }
    setSavedBanner(true)
    setTimeout(() => setSavedBanner(false), 2500)
  }

  const handleExport = () => {
    exportAllLocalData()
    setSavedBanner(true)
    setTimeout(() => setSavedBanner(false), 2500)
  }

  const handleDelete = async () => {
    if (storeId !== null) {
      const result = await storeService.deleteStore(storeId, auth.getAuthHeader())
      if (!result.ok) {
        setSaveError(result.error)
        return
      }
    }
    clearAllLocalMerchantData()
    const fresh = loadMerchantSettings()
    setSettings(fresh)
    setSaved(fresh)
    window.location.href = '/'
  }

  if (!settings) {
    return <div style={{ padding: 40, color: '#AAA', fontSize: 13 }}>Loading settings…</div>
  }

  const isDanger = activeSection === 'danger'

  return (
    <div style={S.page}>
      <div style={S.layout}>
        <nav style={S.nav} aria-label="Settings sections">
          {SETTINGS_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              style={{
                ...S.navItem,
                ...(activeSection === sec.id ? S.navItemActive : {}),
                ...(sec.id === 'danger' ? S.navItemDanger : {}),
                ...(sec.id === 'danger' && activeSection === 'danger' ? S.navItemDangerActive : {}),
              }}
              onClick={() => setActiveSection(sec.id)}
            >
              <span style={S.navIcon}>{sec.icon}</span>
              {sec.label}
            </button>
          ))}
        </nav>

        <div style={S.content}>
          {activeSection === 'store' ? (
            <StoreInfoSection data={settings.store} onChange={update('store')} authHeaders={auth.getAuthHeader()} />
          ) : null}
          {activeSection === 'payment' ? (
            <PaymentSection storeId={storeId} />
          ) : null}
          {activeSection === 'shipping' ? (
            <ShippingSection data={settings.shipping} onChange={update('shipping')} />
          ) : null}
          {activeSection === 'notifications' ? (
            <NotificationsSection data={settings.notifications} onChange={update('notifications')} />
          ) : null}
          {activeSection === 'tax' ? <TaxSection data={settings.tax} onChange={update('tax')} /> : null}
          {activeSection === 'security' ? (
            <SecuritySection
              twoFactor={settings.security.twoFactor}
              onTwoFactorChange={(v) =>
                setSettings((prev) =>
                  prev ? { ...prev, security: { ...prev.security, twoFactor: v } } : prev
                )
              }
            />
          ) : null}
          {activeSection === 'danger' ? (
            <DangerSection
              urlSlug={settings.store.url}
              onPause={handlePause}
              onExport={handleExport}
              onDelete={handleDelete}
            />
          ) : null}
        </div>
      </div>

      {!isDanger ? (
        <div style={S.saveBar}>
          {savedBanner ? <span style={S.savedMsg}>✓ Changes saved</span> : null}
          {saveError ? (
            <span style={{ ...S.savedMsg, color: '#A32D2D' }} role="alert">
              {saveError}
            </span>
          ) : null}
          <button
            type="button"
            style={S.cancelBtn}
            onClick={handleReset}
            disabled={!isDirty || isSaving}
          >
            Reset
          </button>
          <button
            type="button"
            style={{ ...S.saveBtn, opacity: isSaving ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={(!isDirty && storeId === null) || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
