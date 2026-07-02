'use client'

/**
 * Merchant Products page — backend-only (Phase C3).
 *
 * Data source: productService + categoryService.
 * Auth: requires a merchant JWT + a known storeId (from auth.storeId).
 *
 * NOTE: This page does NOT fall back to localStorage. If the backend is
 * unreachable or storeId is unknown, the page shows a clear error state.
 * The customer-facing storefront still has its own localStorage-backed mock
 * via storefrontService — only the *merchant management* surface here is
 * strictly backend-driven.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMerchantAuth } from '@/store/auth-store'
import { productService } from '@/services/product.service'
import { categoryService } from '@/services/category.service'
import { inventoryService } from '@/services/inventory.service'
import { uploadService } from '@/services/upload.service'
import type { ProductResponse } from '@/types/product.types'
import type { CategoryResponse } from '@/types/category.types'
import type { CategoryRow, ProductRow } from './products-data'
import { P } from './products-styles'

type FormState = {
  name: string
  price: string
  stock: string
  description: string
  categoryId: number | null
  status: 'active' | 'inactive'
  images: string[]
}

const emptyForm = (): FormState => ({
  name: '',
  price: '',
  stock: '',
  description: '',
  categoryId: null,
  status: 'active',
  images: [],
})

// ── Backend → ProductRow mapper ──────────────────────────────────────────────

function backendToRow(p: ProductResponse): ProductRow {
  return {
    id: p.productId,
    categoryId: p.categoryId ?? 0,
    name: p.name,
    price: Number(p.basePrice),
    stock: p.availableQuantity,
    status: p.isActive ? 'active' : 'inactive',
    sales: 0, // backend doesn't expose this on ProductResponse; default 0
    images: p.media.map((m) => m.mediaUrl),
    description: p.description ?? '',
  }
}

function backendCatToRow(c: CategoryResponse, products: ProductRow[]): CategoryRow {
  return {
    id: c.categoryId,
    name: c.name,
    count: products.filter((p) => p.categoryId === c.categoryId).length,
  }
}

function productToForm(p: ProductRow): FormState {
  return {
    name: p.name,
    price: String(p.price),
    stock: String(p.stock),
    description: p.description,
    categoryId: p.categoryId,
    status: p.status,
    images: p.images,
  }
}

// ── Product modal ────────────────────────────────────────────────────────────

function ProductModal({
  product,
  categories,
  storeId,
  onSave,
  onClose,
  onCategoryCreated,
  isSaving,
  saveError,
  authHeaders,
}: {
  product: ProductRow | null
  categories: CategoryRow[]
  storeId: number | null
  onSave: (p: FormState) => void
  onClose: () => void
  onCategoryCreated: (c: CategoryRow) => void
  isSaving: boolean
  saveError: string
  authHeaders?: Record<string, string>
}) {
  const [form, setForm] = useState<FormState>(product ? productToForm(product) : emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imgUploading, setImgUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const isEdit = !!product?.id

  // Inline category creation
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat]   = useState(false)
  const [catError, setCatError]     = useState('')

  const handleAddCategory = async () => {
    const name = newCatName.trim()
    if (!name || storeId === null) return
    setAddingCat(true)
    setCatError('')
    const r = await categoryService.createStoreCategory(storeId, { name }, authHeaders)
    setAddingCat(false)
    if (!r.ok) { setCatError(r.error); return }
    const newRow: CategoryRow = { id: r.data.categoryId, name: r.data.name, count: 0 }
    onCategoryCreated(newRow)
    setForm((p) => ({ ...p, categoryId: r.data.categoryId }))
    setNewCatName('')
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Product name is required'
    if (!form.price || Number.isNaN(+form.price) || +form.price <= 0) e.price = 'Enter a valid price'
    if (form.stock === '' || Number.isNaN(+form.stock) || +form.stock < 0)
      e.stock = 'Enter a valid stock quantity'
    if (!form.categoryId) e.categoryId = 'Select a category'
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    onSave(form)
  }

  const handleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    // Show local previews immediately
    const localUrls = files.map((f) => URL.createObjectURL(f))
    setForm((p) => ({ ...p, images: [...p.images, ...localUrls] }))
    setImgUploading(true)
    const uploadedUrls = await Promise.all(
      files.map(async (f, i) => {
        const result = await uploadService.uploadImage(f, authHeaders ?? {})
        if (result.ok) { URL.revokeObjectURL(localUrls[i]); return result.data.url }
        return localUrls[i] // keep blob on failure
      })
    )
    setImgUploading(false)
    setForm((p) => {
      const withoutLocal = p.images.filter((img) => !localUrls.includes(img))
      return { ...p, images: [...withoutLocal, ...uploadedUrls] }
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeImage = (i: number) =>
    setForm((p) => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))

  return (
    <>
      <div style={P.backdrop} onClick={onClose} role="presentation" />
      <div style={P.modal}>
        <div style={P.modalHeader}>
          <p style={P.modalTitle}>{isEdit ? 'Edit Product' : 'Add New Product'}</p>
          <button type="button" style={P.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={P.modalBody}>
          {saveError ? (
            <div role="alert" style={{ background: '#FCEBEB', color: '#A32D2D', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              {saveError}
            </div>
          ) : null}

          <div style={P.field}>
            <label style={P.label}>
              Product Name <span style={P.req}>*</span>
            </label>
            <input
              style={{ ...P.input, ...(errors.name ? P.inputError : {}) }}
              placeholder="e.g. Gold Ring Set"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            {errors.name && <p style={P.errorMsg}>{errors.name}</p>}
          </div>

          <div style={P.fieldRow}>
            <div style={{ ...P.field, flex: 1 }}>
              <label style={P.label}>
                Price (EGP) <span style={P.req}>*</span>
              </label>
              <input
                style={{ ...P.input, ...(errors.price ? P.inputError : {}) }}
                type="number"
                placeholder="0"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              />
              {errors.price && <p style={P.errorMsg}>{errors.price}</p>}
            </div>
            <div style={{ ...P.field, flex: 1 }}>
              <label style={P.label}>
                Stock Qty <span style={P.req}>*</span>
              </label>
              <input
                style={{ ...P.input, ...(errors.stock ? P.inputError : {}) }}
                type="number"
                placeholder="0"
                value={form.stock}
                onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
              />
              {errors.stock && <p style={P.errorMsg}>{errors.stock}</p>}
            </div>
          </div>

          <div style={P.field}>
            <label style={P.label}>
              Category <span style={P.req}>*</span>
            </label>

            {categories.length === 0 ? (
              <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 8px' }}>
                No categories yet — create one below.
              </p>
            ) : (
              <div style={P.catChips}>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    style={{ ...P.catChip, ...(form.categoryId === c.id ? P.catChipActive : {}) }}
                    onClick={() => setForm((p) => ({ ...p, categoryId: c.id }))}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Inline category creation */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                style={{
                  flex: 1, padding: '7px 11px', borderRadius: 8, fontSize: 12,
                  border: '1px solid #e8e3d8', fontFamily: 'inherit', outline: 'none',
                }}
                placeholder="New category name…"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddCategory() } }}
                disabled={addingCat}
              />
              <button
                type="button"
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12,
                  fontWeight: 600, cursor: addingCat || !newCatName.trim() ? 'not-allowed' : 'pointer',
                  background: addingCat || !newCatName.trim() ? '#e8e3d8' : '#0F0E0C',
                  color: addingCat || !newCatName.trim() ? '#aaa' : '#fff',
                  flexShrink: 0,
                }}
                onClick={() => void handleAddCategory()}
                disabled={addingCat || !newCatName.trim()}
              >
                {addingCat ? '…' : '+ Add'}
              </button>
            </div>
            {catError && <p style={{ ...P.errorMsg, marginTop: 4 }}>{catError}</p>}
            {errors.categoryId && <p style={P.errorMsg}>{errors.categoryId}</p>}
          </div>

          <div style={P.field}>
            <label style={P.label}>Description</label>
            <textarea
              style={P.textarea}
              rows={3}
              placeholder="Describe your product…"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div style={P.field}>
            <label style={P.label}>Product Images</label>
            <div style={P.imagesRow}>
              {form.images.map((img, i) => (
                <div key={i} style={P.imgWrap}>
                  <img src={img} style={P.imgThumb} alt="" />
                  <button type="button" style={P.imgRemove} onClick={() => removeImage(i)}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" style={P.addImgBtn} onClick={() => fileRef.current?.click()}>
                <span style={{ fontSize: 20, opacity: 0.4 }}>+</span>
                <span style={P.addImgLabel}>Add</span>
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { void handleImages(e) }}
            />
          </div>

          <div style={P.field}>
            <label style={P.label}>Status</label>
            <div style={P.statusToggle}>
              {(['active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  style={{ ...P.statusBtn, ...(form.status === s ? P.statusBtnActive : {}) }}
                  onClick={() => setForm((p) => ({ ...p, status: s }))}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={P.modalFooter}>
          <button type="button" style={P.cancelBtn} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...P.saveBtn, opacity: isSaving ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </>
  )
}

function DeleteConfirm({
  product,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  product: ProductRow
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <>
      <div style={P.backdrop} onClick={onCancel} role="presentation" />
      <div style={P.confirmModal}>
        <p style={P.confirmTitle}>Delete product?</p>
        <p style={P.confirmDesc}>
          <strong>{product.name}</strong> will be permanently removed from your store.
        </p>
        <div style={P.confirmActions}>
          <button type="button" style={P.cancelBtn} onClick={onCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...P.deleteBtn, opacity: isDeleting ? 0.6 : 1 }}
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const auth = useMerchantAuth()
  const storeId = auth.storeId
  const isMobile = useIsMobile()

  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal state
  const [modal, setModal] = useState<ProductRow | 'add' | null>(null)
  const [modalError, setModalError] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null)
  const [deletingProduct, setDeletingProduct] = useState(false)

  // Filters
  const [activeCat, setActiveCat] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadAll = async () => {
    if (storeId === null) return
    setLoading(true)
    setError('')
    const [productsR, categoriesR] = await Promise.all([
      productService.getStoreProducts(storeId, auth.getAuthHeader()),
      categoryService.getStoreCategories(storeId, auth.getAuthHeader()),
    ])
    if (!productsR.ok) {
      setError(productsR.error)
      setLoading(false)
      return
    }
    const rows = productsR.data.map(backendToRow)
    setProducts(rows)
    const cats = categoriesR.ok ? categoriesR.data : []
    setCategories(cats.map((c) => backendCatToRow(c, rows)))
    setLoading(false)
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const handleSave = async (form: FormState) => {
    if (storeId === null) {
      setModalError('No store selected. Connect to the backend first.')
      return
    }
    setSavingProduct(true)
    setModalError('')

    const isEdit = modal !== 'add' && modal !== null
    const result = isEdit
      ? await productService.update(
          storeId,
          (modal as ProductRow).id,
          {
            name: form.name,
            description: form.description,
            basePrice: Number(form.price),
            categoryId: form.categoryId ?? undefined,
          },
          auth.getAuthHeader()
        )
      : await productService.create(
          storeId,
          {
            name: form.name,
            description: form.description,
            basePrice: Number(form.price),
            categoryId: form.categoryId ?? undefined,
            initialQuantity: Number(form.stock),
            lowStockThreshold: 5,
          },
          auth.getAuthHeader()
        )

    if (!result.ok) {
      setModalError(result.error)
      setSavingProduct(false)
      return
    }

    // If the merchant set inactive status while editing, toggle it on backend.
    if (isEdit && form.status === 'inactive' && result.data.isActive) {
      await productService.toggleStatus(storeId, result.data.productId, auth.getAuthHeader())
    } else if (isEdit && form.status === 'active' && !result.data.isActive) {
      await productService.toggleStatus(storeId, result.data.productId, auth.getAuthHeader())
    }

    // Stock changes don't go through the product update endpoint — they must be
    // applied via the inventory endpoint, which takes a signed delta (new − old).
    if (isEdit) {
      const oldStock = (modal as ProductRow).stock
      const newStock = Number(form.stock)
      const delta = newStock - oldStock
      if (delta !== 0 && !Number.isNaN(delta)) {
        const stockR = await inventoryService.updateStock(
          result.data.productId,
          { quantity: delta, note: 'Manual stock edit' },
          auth.getAuthHeader()
        )
        if (!stockR.ok) {
          setModalError(`Product saved, but stock update failed: ${stockR.error}`)
          setSavingProduct(false)
          void loadAll()
          return
        }
      }
    }

    // If the merchant added new images (data: URLs), POST them as media URLs.
    // NOTE: real backend may need real URLs (CDN/S3) — sending data: URLs may exceed body size limits.
    const previousImageUrls = isEdit ? (modal as ProductRow).images : []
    const newImages = form.images.filter((img) => !previousImageUrls.includes(img))
    for (const url of newImages) {
      await productService.addMedia(
        storeId,
        result.data.productId,
        { mediaUrl: url, mediaType: 'IMAGE' },
        auth.getAuthHeader()
      )
    }

    setSavingProduct(false)
    setModal(null)
    void loadAll()
  }

  const handleDelete = async () => {
    if (!deleteTarget || storeId === null) return
    setDeletingProduct(true)
    const result = await productService.delete(storeId, deleteTarget.id, auth.getAuthHeader())
    setDeletingProduct(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDeleteTarget(null)
    void loadAll()
  }

  const handleToggleStatus = async (id: number) => {
    if (storeId === null) return
    const result = await productService.toggleStatus(storeId, id, auth.getAuthHeader())
    if (!result.ok) {
      setError(result.error)
      return
    }
    void loadAll()
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let res = products
    if (activeCat !== 'all') res = res.filter((p) => p.categoryId === activeCat)
    if (statusFilter !== 'all') res = res.filter((p) => p.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      res = res.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      )
    }
    return res
  }, [products, activeCat, statusFilter, search])

  const totalRevenue = products.reduce((s, p) => s + p.price * p.sales, 0)
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length
  const outOfStock = products.filter((p) => p.stock === 0).length
  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? '—'

  // ── Render ─────────────────────────────────────────────────────────────────

  if (storeId === null) {
    return (
      <div style={{ ...P.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: '#0F0E0C' }}>
            No store yet
          </p>
          <p style={{ fontSize: 13, color: '#888' }}>
            Finish creating your store to start managing products.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ ...P.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid #e9ecef', borderTopColor: '#0F0E0C', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...P.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div role="alert" style={{ textAlign: 'center', maxWidth: 480, background: '#FCEBEB', color: '#A32D2D', borderRadius: 12, padding: 24, border: '1px solid #F7C1C1' }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>Could not load products</p>
          <p style={{ fontSize: 13, margin: '0 0 14px' }}>{error}</p>
          <button type="button" style={P.addBtn} onClick={() => void loadAll()}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={P.page}>
      <div style={P.statsStrip}>
        {[
          {
            label: 'Total Products',
            value: String(products.length),
            sub: `${products.filter((p) => p.status === 'active').length} active`,
            warn: false,
            danger: false,
          },
          {
            label: 'Total Revenue',
            value: `${totalRevenue.toLocaleString()} EGP`,
            sub: 'from all sales',
            warn: false,
            danger: false,
          },
          {
            label: 'Low Stock',
            value: String(lowStock),
            sub: '5 or fewer units',
            warn: lowStock > 0,
            danger: false,
          },
          {
            label: 'Out of Stock',
            value: String(outOfStock),
            sub: 'needs restocking',
            warn: false,
            danger: outOfStock > 0,
          },
        ].map((s, i) => (
          <div key={i} style={P.statCard}>
            <p style={P.statLabel}>{s.label}</p>
            <p
              style={{
                ...P.statValue,
                ...(s.warn ? { color: '#854F0B' } : s.danger ? { color: '#A32D2D' } : {}),
              }}
            >
              {s.value}
            </p>
            <p style={P.statSub}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ ...P.body, ...(isMobile ? { flexDirection: 'column' as const } : {}) }}>
        <div style={{
          ...P.catSidebar,
          ...(isMobile ? {
            width: '100%',
            flexShrink: 1,
            position: 'static' as const,
            flexDirection: 'row' as const,
            overflowX: 'auto' as const,
            padding: '4px 6px',
            gap: 4,
            height: 'auto',
          } : {})
        }}>
          {!isMobile && (
            <div style={P.catSidebarHeader}>
              <p style={P.sidebarTitle}>Categories</p>
            </div>
          )}

          <div style={{ ...P.catList, ...(isMobile ? { flexDirection: 'row' as const, gap: 4, alignItems: 'center' } : {}) }}>
            <button
              type="button"
              style={{ ...P.catItem, ...(activeCat === 'all' ? P.catItemActive : {}), ...(isMobile ? { width: 'auto', flexShrink: 0, whiteSpace: 'nowrap' as const } : {}) }}
              onClick={() => setActiveCat('all')}
            >
              <span>All Products</span>
              <span style={P.catBadge}>{products.length}</span>
            </button>
            {categories.map((c) => {
              const count = products.filter((p) => p.categoryId === c.id).length
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{ ...P.catItem, ...(activeCat === c.id ? P.catItemActive : {}), ...(isMobile ? { width: 'auto', flexShrink: 0, whiteSpace: 'nowrap' as const } : {}) }}
                  onClick={() => setActiveCat(c.id)}
                >
                  <span style={P.catItemName}>{c.name}</span>
                  <span style={P.catBadge}>{count}</span>
                </button>
              )
            })}
            {!isMobile && (
              <p style={{ fontSize: 11, color: '#aaa', marginTop: 12, paddingLeft: 8 }}>
                Categories are managed by admin via /categories.
              </p>
            )}
          </div>
        </div>

        <div style={P.mainContent}>
          <div style={P.toolbar}>
            <input
              style={P.searchInput}
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={P.toolbarRight}>
              <select
                style={P.select}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div style={P.viewToggle}>
                <button
                  type="button"
                  style={{ ...P.viewBtn, ...(viewMode === 'grid' ? P.viewBtnActive : {}) }}
                  onClick={() => setViewMode('grid')}
                >
                  ▦
                </button>
                <button
                  type="button"
                  style={{ ...P.viewBtn, ...(viewMode === 'list' ? P.viewBtnActive : {}) }}
                  onClick={() => setViewMode('list')}
                >
                  ☰
                </button>
              </div>
              <button
                type="button"
                style={P.addBtn}
                onClick={() => {
                  setModalError('')
                  setModal('add')
                }}
              >
                + Add Product
              </button>
            </div>
          </div>

          <p style={P.resultCount}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
            {activeCat !== 'all' ? ` in ${catName(activeCat as number)}` : ''}
          </p>

          {filtered.length === 0 && (
            <div style={P.emptyState}>
              <span style={{ fontSize: 36, opacity: 0.15 }}>⊞</span>
              <p style={P.emptyTitle}>No products found</p>
              <p style={P.emptySub}>Try adjusting your filters or add a new product.</p>
              <button
                type="button"
                style={P.addBtn}
                onClick={() => {
                  setModalError('')
                  setModal('add')
                }}
              >
                + Add Product
              </button>
            </div>
          )}

          {viewMode === 'grid' && filtered.length > 0 && (
            <div style={P.productGrid}>
              {filtered.map((product) => {
                const isLow = product.stock > 0 && product.stock <= 5
                const isOut = product.stock === 0
                return (
                  <div key={product.id} style={P.productCard}>
                    <div style={P.productImgWrap}>
                      {product.images[0] ? (
                        <img src={product.images[0]} style={P.productImg} alt={product.name} />
                      ) : (
                        <div style={P.productImgPlaceholder}>◻</div>
                      )}
                      <span
                        style={{
                          ...P.statusDot,
                          background: product.status === 'active' ? '#639922' : '#C8C4BC',
                        }}
                      />
                    </div>
                    <div style={P.productInfo}>
                      <p style={P.productName}>{product.name}</p>
                      <p style={P.productCat}>{catName(product.categoryId)}</p>
                      <div style={P.productPriceRow}>
                        <span style={P.productPrice}>{product.price.toLocaleString()} EGP</span>
                        <span
                          style={{
                            ...P.stockTag,
                            ...(isOut ? P.stockTagOut : isLow ? P.stockTagLow : P.stockTagOk),
                          }}
                        >
                          {isOut ? 'Out of stock' : `${product.stock} left`}
                        </span>
                      </div>
                    </div>
                    <div style={P.productCardActions}>
                      <button
                        type="button"
                        style={P.cardActionBtn}
                        onClick={() => {
                          setModalError('')
                          setModal(product)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        style={{
                          ...P.cardActionBtn,
                          color: product.status === 'active' ? '#854F0B' : '#3B6D11',
                        }}
                        onClick={() => handleToggleStatus(product.id)}
                      >
                        {product.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        style={{ ...P.cardActionBtn, color: '#A32D2D' }}
                        onClick={() => setDeleteTarget(product)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {viewMode === 'list' && filtered.length > 0 && (
            <div style={P.listWrap}>
              <div style={{ overflowX: 'auto' }}>
              <table style={P.table}>
                <thead>
                  <tr style={P.thead}>
                    {['Product', 'Category', 'Price', 'Stock', 'Status', ''].map((h) => (
                      <th key={h} style={P.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product, i) => {
                    const isLow = product.stock > 0 && product.stock <= 5
                    const isOut = product.stock === 0
                    return (
                      <tr key={product.id} style={{ ...P.tr, ...(i % 2 !== 0 ? P.trAlt : {}) }}>
                        <td style={P.td}>
                          <div style={P.listProductCell}>
                            <div style={P.listThumb}>
                              {product.images[0] ? (
                                <img
                                  src={product.images[0]}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  alt=""
                                />
                              ) : (
                                <span style={{ fontSize: 14, opacity: 0.3 }}>◻</span>
                              )}
                            </div>
                            <div>
                              <p style={P.listProductName}>{product.name}</p>
                              <p style={P.listProductDesc}>{product.description.slice(0, 50)}…</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...P.td, color: '#888' }}>{catName(product.categoryId)}</td>
                        <td style={{ ...P.td, fontWeight: 600 }}>{product.price.toLocaleString()} EGP</td>
                        <td style={P.td}>
                          <span
                            style={{
                              ...P.stockTag,
                              ...(isOut ? P.stockTagOut : isLow ? P.stockTagLow : P.stockTagOk),
                            }}
                          >
                            {isOut ? 'Out' : product.stock}
                          </span>
                        </td>
                        <td style={P.td}>
                          <span
                            style={{
                              ...P.listStatusPill,
                              ...(product.status === 'active' ? P.listStatusActive : P.listStatusInactive),
                            }}
                          >
                            {product.status === 'active' ? '● Active' : '○ Inactive'}
                          </span>
                        </td>
                        <td style={P.td}>
                          <div style={P.listActions}>
                            <button
                              type="button"
                              style={P.listActionBtn}
                              onClick={() => {
                                setModalError('')
                                setModal(product)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              style={P.listActionBtn}
                              onClick={() => handleToggleStatus(product.id)}
                            >
                              {product.status === 'active' ? 'Hide' : 'Show'}
                            </button>
                            <button
                              type="button"
                              style={{ ...P.listActionBtn, color: '#A32D2D' }}
                              onClick={() => setDeleteTarget(product)}
                            >
                              Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal !== null && (
        <ProductModal
          key={modal === 'add' ? 'add' : modal.id}
          product={modal === 'add' ? null : modal}
          categories={categories}
          storeId={storeId}
          onSave={handleSave}
          onClose={() => setModal(null)}
          onCategoryCreated={(c) => setCategories((prev) => [...prev, c])}
          isSaving={savingProduct}
          saveError={modalError}
          authHeaders={auth.getAuthHeader()}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          product={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={deletingProduct}
        />
      )}
    </div>
  )
}
