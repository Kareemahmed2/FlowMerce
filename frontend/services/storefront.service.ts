/**
 * Storefront service — all methods return ApiResult<T>, never throw.
 *
 * PUBLIC (no auth):
 *   GET    /public/storefront/{storeId}                     → getPublicStorefront()
 *   GET    /public/storefront/{storeId}/categories          → getPublicCategories()
 *   GET    /public/storefront/{storeId}/products            → getPublicProducts()
 *   GET    /public/storefront/{storeId}/products/{productId}→ getPublicProduct()
 *   GET    /stores/{storeId}/products/search?keyword=       → searchProducts()
 *
 * MERCHANT (MERCHANT auth):
 *   POST   /stores/{storeId}/storefront/init                → initStorefront()
 *   GET    /stores/{storeId}/storefront                     → getStorefront()
 *   POST   /stores/{storeId}/storefront/publish             → publishStorefront()
 *   POST   /stores/{storeId}/storefront/unpublish           → unpublishStorefront()
 *   GET    /stores/{storeId}/storefront/design              → getDesign()
 *   PUT    /stores/{storeId}/storefront/design              → saveDesign()
 *   GET    /stores/{storeId}/storefront/colors              → getTheme()
 *   PUT    /stores/{storeId}/storefront/colors              → updateTheme()
 *   GET    /stores/{storeId}/storefront/pages               → listPages()
 *   POST   /stores/{storeId}/storefront/pages               → createPage()
 *   GET    /stores/{storeId}/storefront/pages/{pageId}      → getPage()
 *   PUT    /stores/{storeId}/storefront/pages/{pageId}      → updatePage()
 *   DELETE /stores/{storeId}/storefront/pages/{pageId}      → deletePage()
 *   (+ components, decorators, media endpoints)
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type {
  StorefrontPublicData,
  StoreColors,
} from '@/types/store.types'
import type {
  ComponentReorderItem,
  ComponentRequest,
  ComponentResponse,
  CreateStorefrontRequest,
  DecoratorRequest,
  DecoratorResponse,
  DesignResponse,
  PageRequest,
  PageResponse,
  PageSummary,
  StorefrontMediaRequest,
  StorefrontMediaResponse,
  StorefrontTemplateResponse,
  ThemeResponse,
  UpdateDesignRequest,
  UpdateThemeRequest,
} from '@/types/storefront.types'

// ── Public category/product shapes (match backend CatalogDTOs) ────────────────

export interface PublicCategory {
  categoryId: number  // backend field name
  id?: number         // fallback alias
  storeId?: number
  name: string
  description?: string
}

export interface PublicProduct {
  productId: number   // backend field name
  id?: number         // fallback alias
  storeId?: number
  categoryId?: number
  categoryName?: string
  name: string
  description?: string | null
  price: string | number
  inventory?: number  // backend field name for stock
  stock?: number      // fallback alias
  images?: string[]
  isActive?: boolean
  rating?: number
}

// ── Service ───────────────────────────────────────────────────────────────────

export const storefrontService = {
  // ── PUBLIC ──────────────────────────────────────────────────────────────────

  async getPublicStorefront(storeId: number): Promise<ApiResult<StorefrontPublicData>> {
    return httpClient.get<StorefrontPublicData>(`/public/storefront/${storeId}`)
  },

  async getPublicCategories(storeId: number): Promise<ApiResult<PublicCategory[]>> {
    return httpClient.get<PublicCategory[]>(`/public/storefront/${storeId}/categories`)
  },

  async getPublicProducts(storeId: number, categoryId?: number): Promise<ApiResult<PublicProduct[]>> {
    const qs = categoryId ? `?categoryId=${categoryId}` : ''
    return httpClient.get<PublicProduct[]>(`/public/storefront/${storeId}/products${qs}`)
  },

  async getPublicProduct(storeId: number, productId: number): Promise<ApiResult<PublicProduct>> {
    return httpClient.get<PublicProduct>(`/public/storefront/${storeId}/products/${productId}`)
  },

  async searchProducts(storeId: number, keyword: string): Promise<ApiResult<PublicProduct[]>> {
    return httpClient.get<PublicProduct[]>(
      `/stores/${storeId}/products/search?keyword=${encodeURIComponent(keyword)}`
    )
  },

  // ── MERCHANT — LIFECYCLE ────────────────────────────────────────────────────

  async initStorefront(storeId: number, request: CreateStorefrontRequest, authHeaders?: Record<string, string>): Promise<ApiResult<StorefrontTemplateResponse>> {
    return httpClient.post<StorefrontTemplateResponse>(`/stores/${storeId}/storefront/init`, request, authHeaders)
  },

  async getStorefront(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<StorefrontTemplateResponse>> {
    return httpClient.get<StorefrontTemplateResponse>(`/stores/${storeId}/storefront`, authHeaders)
  },

  async publishStorefront(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<StorefrontTemplateResponse>> {
    return httpClient.post<StorefrontTemplateResponse>(`/stores/${storeId}/storefront/publish`, undefined, authHeaders)
  },

  async unpublishStorefront(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<StorefrontTemplateResponse>> {
    return httpClient.post<StorefrontTemplateResponse>(`/stores/${storeId}/storefront/unpublish`, undefined, authHeaders)
  },

  // ── MERCHANT — DESIGN / THEME ───────────────────────────────────────────────

  async getDesign(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<DesignResponse>> {
    return httpClient.get<DesignResponse>(`/stores/${storeId}/storefront/design`, authHeaders)
  },

  async saveDesign(storeId: number, request: UpdateDesignRequest, authHeaders?: Record<string, string>): Promise<ApiResult<DesignResponse>> {
    return httpClient.put<DesignResponse>(`/stores/${storeId}/storefront/design`, request, authHeaders)
  },

  async getTheme(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<ThemeResponse>> {
    return httpClient.get<ThemeResponse>(`/stores/${storeId}/storefront/colors`, authHeaders)
  },

  async updateTheme(storeId: number, request: UpdateThemeRequest, authHeaders?: Record<string, string>): Promise<ApiResult<ThemeResponse>> {
    return httpClient.put<ThemeResponse>(`/stores/${storeId}/storefront/colors`, request, authHeaders)
  },

  /** @deprecated Use updateTheme */
  async updateColors(storeId: number, request: UpdateThemeRequest, authHeaders?: Record<string, string>): Promise<ApiResult<ThemeResponse>> {
    return storefrontService.updateTheme(storeId, request, authHeaders)
  },

  // ── MERCHANT — PAGES ────────────────────────────────────────────────────────

  async listPages(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<PageSummary[]>> {
    return httpClient.get<PageSummary[]>(`/stores/${storeId}/storefront/pages`, authHeaders)
  },

  async createPage(storeId: number, request: PageRequest, authHeaders?: Record<string, string>): Promise<ApiResult<PageResponse>> {
    return httpClient.post<PageResponse>(`/stores/${storeId}/storefront/pages`, request, authHeaders)
  },

  async getPage(storeId: number, pageId: number, authHeaders?: Record<string, string>): Promise<ApiResult<PageResponse>> {
    return httpClient.get<PageResponse>(`/stores/${storeId}/storefront/pages/${pageId}`, authHeaders)
  },

  async updatePage(storeId: number, pageId: number, request: Partial<PageRequest>, authHeaders?: Record<string, string>): Promise<ApiResult<PageResponse>> {
    return httpClient.put<PageResponse>(`/stores/${storeId}/storefront/pages/${pageId}`, request, authHeaders)
  },

  async deletePage(storeId: number, pageId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/stores/${storeId}/storefront/pages/${pageId}`, authHeaders)
  },

  // ── MERCHANT — COMPONENTS ───────────────────────────────────────────────────

  async listComponents(storeId: number, pageId: number, authHeaders?: Record<string, string>): Promise<ApiResult<ComponentResponse[]>> {
    return httpClient.get<ComponentResponse[]>(`/stores/${storeId}/storefront/pages/${pageId}/components`, authHeaders)
  },

  async addComponent(storeId: number, pageId: number, request: ComponentRequest, authHeaders?: Record<string, string>): Promise<ApiResult<ComponentResponse>> {
    return httpClient.post<ComponentResponse>(`/stores/${storeId}/storefront/pages/${pageId}/components`, request, authHeaders)
  },

  async updateComponent(storeId: number, pageId: number, componentId: number, request: Partial<ComponentRequest>, authHeaders?: Record<string, string>): Promise<ApiResult<ComponentResponse>> {
    return httpClient.put<ComponentResponse>(`/stores/${storeId}/storefront/pages/${pageId}/components/${componentId}`, request, authHeaders)
  },

  async deleteComponent(storeId: number, pageId: number, componentId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/stores/${storeId}/storefront/pages/${pageId}/components/${componentId}`, authHeaders)
  },

  async reorderComponents(storeId: number, pageId: number, items: ComponentReorderItem[], authHeaders?: Record<string, string>): Promise<ApiResult<ComponentResponse[]>> {
    return httpClient.put<ComponentResponse[]>(`/stores/${storeId}/storefront/pages/${pageId}/components/reorder`, items, authHeaders)
  },

  // ── MERCHANT — DECORATORS ───────────────────────────────────────────────────

  async listDecorators(storeId: number, componentId: number, authHeaders?: Record<string, string>): Promise<ApiResult<DecoratorResponse[]>> {
    return httpClient.get<DecoratorResponse[]>(`/stores/${storeId}/storefront/components/${componentId}/decorators`, authHeaders)
  },

  async addDecorator(storeId: number, componentId: number, request: DecoratorRequest, authHeaders?: Record<string, string>): Promise<ApiResult<DecoratorResponse>> {
    return httpClient.post<DecoratorResponse>(`/stores/${storeId}/storefront/components/${componentId}/decorators`, request, authHeaders)
  },

  async updateDecorator(storeId: number, componentId: number, decoratorId: number, request: DecoratorRequest, authHeaders?: Record<string, string>): Promise<ApiResult<DecoratorResponse>> {
    return httpClient.put<DecoratorResponse>(`/stores/${storeId}/storefront/components/${componentId}/decorators/${decoratorId}`, request, authHeaders)
  },

  async deleteDecorator(storeId: number, componentId: number, decoratorId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/stores/${storeId}/storefront/components/${componentId}/decorators/${decoratorId}`, authHeaders)
  },

  // ── MERCHANT — MEDIA ────────────────────────────────────────────────────────

  async listMedia(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<StorefrontMediaResponse[]>> {
    return httpClient.get<StorefrontMediaResponse[]>(`/stores/${storeId}/storefront/media`, authHeaders)
  },

  async saveMedia(storeId: number, request: StorefrontMediaRequest, authHeaders?: Record<string, string>): Promise<ApiResult<StorefrontMediaResponse>> {
    return httpClient.post<StorefrontMediaResponse>(`/stores/${storeId}/storefront/media`, request, authHeaders)
  },

  async deleteMedia(storeId: number, mediaId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/stores/${storeId}/storefront/media/${mediaId}`, authHeaders)
  },
}
