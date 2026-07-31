const API_BASE = '/api'

// ── Structured API Error ──────────────────────────────────────────

export interface ValidationDetail {
  field: string
  message: string
}

export class ApiError extends Error {
  public readonly code: string
  public readonly status: number
  public readonly details: ValidationDetail[]
  public readonly timestamp: string

  constructor(response: {
    error?: string
    code?: string
    status?: number
    details?: ValidationDetail[]
    timestamp?: string
  }, httpStatus: number) {
    super(response.error || `Request failed (HTTP ${httpStatus})`)
    this.name = 'ApiError'
    this.code = response.code || 'UNKNOWN_ERROR'
    this.status = response.status || httpStatus
    this.details = response.details || []
    this.timestamp = response.timestamp || new Date().toISOString()
  }

  /** Returns a user-friendly summary of the error */
  get userMessage(): string {
    if (this.code === 'VALIDATION_ERROR' && this.details.length > 0) {
      const fieldNames = this.details.map(d => {
        const label = d.field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
        return `${label}: ${d.message}`
      })
      return fieldNames.join('; ')
    }

    switch (this.code) {
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again'
      case 'NOT_FOUND':
        return 'The requested item was not found'
      case 'DUPLICATE_ENTRY':
      case 'DUPLICATE_SKU':
      case 'DUPLICATE_UNIT_NAME':
      case 'DUPLICATE_CONVERSION':
        return 'An item with this information already exists'
      case 'INSUFFICIENT_STOCK':
        return 'Not enough stock available'
      case 'CIRCULAR_CONVERSION_CHAIN':
        return 'This conversion would create a circular chain'
      case 'SAME_UNIT':
        return 'Parent and child units must be different'
      case 'UNIT_NOT_AVAILABLE':
        return 'This unit is not available for this product'
      case 'INTERNAL_ERROR':
        return 'Something went wrong. Please try again.'
      default:
        return this.message
    }
  }

  /** Machine-readable error type for categorization */
  get type(): 'validation' | 'not_found' | 'conflict' | 'auth' | 'server' | 'network' | 'unknown' {
    if (this.code === 'VALIDATION_ERROR') return 'validation'
    if (this.code === 'NOT_FOUND') return 'not_found'
    if (this.code.startsWith('DUPLICATE')) return 'conflict'
    if (this.status === 401 || this.status === 403) return 'auth'
    if (this.status >= 500) return 'server'
    if (this.status === 0) return 'network'
    return 'unknown'
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(body, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return body as T
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

export interface MeasurementTypeRow {
  id: string
  name: string
  description: string
  sortOrder: number
  createdAt: string
}

export interface UnitRow {
  id: string
  name: string
  symbol: string
  measurementTypeId: string
  measurementTypeName?: string
  type: string
  isPackaging: boolean
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface CreateUnitInput {
  name: string
  symbol: string
  measurementTypeId: string
  isPackaging?: boolean
}

export interface UpdateUnitInput {
  name?: string
  symbol?: string
  measurementTypeId?: string
  isPackaging?: boolean
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
  mrp: number
  taxClass: string
  minStock: number
  maxStock: number
  reorderLevel: number
  openingStock: number
  currentStock: number
  trackBatch: boolean
  trackExpiry: boolean
  trackSerial: boolean
  batchNumberFormat: string
  manufacturingDateField: string
  expiryDateField: string
  serialFormat: string
  serialValidation: string
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
  productImages: ProductImageRow[]
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

export interface ProductImageRow {
  id: string
  productId: string
  imagePath: string
  originalName: string
  mimeType: string
  fileSize: number
  isPrimary: boolean
  sortOrder: number
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
  purchaseUnitFactor?: number
  sellingUnitId?: string | null
  sellingUnitFactor?: number
  purchasePrice?: number
  sellingPrice?: number
  minStock: number
  maxStock?: number
  reorderLevel?: number
  openingStock?: number
  trackBatch?: boolean
  trackExpiry?: boolean
  trackSerialNumber?: boolean
  mrp?: number
  taxClass?: string
  status?: 'active' | 'inactive' | 'discontinued'
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
  purchaseUnitFactor?: number
  sellingUnitId?: string | null
  sellingUnitFactor?: number
  purchasePrice?: number
  sellingPrice?: number
  mrp?: number
  taxClass?: string
  minStock?: number
  maxStock?: number
  reorderLevel?: number
  trackBatch?: boolean
  trackExpiry?: boolean
  trackSerialNumber?: boolean
  additionalUnits?: { unitId: string; isPurchaseUnit: boolean; isSellingUnit: boolean }[]
  productConversions?: { fromUnitId: string; toUnitId: string; conversionFactor: number }[]
  productImages?: string[]
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

// ──── Measurement Types API ─────────────────────────────────────────

export const measurementTypesApi = {
  getAll: () => get<MeasurementTypeRow[]>('/measurement-types'),
  getById: (id: string) => get<MeasurementTypeRow>(`/measurement-types/${id}`),
}

// ──── Units API ─────────────────────────────────────────────────────

export const unitsApi = {
  getAll: () => get<UnitRow[]>('/units'),
  getById: (id: string) => get<UnitRow>(`/units/${id}`),
  getByMeasurementType: (measurementTypeId: string) => get<UnitRow[]>(`/units/by-type/${measurementTypeId}`),
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

// ──── Supplier Types ───────────────────────────────────────────────

export interface SupplierRow {
  id: string
  name: string
  gst: string
  contactPerson: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  pincode: string
  creditLimit: number
  paymentTerms: string
  outstandingBalance: number
  status: 'active' | 'inactive'
  totalPurchases: number
  lastPurchaseDate: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSupplierInput {
  name: string
  gst?: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  creditLimit?: number
  paymentTerms?: string
}

export interface UpdateSupplierInput {
  name?: string
  gst?: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  creditLimit?: number
  paymentTerms?: string
  status?: 'active' | 'inactive'
}

// ──── Customer Types ───────────────────────────────────────────────

export interface CustomerRow {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  pincode: string
  loyaltyPoints: number
  creditLimit: number
  outstandingBalance: number
  status: 'active' | 'inactive'
  totalPurchases: number
  lastPurchaseDate: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateCustomerInput {
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  creditLimit?: number
}

export interface UpdateCustomerInput {
  name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  creditLimit?: number
  status?: 'active' | 'inactive'
}

// ──── Health API ────────────────────────────────────────────────────

export const healthApi = {
  check: () => get<HealthCheck>('/health'),
}

// ──── Suppliers API ────────────────────────────────────────────────

export const suppliersApi = {
  getAll: () => get<SupplierRow[]>('/suppliers'),
  getById: (id: string) => get<SupplierRow>(`/suppliers/${id}`),
  create: (input: CreateSupplierInput) => post<SupplierRow>('/suppliers', input),
  update: (id: string, input: UpdateSupplierInput) => patch<SupplierRow>(`/suppliers/${id}`, input),
  delete: (id: string) => del(`/suppliers/${id}`),
}

// ──── Customers API ────────────────────────────────────────────────

export const customersApi = {
  getAll: () => get<CustomerRow[]>('/customers'),
  getById: (id: string) => get<CustomerRow>(`/customers/${id}`),
  create: (input: CreateCustomerInput) => post<CustomerRow>('/customers', input),
  update: (id: string, input: UpdateCustomerInput) => patch<CustomerRow>(`/customers/${id}`, input),
  delete: (id: string) => del(`/customers/${id}`),
}
