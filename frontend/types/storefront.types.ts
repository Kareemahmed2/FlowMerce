/**
 * Storefront customization types — mirror backend StorefrontDTOs.java exactly.
 *
 * Backend base path: /stores/{storeId}/storefront
 *
 * Endpoint coverage:
 *   GET    /storefront                            → StorefrontTemplateResponse
 *   POST   /storefront/init                       → StorefrontTemplateResponse
 *   POST   /storefront/publish                    → StorefrontTemplateResponse
 *   POST   /storefront/unpublish                  → StorefrontTemplateResponse
 *   GET    /storefront/design                     → DesignResponse
 *   PUT    /storefront/design                     → DesignResponse
 *   GET    /storefront/colors                     → ThemeResponse
 *   PUT    /storefront/colors                     → ThemeResponse
 *   GET    /storefront/pages                      → PageSummary[]
 *   POST   /storefront/pages                      → PageResponse
 *   GET    /storefront/pages/{pageId}             → PageResponse
 *   PUT    /storefront/pages/{pageId}             → PageResponse
 *   DELETE /storefront/pages/{pageId}             → void
 *   GET    /storefront/pages/{pageId}/components  → ComponentResponse[]
 *   POST   /storefront/pages/{pageId}/components  → ComponentResponse
 *   PUT    /storefront/pages/{pageId}/components/{componentId} → ComponentResponse
 *   DELETE /storefront/pages/{pageId}/components/{componentId} → void
 *   PUT    /storefront/pages/{pageId}/components/reorder       → ComponentResponse[]
 *   GET    /storefront/components/{componentId}/decorators     → DecoratorResponse[]
 *   POST   /storefront/components/{componentId}/decorators     → DecoratorResponse
 *   PUT    /storefront/components/{componentId}/decorators/{decoratorId} → DecoratorResponse
 *   DELETE /storefront/components/{componentId}/decorators/{decoratorId} → void
 *   GET    /storefront/media                      → MediaResponse[]
 *   POST   /storefront/media                      → MediaResponse
 *   DELETE /storefront/media/{mediaId}            → void
 */

// ── Theme / design ────────────────────────────────────────────────────────────

export interface ThemeResponse {
  themeId: number
  background: string
  header: string
  footer: string
  accent: string
  text: string
  card: string
  updatedAt: string
}

export interface UpdateThemeRequest {
  background?: string
  header?: string
  footer?: string
  accent?: string
  text?: string
  card?: string
}

/** Backend DesignResponse is structurally identical to ThemeResponse. */
export type DesignResponse = ThemeResponse

/**
 * The merchant's "saved design" payload — backend accepts any JSON object
 * (`Map<String, Object>`). For the visual builder we store the active page
 * id, breakpoint preview, and any layout-level options.
 */
export type UpdateDesignRequest = Record<string, unknown>

// ── Storefront lifecycle ──────────────────────────────────────────────────────

/** CON-12: backend enum is DRAFT | PUBLISHED | PAUSED (not UNPUBLISHED). */
export type StorefrontStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | string

export interface StorefrontTemplateResponse {
  templateId: number
  storeId: number
  storeName: string
  storeUrl: string
  status: StorefrontStatus
  version: number
  publishedAt: string | null
  theme: ThemeResponse
  pages: PageSummary[]
  createdAt: string
  updatedAt: string
}

export interface CreateStorefrontRequest {
  background?: string
  header?: string
  footer?: string
  accent?: string
  text?: string
  card?: string
}

// ── Pages ─────────────────────────────────────────────────────────────────────

export interface PageSummary {
  pageId: number
  title: string
  slug: string
  pageType: string
  isPublished: boolean
  showInNav: boolean
  navOrder: number
  components: ComponentResponse[]
}

export interface PageResponse {
  pageId: number
  title: string
  slug: string
  pageType: string
  isPublished: boolean
  showInNav: boolean
  navOrder: number
  metaDescription: string | null
  components: ComponentResponse[]
  createdAt: string
  updatedAt: string
}

/** Backend accepts an arbitrary Map for create/update — typed convenience shape. */
export interface PageRequest {
  title: string
  slug: string
  pageType?: string
  isPublished?: boolean
  showInNav?: boolean
  navOrder?: number
  metaDescription?: string
}

// ── Components ────────────────────────────────────────────────────────────────

export interface ComponentResponse {
  componentId: number
  componentType: string
  name: string
  /** Free-form string — usually a JSON blob describing the component's content. */
  content: string
  isVisible: boolean
  sortOrder: number
  decorators: DecoratorResponse[]
  createdAt: string
  updatedAt: string
}

export interface ComponentRequest {
  componentType: string
  name: string
  content?: string
  isVisible?: boolean
  sortOrder?: number
}

/** Single entry in the reorder request body. */
export interface ComponentReorderItem {
  componentId: number
  sortOrder: number
}

// ── Decorators ────────────────────────────────────────────────────────────────

export interface DecoratorResponse {
  decoratorId: number
  componentId: number
  priority: number
  /** Free-form string — typically JSON describing the decorator behaviour. */
  data: string
  createdAt: string
  updatedAt: string
}

export interface DecoratorRequest {
  priority?: number
  data?: string
}

// ── Media ─────────────────────────────────────────────────────────────────────

export interface StorefrontMediaResponse {
  mediaId: number
  storeId: number
  url: string
  name: string | null
  mediaType: string | null
  uploadedAt: string
}

export interface StorefrontMediaRequest {
  url: string
  name?: string
  mediaType?: string
}

// ── Builder presets ───────────────────────────────────────────────────────────

/**
 * Component palette — types the merchant can drop on the canvas.
 * The backend's componentType is a free-form string; this list reflects the
 * common types we render in the builder. Extend as new component renderers land.
 */
export const COMPONENT_PALETTE: Array<{ type: string; label: string; icon: string; defaultContent: string }> = [
  { type: 'HERO',         label: 'Hero banner',    icon: '⬛', defaultContent: JSON.stringify({ title: 'Welcome', subtitle: 'Shop the new collection', cta: 'Shop now' }) },
  { type: 'TEXT',         label: 'Text block',     icon: '¶', defaultContent: JSON.stringify({ heading: 'About us', body: 'Tell your story here.' }) },
  { type: 'IMAGE',        label: 'Image',          icon: '🖼', defaultContent: JSON.stringify({ url: '', alt: '' }) },
  { type: 'PRODUCT_GRID', label: 'Product grid',   icon: '▦', defaultContent: JSON.stringify({ rows: 2, cols: 3, categoryId: null }) },
  { type: 'CATEGORY_LIST', label: 'Category list', icon: '☷', defaultContent: JSON.stringify({ layout: 'cards' }) },
  { type: 'CTA',          label: 'Call-to-action', icon: '↗', defaultContent: JSON.stringify({ label: 'Browse all', href: '/products' }) },
  { type: 'SPACER',       label: 'Spacer',         icon: '⎵', defaultContent: JSON.stringify({ heightPx: 32 }) },
  { type: 'DIVIDER',      label: 'Divider',        icon: '—', defaultContent: JSON.stringify({}) },
]

export const PAGE_TYPES: Array<{ value: string; label: string }> = [
  { value: 'HOME',     label: 'Home' },
  { value: 'ABOUT',    label: 'About' },
  { value: 'CONTACT',  label: 'Contact' },
  { value: 'POLICY',   label: 'Policy' },
  { value: 'CUSTOM',   label: 'Custom' },
]
