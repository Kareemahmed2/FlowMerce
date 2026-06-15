/**
 * Upload service — uploads a File to POST /uploads.
 * Returns the public https:// URL of the uploaded file.
 */

import type { ApiResult } from '@/types/api.types'
import { apiSuccess, apiFailure } from '@/types/api.types'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

export type UploadResponse = { url: string }

export const uploadService = {
  async uploadImage(file: File, authHeaders: Record<string, string>): Promise<ApiResult<UploadResponse>> {
    try {
      const formData = new FormData()
      formData.append('file', file)

      // INT-46: include credentials so the httpOnly auth cookie is sent automatically.
      // Do NOT set Content-Type — the browser sets it to multipart/form-data with boundary.
      const res = await fetch(`${API_BASE}/uploads`, {
        method: 'POST',
        headers: { ...authHeaders },
        body: formData,
        credentials: 'include',
      })

      const json = (await res.json()) as { data?: UploadResponse; message?: string }

      if (!res.ok) {
        return apiFailure(json.message ?? `Upload failed (${res.status})`, res.status)
      }

      if (!json.data?.url) {
        return apiFailure('Invalid response from upload endpoint', 500)
      }

      return apiSuccess(json.data)
    } catch (err) {
      return apiFailure(err instanceof Error ? err.message : 'Network error during upload', 0)
    }
  },
}
