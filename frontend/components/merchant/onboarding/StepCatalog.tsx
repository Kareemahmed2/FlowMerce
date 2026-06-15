'use client'

import { useRef, useState } from 'react'
import type { CatalogCategory, CatalogProduct } from './types'
import { styles } from './wizard-styles'
import { uploadService } from '@/services/upload.service'
import { useMerchantAuth } from '@/store/auth-store'

type Props = {
  categories: CatalogCategory[]
  onChange: (v: CatalogCategory[]) => void
}

export function StepCatalog({ categories, onChange }: Props) {
  const auth = useMerchantAuth()
  const [newCatName, setNewCatName] = useState('')
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [newProduct, setNewProduct] = useState<{
    name: string
    price: string
    description: string
    images: string[]
  }>({ name: '', price: '', description: '', images: [] })
  const [imgUploading, setImgUploading] = useState(false)
  const [imgError, setImgError] = useState<string | null>(null)
  const productFileRef = useRef<HTMLInputElement>(null)

  const addCategory = () => {
    if (!newCatName.trim()) return
    const cat: CatalogCategory = { id: Date.now(), name: newCatName.trim(), products: [] }
    onChange([...categories, cat])
    setNewCatName('')
    setActiveCategory(cat.id)
  }

  const removeCategory = (id: number) => {
    onChange(categories.filter((c) => c.id !== id))
    if (activeCategory === id) setActiveCategory(null)
  }

  const addProduct = (catId: number) => {
    if (!newProduct.name.trim()) return
    const product: CatalogProduct = {
      id: Date.now(),
      name: newProduct.name,
      price: newProduct.price,
      description: newProduct.description,
      images: newProduct.images,
      stock: 0,
      sales: 0,
      status: 'active',
    }
    onChange(
      categories.map((c) =>
        c.id === catId ? { ...c, products: [...c.products, product] } : c
      )
    )
    setNewProduct({ name: '', price: '', description: '', images: [] })
  }

  const removeProduct = (catId: number, prodId: number) => {
    onChange(
      categories.map((c) =>
        c.id === catId ? { ...c, products: c.products.filter((p) => p.id !== prodId) } : c
      )
    )
  }

  const handleProductImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setImgError(null)
    setImgUploading(true)

    // Show local previews immediately for instant feedback
    const localPreviews = files.map((f) => URL.createObjectURL(f))
    setNewProduct((p) => ({ ...p, images: [...p.images, ...localPreviews] }))

    // Upload each file to backend and replace local blob URLs with real URLs
    const uploadedUrls = await Promise.all(
      files.map(async (file, i) => {
        const result = await uploadService.uploadImage(file, auth.getAuthHeader())
        if (result.ok) {
          URL.revokeObjectURL(localPreviews[i])
          return result.data.url
        }
        // Keep local blob URL on failure (works for this session)
        return localPreviews[i]
      })
    )

    setImgUploading(false)

    // Replace the local previews with the final URLs (real or fallback blob)
    setNewProduct((p) => {
      const withoutLocal = p.images.filter((img) => !localPreviews.includes(img))
      return { ...p, images: [...withoutLocal, ...uploadedUrls] }
    })

    const failed = uploadedUrls.filter((u) => u.startsWith('blob:')).length
    if (failed > 0) {
      setImgError(`${failed} image(s) failed to upload — they'll show in this session but not after refresh.`)
    }

    // Reset file input
    if (productFileRef.current) productFileRef.current.value = ''
  }

  const activeCat = categories.find((c) => c.id === activeCategory)

  return (
    <div style={styles.stepContent}>
      <div style={styles.catalogLayout}>
        <div style={styles.categoryPanel}>
          <p style={styles.panelTitle}>Categories</p>
          <div style={styles.addRow}>
            <input
              style={{ ...styles.input, marginBottom: 0, flex: 1 }}
              placeholder="Category name…"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            />
            <button type="button" style={styles.addBtn} onClick={addCategory}>
              +
            </button>
          </div>
          <div style={styles.catList}>
            {categories.length === 0 && (
              <p style={styles.emptyHint}>No categories yet. Add one above.</p>
            )}
            {categories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  ...styles.catItem,
                  ...(activeCategory === cat.id ? styles.catItemActive : {}),
                }}
                onClick={() => setActiveCategory(cat.id)}
                onKeyDown={(e) => e.key === 'Enter' && setActiveCategory(cat.id)}
                role="button"
                tabIndex={0}
              >
                <span style={styles.catName}>{cat.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={styles.catCount}>{cat.products.length}</span>
                  <button
                    type="button"
                    style={styles.removeBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeCategory(cat.id)
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.productPanel}>
          {!activeCat ? (
            <div style={styles.emptyPanel}>
              <span style={{ fontSize: 32, opacity: 0.2 }}>⊞</span>
              <p style={styles.emptyHint}>Select a category to manage products</p>
            </div>
          ) : (
            <>
              <p style={styles.panelTitle}>
                Products in <strong>{activeCat.name}</strong>
              </p>
              <div style={styles.productGrid}>
                {activeCat.products.map((prod) => (
                  <div key={prod.id} style={styles.productCard}>
                    {prod.images[0] ? (
                      <img src={prod.images[0]} style={styles.productThumb} alt={prod.name} />
                    ) : (
                      <div style={styles.productThumbEmpty}>◻</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={styles.productName}>{prod.name}</p>
                      {prod.price && <p style={styles.productPrice}>{prod.price} EGP</p>}
                    </div>
                    <button
                      type="button"
                      style={styles.removeBtn}
                      onClick={() => removeProduct(activeCat.id, prod.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={styles.addProductForm}>
                <p style={{ ...styles.label, marginBottom: 8 }}>Add Product</p>
                <div style={styles.productFormRow}>
                  <input
                    style={{ ...styles.input, marginBottom: 0, flex: 2 }}
                    placeholder="Product name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    style={{ ...styles.input, marginBottom: 0, flex: 1 }}
                    placeholder="Price"
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
                  />
                </div>
                <textarea
                  style={styles.textarea}
                  placeholder="Short description (optional)"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                />
                <div style={styles.imageUploadRow}>
                  <button
                    type="button"
                    style={{ ...styles.uploadImgBtn, opacity: imgUploading ? 0.6 : 1, cursor: imgUploading ? 'wait' : 'pointer' }}
                    onClick={() => !imgUploading && productFileRef.current?.click()}
                  >
                    {imgUploading ? '⏳ Uploading…' : '+ Add Images'}
                  </button>
                  <input
                    ref={productFileRef}
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => { void handleProductImages(e) }}
                  />
                  {newProduct.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      style={styles.productImgPreview}
                      alt={`preview ${i + 1}`}
                    />
                  ))}
                </div>
                {imgError && (
                  <p style={{ fontSize: 11, color: '#dc2626', margin: '4px 0 0' }}>{imgError}</p>
                )}
                <button
                  type="button"
                  style={styles.primaryBtn}
                  onClick={() => addProduct(activeCat.id)}
                >
                  Add Product
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
