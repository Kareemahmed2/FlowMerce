/**
 * Per-store provider integrations service — all methods return ApiResult<T>.
 *
 * Backend endpoints:
 *   GET    /stores/{storeId}/integrations                     → list()
 *   PUT    /stores/{storeId}/integrations/{provider}          → saveCredentials()
 *   PUT    /stores/{storeId}/integrations/{provider}/enabled  → setEnabled()
 *   POST   /stores/{storeId}/integrations/{provider}/test     → testConnection()
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type {
  IntegrationProvider,
  IntegrationStatusResponse,
  SaveCredentialsRequest,
  SetEnabledRequest,
  TestConnectionResponse,
} from '@/types/integration.types'

export const integrationsService = {
  async list(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<IntegrationStatusResponse[]>> {
    return httpClient.get<IntegrationStatusResponse[]>(`/stores/${storeId}/integrations`, authHeaders)
  },

  async saveCredentials(
    storeId: number,
    provider: IntegrationProvider,
    request: SaveCredentialsRequest,
    authHeaders?: Record<string, string>
  ): Promise<ApiResult<IntegrationStatusResponse>> {
    return httpClient.put<IntegrationStatusResponse>(
      `/stores/${storeId}/integrations/${provider}`, request, authHeaders
    )
  },

  async setEnabled(
    storeId: number,
    provider: IntegrationProvider,
    request: SetEnabledRequest,
    authHeaders?: Record<string, string>
  ): Promise<ApiResult<IntegrationStatusResponse>> {
    return httpClient.put<IntegrationStatusResponse>(
      `/stores/${storeId}/integrations/${provider}/enabled`, request, authHeaders
    )
  },

  async testConnection(
    storeId: number,
    provider: IntegrationProvider,
    authHeaders?: Record<string, string>
  ): Promise<ApiResult<TestConnectionResponse>> {
    return httpClient.post<TestConnectionResponse>(
      `/stores/${storeId}/integrations/${provider}/test`, undefined, authHeaders
    )
  },
}
