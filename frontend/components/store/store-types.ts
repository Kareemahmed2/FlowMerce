import type { CatalogCategory, CatalogProduct, StorefrontColors } from '@/components/merchant/onboarding/types'

/* ───────── Cart ───────── */
export type CartItem = {
  product: CatalogProduct
  categoryName: string
  quantity: number
  /** Backend cartItemId — set after successful POST /cart/items */
  cartItemId?: number
  /** INT-29: price locked at the moment the item was added to the cart
   *  (set by the backend, prevents price-change discrepancies in subtotals). */
  priceAtAdd?: number
}

export type CartState = {
  items: CartItem[]
  addItem: (product: CatalogProduct, categoryName: string) => void
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, qty: number) => void
  clearCart: () => void
  itemCount: number
  subtotal: number
}

/* ───────── Store data resolved from API / localStorage ───────── */
export type StoreData = {
  storeId: number | null
  brandName: string
  logoPreview: string | null
  categories: CatalogCategory[]
  colors: StorefrontColors
  payment: string[]
  storeUrl: string
  /** FEAT-RENDER: published page tree from the design studio (if any). */
  pages?: import('@/types/storefront.types').PageSummary[]
}

/* ───────── Checkout form ───────── */
export type CheckoutForm = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  notes: string
  paymentMethod: string
}

export const EMPTY_CHECKOUT: CheckoutForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  notes: '',
  paymentMethod: '',
}

/* ───────── Helpers ───────── */
export function getAllProducts(categories: CatalogCategory[]): (CatalogProduct & { categoryName: string })[] {
  return categories.flatMap((cat) =>
    cat.products.map((p) => ({ ...p, categoryName: cat.name }))
  )
}

export function findProduct(
  categories: CatalogCategory[],
  productId: number
): { product: CatalogProduct; category: CatalogCategory } | null {
  for (const cat of categories) {
    const p = cat.products.find((pr) => pr.id === productId)
    if (p) return { product: p, category: cat }
  }
  return null
}

/** Calculate luminance to decide text color on a background */
export function textOnBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#1A1A1A' : '#FFFFFF'
}

export function formatPrice(price: string | number): string {
  const n = typeof price === 'string' ? parseFloat(price) : price
  if (isNaN(n)) return `${price} EGP`
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} EGP`
}
