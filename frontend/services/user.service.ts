/**
 * User service — all methods return ApiResult<T>, never throw.
 *
 * Backend endpoints (auth: any role):
 *   GET    /users/me                    → getMyProfile()
 *   PUT    /users/me                    → updateProfile()
 *   PUT    /users/me/change-password    → changePassword()
 *   DELETE /users/me                    → deleteAccount()
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type {
  ChangePasswordRequest,
  UpdateProfileRequest,
  UserResponse,
} from '@/types/auth.types'

export const userService = {
  async getMyProfile(authHeaders?: Record<string, string>): Promise<ApiResult<UserResponse>> {
    return httpClient.get<UserResponse>('/users/me', authHeaders)
  },

  async updateProfile(request: UpdateProfileRequest, authHeaders?: Record<string, string>): Promise<ApiResult<UserResponse>> {
    return httpClient.put<UserResponse>('/users/me', request, authHeaders)
  },

  async changePassword(request: ChangePasswordRequest, authHeaders?: Record<string, string>): Promise<ApiResult<{ message: string }>> {
    return httpClient.put<{ message: string }>('/users/me/change-password', request, authHeaders)
  },

  async deleteAccount(authHeaders?: Record<string, string>): Promise<ApiResult<{ message: string }>> {
    return httpClient.delete<{ message: string }>('/users/me', authHeaders)
  },
}
