export interface ProductRow {
  id: string
  name: string
  category: string
  sku: string
  barcode: string
  brand: string
  description: string
  imageUrl: string
  baseUnitId: string
  purchaseUnitId: string | null
  sellingUnitId: string | null
  purchasePrice: number
  sellingPrice: number
  minStock: number
  maxStock: number
  reorderLevel: number
  openingStock: number
  currentStock: number
  status: 'active' | 'inactive' | 'discontinued'
  createdAt: string
  updatedAt: string
}

export interface ProductWithRelations extends ProductRow {
  baseUnitName: string
  baseUnitSymbol: string
  purchaseUnitName: string | null
  purchaseUnitSymbol: string | null
  sellingUnitName: string | null
  sellingUnitSymbol: string | null
  units: ProductUnitRow[]
  productConversions: ProductConversionRow[]
}

export interface ProductUnitRow {
  id: string
  productId: string
  unitId: string
  unitName: string
  unitSymbol: string
  unitType: string
  factorToBase: number
  isPurchaseUnit: boolean
  isSellingUnit: boolean
  isActive: boolean
  createdAt: string
}

export interface ProductConversionRow {
  id: string
  productId: string
  fromUnitId: string
  toUnitId: string
  fromUnitName: string
  fromUnitSymbol: string
  toUnitName: string
  toUnitSymbol: string
  conversionFactor: number
  relationshipText: string
  createdAt: string
  updatedAt: string
}

export interface InventoryTransactionRow {
  id: string
  productId: string
  transactionType: 'purchase' | 'sale' | 'adjustment' | 'opening_stock' | 'return'
  unitId: string
  unitName: string
  unitSymbol: string
  unitQuantity: number
  baseQuantity: number
  previousStock: number
  remainingStock: number
  referenceType: string | null
  referenceId: string | null
  notes: string
  createdAt: string
}

export interface PurchaseRow {
  id: string
  purchaseNumber: string
  supplierName: string
  notes: string
  totalItems: number
  createdAt: string
  updatedAt: string
  items?: PurchaseItemRow[]
}

export interface PurchaseItemRow {
  id: string
  purchaseId: string
  productId: string
  productName: string
  productSku: string
  unitId: string
  unitName: string
  unitSymbol: string
  quantity: number
  baseQuantity: number
  unitPrice: number
  totalPrice: number
  createdAt: string
}

export interface SaleRow {
  id: string
  saleNumber: string
  customerName: string
  notes: string
  totalItems: number
  createdAt: string
  updatedAt: string
  items?: SaleItemRow[]
}

export interface SaleItemRow {
  id: string
  saleId: string
  productId: string
  productName: string
  productSku: string
  unitId: string
  unitName: string
  unitSymbol: string
  quantity: number
  baseQuantity: number
  unitPrice: number
  totalPrice: number
  createdAt: string
}
