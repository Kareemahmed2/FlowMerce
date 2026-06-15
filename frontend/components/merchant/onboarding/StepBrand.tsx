'use client'

import { useRef, useState } from 'react'
import type { BrandData } from './types'
import { styles } from './wizard-styles'
import { uploadService } from '@/services/upload.service'
import { useMerchantAuth } from '@/store/auth-store'

type Props = {
  data: BrandData
  onChange: (v: BrandData) => void
}

export function StepBrand({ data, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const auth = useMerchantAuth()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    setUploading(true)

    // Show a local preview immediately while uploading
    const localPreview = URL.createObjectURL(file)
    onChange({ ...data, logo: file, logoPreview: localPreview })

    const result = await uploadService.uploadImage(file, auth.getAuthHeader())
    setUploading(false)

    if (result.ok) {
      // Replace local blob URL with the real backend URL
      URL.revokeObjectURL(localPreview)
      onChange({ ...data, logo: file, logoPreview: result.data.url })
    } else {
      // Keep showing the local preview (works for current session)
      // but warn the user it won't persist after refresh
      setUploadError(`Upload failed: ${result.error}. Logo preview will not survive a page refresh.`)
    }
  }

  return (
    <div style={styles.stepContent}>
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Brand Name</label>
        <input
          style={styles.input}
          type="text"
          placeholder="e.g. Luma Jewelry"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
        />
        <p style={styles.hint}>This will appear as your store&apos;s display name.</p>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Brand Logo</label>
        <div
          style={{
            ...styles.uploadZone,
            ...(data.logoPreview ? styles.uploadZoneFilled : {}),
            ...(uploading ? { opacity: 0.7, cursor: 'wait' } : {}),
          }}
          onClick={() => !uploading && fileRef.current?.click()}
          onKeyDown={(e) => !uploading && e.key === 'Enter' && fileRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {data.logoPreview ? (
            <img src={data.logoPreview} alt="logo" style={styles.logoPreview} />
          ) : (
            <>
              <span style={styles.uploadIcon}>⊕</span>
              <span style={styles.uploadText}>Click to upload logo</span>
              <span style={styles.uploadSub}>PNG, SVG, JPG · max 10MB</span>
            </>
          )}
        </div>

        {uploading && (
          <p style={{ fontSize: 12, color: '#B5905A', marginTop: 6 }}>⏳ Uploading logo…</p>
        )}
        {uploadError && (
          <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{uploadError}</p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { void handleLogo(e) }}
        />
        {data.logoPreview && !uploading && (
          <button
            type="button"
            style={styles.clearBtn}
            onClick={() => onChange({ ...data, logo: null, logoPreview: null })}
          >
            Remove logo
          </button>
        )}
      </div>
    </div>
  )
}
