'use client'

import { useEffect, useState } from 'react'
import { useMerchantAuth } from '@/store/auth-store'
import { integrationsService } from '@/services/integrations.service'
import {
  PROVIDER_FIELDS,
  PROVIDER_LABELS,
  type IntegrationProvider,
  type IntegrationStatusResponse,
  type TestConnectionResponse,
} from '@/types/integration.types'
import { Field, SectionCard } from './settings-shared'
import { S } from './settings-styles'

const PROVIDERS: IntegrationProvider[] = ['PAYMOB', 'DHL', 'ARAMEX', 'BOSTA']

function StatusBadge({ status }: { status: IntegrationStatusResponse | null }) {
  if (!status?.configured) {
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#f1f1ef', color: '#999' }}>
        Not connected
      </span>
    )
  }
  if (status.enabled) {
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#ecfdf5', color: '#15803d' }}>
        Connected
      </span>
    )
  }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#fff7ed', color: '#c2410c' }}>
      Saved · disabled
    </span>
  )
}

function ProviderCard({ provider, storeId }: { provider: IntegrationProvider; storeId: number }) {
  const auth = useMerchantAuth()
  const [status, setStatus] = useState<IntegrationStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null)
  const [error, setError] = useState('')

  const fetchStatus = () => {
    integrationsService.list(storeId, auth.getAuthHeader()).then((r) => {
      if (r.ok) {
        const found = r.data.find((s) => s.provider === provider) ?? null
        setStatus(found)
      }
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, provider])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setTestResult(null)
    const r = await integrationsService.saveCredentials(
      storeId, provider, { credentials: fields }, auth.getAuthHeader()
    )
    setSaving(false)
    if (!r.ok) { setError(r.error); return }
    setStatus(r.data)
    // Never keep entered secrets in memory after a successful save.
    setFields({})
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const r = await integrationsService.testConnection(storeId, provider, auth.getAuthHeader())
    setTesting(false)
    if (r.ok) {
      setTestResult(r.data)
      fetchStatus()
    } else {
      setTestResult({ success: false, message: r.error })
    }
  }

  const handleToggle = async (enabled: boolean) => {
    const r = await integrationsService.setEnabled(storeId, provider, { enabled }, auth.getAuthHeader())
    if (r.ok) setStatus(r.data)
  }

  const info = PROVIDER_LABELS[provider]
  const requiredFields = PROVIDER_FIELDS[provider]
  const hasAllFields = requiredFields.every((f) => (fields[f.key] ?? '').trim().length > 0)

  return (
    <div style={{ border: '1px solid #ede8df', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#0F0E0C' }}>{info.name}</p>
          <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>{info.description}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {status?.maskedPreview ? (
            <span style={{ fontSize: 12, color: '#999', fontFamily: 'monospace' }}>{status.maskedPreview}</span>
          ) : null}
          <StatusBadge status={status} />
        </div>
      </div>

      {!loading ? (
        <>
          <div style={S.twoCol}>
            {requiredFields.map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  style={S.input}
                  type="password"
                  autoComplete="off"
                  placeholder={status?.configured ? '•••••••••••••• (leave to keep editing below)' : 'Enter value'}
                  value={fields[f.key] ?? ''}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </Field>
            ))}
          </div>

          {error ? <p style={S.errorMsg}>{error}</p> : null}
          {testResult ? (
            <p style={{ fontSize: 12, margin: 0, color: testResult.success ? '#15803d' : '#dc2626' }}>
              {testResult.success ? '✓ ' : '✗ '}{testResult.message}
            </p>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{ ...S.saveBtn, opacity: saving || !hasAllFields ? 0.5 : 1 }}
              disabled={saving || !hasAllFields}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save Credentials'}
            </button>
            <button
              type="button"
              style={{ ...S.cancelBtn, opacity: testing || !status?.configured ? 0.5 : 1 }}
              disabled={testing || !status?.configured}
              onClick={() => void handleTest()}
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            {status?.configured ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={status.enabled}
                  onChange={(e) => void handleToggle(e.target.checked)}
                />
                Enabled at checkout/fulfillment
              </label>
            ) : null}
          </div>
        </>
      ) : (
        <p style={{ fontSize: 12, color: '#aaa' }}>Loading…</p>
      )}
    </div>
  )
}

export function IntegrationsSection({ storeId }: { storeId: number | null }) {
  if (storeId === null) {
    return (
      <SectionCard title="Integrations" sub="Connect your own provider accounts.">
        <p style={{ fontSize: 13, color: '#aaa' }}>Loading store…</p>
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="Integrations"
      sub="Connect your own Paymob, DHL, Aramex, and Bosta accounts. FlowMerce never uses a shared account — every call uses your store's own credentials."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {PROVIDERS.map((provider) => (
          <ProviderCard key={provider} provider={provider} storeId={storeId} />
        ))}
      </div>
    </SectionCard>
  )
}
