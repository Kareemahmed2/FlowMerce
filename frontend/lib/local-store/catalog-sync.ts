import type { CatalogCategory, CatalogProduct } from '@/components/merchant/onboarding/types'
import type { CategoryRow, ProductRow } from '@/components/merchant/products/products-data'

export function categoriesToFlat(categories: CatalogCategory[]): {
  categoryRows: CategoryRow[]
  products: ProductRow[]
} {
  const categoryRows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    count: c.products.length,
  }))
  const products: ProductRow[] = categories.flatMap((c) =>
    c.products.map((p) => catalogProductToRow(p, c.id))
  )
  return { categoryRows, products }
}

function catalogProductToRow(p: CatalogProduct, categoryId: number): ProductRow {
  return {
    id: p.id,
    categoryId,
    name: p.name,
    price: Number(p.price) || 0,
    stock: p.stock ?? 0,
    status: p.status ?? 'active',
    sales: p.sales ?? 0,
    images: p.images,
    description: p.description,
  }
}

function rowToCatalogProduct(p: ProductRow): CatalogProduct {
  return {
    id: p.id,
    name: p.name,
    price: String(p.price),
    description: p.description,
    images: p.images,
    stock: p.stock,
    sales: p.sales,
    status: p.status,
  }
}

export function rebuildCategories(
  categoryRows: CategoryRow[],
  products: ProductRow[]
): CatalogCategory[] {
  return categoryRows.map((cr) => ({
    id: cr.id,
    name: cr.name,
    products: products
      .filter((p) => p.categoryId === cr.id)
      .map((p) => rowToCatalogProduct(p)),
  }))
}

export function upsertProduct(
  categories: CatalogCategory[],
  product: ProductRow
): CatalogCategory[] {
  const { categoryRows, products } = categoriesToFlat(categories)
  const others = products.filter((p) => p.id !== product.id)
  const nextProducts = [...others, product]
  return rebuildCategories(categoryRows, nextProducts)
}

export function removeProductFromCategories(
  categories: CatalogCategory[],
  productId: number
): CatalogCategory[] {
  return categories.map((c) => ({
    ...c,
    products: c.products.filter((p) => p.id !== productId),
  }))
}

export function addCategoryToCategories(
  categories: CatalogCategory[],
  name: string
): CatalogCategory[] {
  const id = Date.now()
  return [...categories, { id, name: name.trim(), products: [] }]
}
