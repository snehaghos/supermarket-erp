const API_BASE = '/api'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json()
}

function getAuthHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' }
}

// ── Generic CRUD helpers ────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: getAuthHeaders() })
  return handleResponse<T>(res)
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

async function del<T = void>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  return handleResponse<T>(res)
}

// ──── Types ─────────────────────────────────────────────────────────

export interface UnitRow {
  id: string
  name: string
  symbol: string
  type: 'Count' | 'Weight' | 'Volume' | 'Length' | 'Area' | 'Packaging'
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface CreateUnitInput {
  name: string
  symbol: string
  type: UnitRow['type']
}

export interface UpdateUnitInput {
  name?: string
  symbol?: string
  type?: UnitRow['type']
}

export interface ConversionRow {
  id: string
  parentUnitId: string
  childUnitId: string
  factor: number
  parentUnitName: string
  parentUnitSymbol: string
  childUnitName: string
  childUnitSymbol: string
  createdAt: string
}

export interface CreateConversionInput {
  parentUnitId: string
  childUnitId: string
  factor: number
}

export interface UpdateConversionInput {
  parentUnitId?: string
  childUnitId?: string
  factor?: number
}

export interface ConversionStep {
  unitId: string
  unitName: string
  unitSymbol: string
  quantity: number
}

export interface PreviewResult {
  steps: ConversionStep[]
}

export interface HealthCheck {
  status: string
  timestamp: string
  uptime: number
}

// ──── Product Types ─────────────────────────────────────────────────

export interface ProductWithRelations {
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

export interface CreateProductInput {
  name: string
  category: string
  sku: string
  barcode?: string
  brand?: string
  description: string
  imageUrl?: string
  baseUnitId: string
  purchaseUnitId?: string | null
  sellingUnitId?: string | null
  purchasePrice?: number
  sellingPrice?: number
  minStock: number
  maxStock?: number
  reorderLevel?: number
  openingStock: number
  additionalUnits: { unitId: string; isPurchaseUnit: boolean; isSellingUnit: boolean }[]
  productConversions?: { fromUnitId: string; toUnitId: string; conversionFactor: number }[]
}

export interface UpdateProductInput {
  name?: string
  category?: string
  sku?: string
  barcode?: string
  brand?: string
  description?: string
  imageUrl?: string
  baseUnitId?: string
  purchaseUnitId?: string | null
  sellingUnitId?: string | null
  purchasePrice?: number
  sellingPrice?: number
  minStock?: number
  maxStock?: number
  reorderLevel?: number
  status?: 'active' | 'inactive' | 'discontinued'
}

export interface PurchaseStockInput {
  productId: string
  unitId: string
  quantity: number
  unitPrice: number
  supplierName: string
  notes: string
}

export interface SellStockInput {
  productId: string
  unitId: string
  quantity: number
  unitPrice: number
  customerName: string
  notes: string
}

export interface AdjustStockInput {
  productId: string
  newQuantity: number
  notes: string
}

export interface PurchaseResult {
  purchaseId: string
  item: Record<string, unknown>
  remainingStock: number
}

export interface SellResult {
  saleId: string
  item: Record<string, unknown>
  remainingStock: number
}

export interface AdjustResult {
  previousStock: number
  newStock: number
  difference: number
}

export interface StockValidation {
  available: boolean
  availableInBase: number
  requestedInBase: number
  displayAvailable: string
}

export interface DisplayStock {
  baseQuantity: number
  baseUnitName: string
  baseUnitSymbol: string
  display: { unitId: string; unitName: string; unitSymbol: string; quantity: number }[]
  displayText: string
  isLowStock: boolean
}

export interface TransactionRow {
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

// ──── Units API ─────────────────────────────────────────────────────

export const unitsApi = {
  getAll: () => get<UnitRow[]>('/units'),
  getById: (id: string) => get<UnitRow>(`/units/${id}`),
  create: (input: CreateUnitInput) => post<UnitRow>('/units', input),
  update: (id: string, input: UpdateUnitInput) => patch<UnitRow>(`/units/${id}`, input),
  delete: (id: string) => del(`/units/${id}`),
}

// ──── Conversions API ───────────────────────────────────────────────

export const conversionsApi = {
  getAll: () => get<ConversionRow[]>('/conversions'),
  getById: (id: string) => get<ConversionRow>(`/conversions/${id}`),
  create: (input: CreateConversionInput) => post<ConversionRow>('/conversions', input),
  update: (id: string, input: UpdateConversionInput) => patch<ConversionRow>(`/conversions/${id}`, input),
  delete: (id: string) => del(`/conversions/${id}`),
  preview: (quantity: number, unitId: string) =>
    post<PreviewResult>('/conversions/preview', { quantity, unitId }),
}

// ──── Products API ──────────────────────────────────────────────────

export const productsApi = {
  getAll: () => get<ProductWithRelations[]>('/products'),
  getById: (id: string) => get<ProductWithRelations>(`/products/${id}`),
  create: (input: CreateProductInput) => post<ProductWithRelations>('/products', input),
  update: (id: string, input: UpdateProductInput) => patch<ProductWithRelations>(`/products/${id}`, input),
  delete: (id: string) => del(`/products/${id}`),
  purchase: (input: PurchaseStockInput) => post<PurchaseResult>('/products/stock/purchase', input),
  sell: (input: SellStockInput) => post<SellResult>('/products/stock/sell', input),
  adjust: (input: AdjustStockInput) => post<AdjustResult>('/products/stock/adjust', input),
  validateStock: (productId: string, unitId: string, quantity: number) =>
    post<StockValidation>('/products/stock/validate', { productId, unitId, quantity }),
  checkConversions: (baseUnitId: string, unitIds: string[]) =>
    post<{ unitId: string; unitName: string; unitSymbol: string; valid: boolean; factor: number | null; error: string | null }[]>(
      '/products/check-conversions', { baseUnitId, unitIds }
    ),
  getDisplayStock: (id: string) => get<DisplayStock>(`/products/${id}/stock/display`),
  getTransactions: (productId?: string) =>
    get<TransactionRow[]>(`/products/transactions/all${productId ? `?productId=${productId}` : ''}`),
  getPurchases: () => get<Record<string, unknown>[]>('/products/purchases/list'),
  getPurchaseById: (id: string) => get<Record<string, unknown>>(`/products/purchases/${id}`),
  getSales: () => get<Record<string, unknown>[]>('/products/sales/list'),
  getSaleById: (id: string) => get<Record<string, unknown>>(`/products/sales/${id}`),
  // Product-specific conversions
  getProductConversions: (productId: string) =>
    get<ProductConversionRow[]>(`/products/${productId}/conversions`),
  createProductConversion: (productId: string, input: { fromUnitId: string; toUnitId: string; conversionFactor: number }) =>
    post<ProductConversionRow>(`/products/${productId}/conversions`, input),
  updateProductConversion: (id: string, input: { fromUnitId?: string; toUnitId?: string; conversionFactor?: number }) =>
    patch<ProductConversionRow>(`/products/conversions/${id}`, input),
  deleteProductConversion: (id: string) => del(`/products/conversions/${id}`),
}

// ──── Health API ────────────────────────────────────────────────────

export const healthApi = {
  check: () => get<HealthCheck>('/health'),
}
