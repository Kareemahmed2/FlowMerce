export type ProductRow = {
  id: number
  categoryId: number
  name: string
  price: number
  stock: number
  status: 'active' | 'inactive'
  sales: number
  images: string[]
  description: string
}

export type CategoryRow = {
  id: number
  name: string
  count: number
}
