import crypto from 'node:crypto'
import { query, run } from '../db'
import type {
  ProductRow,
  ProductWithRelations,
  ProductUnitRow,
  ProductConversionRow,
  ProductImageRow,
  InventoryTransactionRow,
  PurchaseRow,
  PurchaseItemRow,
  SaleRow,
  SaleItemRow,
} from '../modules/products/product.model'
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateProductConversionInput,
  UpdateProductConversionInput,
  AdditionalUnitInput,
} from '../modules/products/product.validation'

// ── Helpers ──────────────────────────────────────────────────────

function toProductRow(row: Record<string, unknown>): ProductRow {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    sku: row.sku as string,
    barcode: (row.barcode as string) ?? '',
    brand: (row.brand as string) ?? '',
    description: (row.description as string) ?? '',
    imageUrl: (row.image_url as string) ?? '',
    baseUnitId: row.base_unit_id as string,
    purchaseUnitId: row.purchase_unit_id as string | null,
    sellingUnitId: row.selling_unit_id as string | null,
    purchasePrice: Number(row.purchase_price ?? 0),
    sellingPrice: Number(row.selling_price ?? 0),
    mrp: Number(row.mrp ?? 0),
    taxClass: (row.tax_class as string) ?? '',
    minStock: Number(row.min_stock),
    maxStock: Number(row.max_stock ?? 0),
    reorderLevel: Number(row.reorder_level ?? 0),
    openingStock: Number(row.opening_stock),
    trackBatch: Boolean(row.track_batch),
    trackExpiry: Boolean(row.track_expiry),
    trackSerial: Boolean(row.track_serial),
    batchNumberFormat: (row.batch_number_format as string) ?? '',
    manufacturingDateField: (row.manufacturing_date_field as string) ?? '',
    expiryDateField: (row.expiry_date_field as string) ?? '',
    serialFormat: (row.serial_format as string) ?? '',
    serialValidation: (row.serial_validation as string) ?? '',
    currentStock: Number(row.current_stock),
    status: row.status as ProductRow['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function toProductWithRelations(row: Record<string, unknown>): ProductWithRelations {
  return {
    ...toProductRow(row),
    baseUnitName: row.base_unit_name as string,
    baseUnitSymbol: row.base_unit_symbol as string,
    purchaseUnitName: row.purchase_unit_name as string | null,
    purchaseUnitSymbol: row.purchase_unit_symbol as string | null,
    sellingUnitName: row.selling_unit_name as string | null,
    sellingUnitSymbol: row.selling_unit_symbol as string | null,
    units: [],
    productConversions: [],
    productImages: [],
  }
}

function toProductUnitRow(row: Record<string, unknown>): ProductUnitRow {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    unitId: row.unit_id as string,
    unitName: row.unit_name as string,
    unitSymbol: row.unit_symbol as string,
    unitType: row.unit_type as string,
    factorToBase: Number(row.factor_to_base),
    isPurchaseUnit: Boolean(row.is_purchase_unit),
    isSellingUnit: Boolean(row.is_selling_unit),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  }
}

function toProductConversionRow(row: Record<string, unknown>): ProductConversionRow {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    fromUnitId: row.from_unit_id as string,
    toUnitId: row.to_unit_id as string,
    fromUnitName: row.from_unit_name as string,
    fromUnitSymbol: row.from_unit_symbol as string,
    toUnitName: row.to_unit_name as string,
    toUnitSymbol: row.to_unit_symbol as string,
    conversionFactor: Number(row.conversion_factor),
    relationshipText: (row.relationship_text as string) ?? '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function toTransactionRow(row: Record<string, unknown>): InventoryTransactionRow {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    productName: (row.product_name as string) ?? '',
    transactionType: row.transaction_type as InventoryTransactionRow['transactionType'],
    unitId: row.unit_id as string,
    unitName: row.unit_name as string,
    unitSymbol: row.unit_symbol as string,
    unitQuantity: Number(row.unit_quantity),
    baseQuantity: Number(row.base_quantity),
    previousStock: Number(row.previous_stock),
    remainingStock: Number(row.remaining_stock),
    referenceType: row.reference_type as string | null,
    referenceId: row.reference_id as string | null,
    notes: row.notes as string,
    createdAt: row.created_at as string,
  }
}

// ── Products ─────────────────────────────────────────────────────

const PRODUCT_LIST_SQL = `
  SELECT p.*,
         bu.name AS base_unit_name, bu.symbol AS base_unit_symbol,
         pu.name AS purchase_unit_name, pu.symbol AS purchase_unit_symbol,
         su.name AS selling_unit_name, su.symbol AS selling_unit_symbol
  FROM products p
  JOIN units bu ON bu.id = p.base_unit_id
  LEFT JOIN units pu ON pu.id = p.purchase_unit_id
  LEFT JOIN units su ON su.id = p.selling_unit_id
`

export async function getAllProducts(): Promise<ProductWithRelations[]> {
  const result = await query<Record<string, unknown>>(
    `${PRODUCT_LIST_SQL} ORDER BY p.created_at DESC`
  )
  const products = result.rows.map(toProductWithRelations)
  // Populate units and conversions for each product
  for (const product of products) {
    product.units = await getProductUnits(product.id)
    product.productConversions = await getProductConversions(product.id)
    product.productImages = await getProductImages(product.id)
  }
  return products
}

export async function getProductById(id: string): Promise<ProductWithRelations | null> {
  const result = await query<Record<string, unknown>>(
    `${PRODUCT_LIST_SQL} WHERE p.id = ?`,
    [id]
  )
  if (!result.rows[0]) return null
  const product = toProductWithRelations(result.rows[0])
  product.units = await getProductUnits(id)
  product.productConversions = await getProductConversions(id)
  product.productImages = await getProductImages(id)
  return product
}

export async function getProductBySku(sku: string): Promise<ProductRow | null> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM products WHERE LOWER(sku) = LOWER(?)',
    [sku]
  )
  return result.rows[0] ? toProductRow(result.rows[0]) : null
}

export async function createProduct(
  input: CreateProductInput,
  openingStockBase: number,
  additionalUnitEntries: { unitId: string; factorToBase: number; isPurchaseUnit: boolean; isSellingUnit: boolean }[],
  productConversionEntries: { fromUnitId: string; toUnitId: string; conversionFactor: number }[],
  imageEntries?: { imagePath: string; originalName: string }[]
): Promise<ProductWithRelations> {
  const id = crypto.randomUUID()

  const result = await query<Record<string, unknown>>(
    `INSERT INTO products (id, name, category, sku, barcode, brand, description, image_url, base_unit_id, purchase_unit_id, selling_unit_id, purchase_price, selling_price, mrp, tax_class, min_stock, max_stock, reorder_level, track_batch, track_expiry, track_serial, batch_number_format, manufacturing_date_field, expiry_date_field, serial_format, serial_validation, opening_stock, current_stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      id, input.name, input.category, input.sku,
      input.barcode ?? '', input.brand ?? '', input.description ?? '', input.imageUrl ?? '',
      input.baseUnitId,
      input.purchaseUnitId ?? null,
      input.sellingUnitId ?? null,
      input.purchasePrice ?? 0,
      input.sellingPrice ?? 0,
      input.mrp ?? 0,
      input.taxClass ?? '',
      input.minStock,
      input.maxStock ?? 0,
      input.reorderLevel ?? 0,
      input.trackBatch ? 1 : 0,
      input.trackExpiry ? 1 : 0,
      input.trackSerialNumber ? 1 : 0,
      input.batchNumberFormat ?? '',
      input.manufacturingDateField ?? '',
      input.expiryDateField ?? '',
      input.serialNumberFormat ?? '',
      input.serialNumberValidation ?? '',
      openingStockBase,
      openingStockBase,
    ]
  )

  // Create product_units entries
  await saveProductUnits(id, input.baseUnitId, additionalUnitEntries)

  // Create product-specific conversions
  await saveProductConversions(id, productConversionEntries)

  // Save product images
  if (imageEntries && imageEntries.length > 0) {
    for (let i = 0; i < imageEntries.length; i++) {
      const entry = imageEntries[i]!
      const imgId = crypto.randomUUID()
      await run(
        `INSERT INTO product_images (id, product_id, image_path, original_name, mime_type, file_size, is_primary, sort_order)
         VALUES (?, ?, ?, ?, '', 0, ?, ?)`,
        [imgId, id, entry.imagePath, entry.originalName, i === 0 ? 1 : 0, i]
      )
    }
  }

  // Record opening stock transaction
  if (openingStockBase > 0) {
    await run(
      `INSERT INTO inventory_transactions (id, product_id, transaction_type, unit_id, unit_quantity, base_quantity, previous_stock, remaining_stock, notes)
       VALUES (?, ?, 'opening_stock', ?, ?, ?, 0, ?, ?)`,
      [crypto.randomUUID(), id, input.baseUnitId, openingStockBase, openingStockBase, openingStockBase, 'Opening stock']
    )
  }

  return (await getProductById(id))!
}

export async function saveProductUnits(
  productId: string,
  baseUnitId: string,
  additionalEntries: { unitId: string; factorToBase: number; isPurchaseUnit: boolean; isSellingUnit: boolean }[]
): Promise<void> {
  // Always add the base unit with factor 1
  await run(
    `INSERT OR IGNORE INTO product_units (id, product_id, unit_id, factor_to_base, is_purchase_unit, is_selling_unit)
     VALUES (?, ?, ?, 1, 0, 0)`,
    [crypto.randomUUID(), productId, baseUnitId]
  )

  // Add additional units
  for (const entry of additionalEntries) {
    if (entry.unitId === baseUnitId) continue
    await run(
      `INSERT INTO product_units (id, product_id, unit_id, factor_to_base, is_purchase_unit, is_selling_unit)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(product_id, unit_id) DO UPDATE SET
         factor_to_base = excluded.factor_to_base,
         is_purchase_unit = excluded.is_purchase_unit,
         is_selling_unit = excluded.is_selling_unit`,
      [
        crypto.randomUUID(), productId, entry.unitId,
        entry.factorToBase,
        entry.isPurchaseUnit ? 1 : 0,
        entry.isSellingUnit ? 1 : 0,
      ]
    )
  }
}

export async function saveProductConversions(
  productId: string,
  entries: { fromUnitId: string; toUnitId: string; conversionFactor: number; relationshipText?: string }[]
): Promise<void> {
  for (const entry of entries) {
    await run(
      `INSERT INTO product_conversions (id, product_id, from_unit_id, to_unit_id, conversion_factor, relationship_text)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(product_id, from_unit_id, to_unit_id) DO UPDATE SET
         conversion_factor = excluded.conversion_factor,
         relationship_text = excluded.relationship_text,
         updated_at = datetime('now')`,
      [
        crypto.randomUUID(), productId, entry.fromUnitId, entry.toUnitId,
        entry.conversionFactor, entry.relationshipText ?? '',
      ]
    )
  }
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<ProductWithRelations | null> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name) }
  if (input.category !== undefined) { fields.push('category = ?'); values.push(input.category) }
  if (input.sku !== undefined) { fields.push('sku = ?'); values.push(input.sku) }
  if (input.barcode !== undefined) { fields.push('barcode = ?'); values.push(input.barcode) }
  if (input.brand !== undefined) { fields.push('brand = ?'); values.push(input.brand) }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description) }
  if (input.imageUrl !== undefined) { fields.push('image_url = ?'); values.push(input.imageUrl) }
  if (input.baseUnitId !== undefined) { fields.push('base_unit_id = ?'); values.push(input.baseUnitId) }
  if (input.purchaseUnitId !== undefined) { fields.push('purchase_unit_id = ?'); values.push(input.purchaseUnitId) }
  if (input.sellingUnitId !== undefined) { fields.push('selling_unit_id = ?'); values.push(input.sellingUnitId) }
  if (input.purchasePrice !== undefined) { fields.push('purchase_price = ?'); values.push(input.purchasePrice) }
  if (input.sellingPrice !== undefined) { fields.push('selling_price = ?'); values.push(input.sellingPrice) }
  if (input.mrp !== undefined) { fields.push('mrp = ?'); values.push(input.mrp) }
  if (input.taxClass !== undefined) { fields.push('tax_class = ?'); values.push(input.taxClass) }
  if (input.minStock !== undefined) { fields.push('min_stock = ?'); values.push(input.minStock) }
  if (input.maxStock !== undefined) { fields.push('max_stock = ?'); values.push(input.maxStock) }
  if (input.reorderLevel !== undefined) { fields.push('reorder_level = ?'); values.push(input.reorderLevel) }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status) }
  if (input.trackBatch !== undefined) { fields.push('track_batch = ?'); values.push(input.trackBatch ? 1 : 0) }
  if (input.trackExpiry !== undefined) { fields.push('track_expiry = ?'); values.push(input.trackExpiry ? 1 : 0) }
  if (input.trackSerialNumber !== undefined) { fields.push('track_serial = ?'); values.push(input.trackSerialNumber ? 1 : 0) }
  if (input.batchNumberFormat !== undefined) { fields.push('batch_number_format = ?'); values.push(input.batchNumberFormat) }
  if (input.serialNumberFormat !== undefined) { fields.push('serial_format = ?'); values.push(input.serialNumberFormat) }
  if (input.serialNumberValidation !== undefined) { fields.push('serial_validation = ?'); values.push(input.serialNumberValidation) }
  if (input.manufacturingDateField !== undefined) { fields.push('manufacturing_date_field = ?'); values.push(input.manufacturingDateField) }
  if (input.expiryDateField !== undefined) { fields.push('expiry_date_field = ?'); values.push(input.expiryDateField) }

  if (fields.length === 0) return getProductById(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  await run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values)

  // Handle product images update
  if (input.productImages !== undefined) {
    // Delete existing images
    await deleteAllProductImages(id)
    // Re-insert new images
    for (let i = 0; i < input.productImages.length; i++) {
      const path = input.productImages[i]!
      const originalName = path.split('/').pop() ?? ''
      await run(
        `INSERT INTO product_images (id, product_id, image_path, original_name, mime_type, file_size, is_primary, sort_order)
         VALUES (?, ?, ?, ?, '', 0, ?, ?)`,
        [crypto.randomUUID(), id, path, originalName, i === 0 ? 1 : 0, i]
      )
    }
  }

  return getProductById(id)
}

export async function deleteProduct(id: string): Promise<boolean> {
  const result = await run('DELETE FROM products WHERE id = ?', [id])
  return result.changes > 0
}

// ── Product Units ────────────────────────────────────────────────

export async function getProductUnits(productId: string): Promise<ProductUnitRow[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT pu.*, u.name AS unit_name, u.symbol AS unit_symbol, u.type AS unit_type
     FROM product_units pu
     JOIN units u ON u.id = pu.unit_id
     WHERE pu.product_id = ? AND pu.is_active = 1
     ORDER BY pu.factor_to_base ASC`,
    [productId]
  )
  return result.rows.map(toProductUnitRow)
}

export async function getProductUnit(productId: string, unitId: string): Promise<ProductUnitRow | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT pu.*, u.name AS unit_name, u.symbol AS unit_symbol, u.type AS unit_type
     FROM product_units pu
     JOIN units u ON u.id = pu.unit_id
     WHERE pu.product_id = ? AND pu.unit_id = ?`,
    [productId, unitId]
  )
  return result.rows[0] ? toProductUnitRow(result.rows[0]) : null
}

// ── Product Conversions ──────────────────────────────────────────

const PRODUCT_CONVERSION_SQL = `
  SELECT pc.*,
         fu.name AS from_unit_name, fu.symbol AS from_unit_symbol,
         tu.name AS to_unit_name, tu.symbol AS to_unit_symbol
  FROM product_conversions pc
  JOIN units fu ON fu.id = pc.from_unit_id
  JOIN units tu ON tu.id = pc.to_unit_id
`

export async function getProductConversions(productId: string): Promise<ProductConversionRow[]> {
  const result = await query<Record<string, unknown>>(
    `${PRODUCT_CONVERSION_SQL} WHERE pc.product_id = ? ORDER BY pc.created_at DESC`,
    [productId]
  )
  return result.rows.map(toProductConversionRow)
}

export async function getProductConversionById(id: string): Promise<ProductConversionRow | null> {
  const result = await query<Record<string, unknown>>(
    `${PRODUCT_CONVERSION_SQL} WHERE pc.id = ?`,
    [id]
  )
  return result.rows[0] ? toProductConversionRow(result.rows[0]) : null
}

export async function createProductConversion(
  productId: string,
  input: CreateProductConversionInput
): Promise<ProductConversionRow> {
  const id = crypto.randomUUID()
  await query<Record<string, unknown>>(
    `INSERT INTO product_conversions (id, product_id, from_unit_id, to_unit_id, conversion_factor, relationship_text)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, productId, input.fromUnitId, input.toUnitId, input.conversionFactor, input.relationshipText ?? '']
  )
  const result = await query<Record<string, unknown>>(
    `${PRODUCT_CONVERSION_SQL} WHERE pc.id = ?`,
    [id]
  )
  return toProductConversionRow(result.rows[0]!)
}

export async function updateProductConversion(
  id: string,
  input: UpdateProductConversionInput
): Promise<ProductConversionRow | null> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.fromUnitId !== undefined) { fields.push('from_unit_id = ?'); values.push(input.fromUnitId) }
  if (input.toUnitId !== undefined) { fields.push('to_unit_id = ?'); values.push(input.toUnitId) }
  if (input.conversionFactor !== undefined) { fields.push('conversion_factor = ?'); values.push(input.conversionFactor) }

  if (fields.length === 0) {
    const result = await query<Record<string, unknown>>(
      `${PRODUCT_CONVERSION_SQL} WHERE pc.id = ?`,
      [id]
    )
    return result.rows[0] ? toProductConversionRow(result.rows[0]) : null
  }

  fields.push("updated_at = datetime('now')")
  values.push(id)

  await run(`UPDATE product_conversions SET ${fields.join(', ')} WHERE id = ?`, values)
  const result = await query<Record<string, unknown>>(
    `${PRODUCT_CONVERSION_SQL} WHERE pc.id = ?`,
    [id]
  )
  return result.rows[0] ? toProductConversionRow(result.rows[0]) : null
}

export async function deleteProductConversion(id: string): Promise<boolean> {
  const result = await run('DELETE FROM product_conversions WHERE id = ?', [id])
  return result.changes > 0
}

export async function deleteAllProductConversions(productId: string): Promise<void> {
  await run('DELETE FROM product_conversions WHERE product_id = ?', [productId])
}

// ── Product Images ────────────────────────────────────────────────

export async function getProductImages(productId: string): Promise<ProductImageRow[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC`,
    [productId]
  )
  return result.rows.map(toProductImageRow)
}

function toProductImageRow(row: Record<string, unknown>): ProductImageRow {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    imagePath: row.image_path as string,
    originalName: (row.original_name as string) ?? '',
    mimeType: (row.mime_type as string) ?? '',
    fileSize: Number(row.file_size ?? 0),
    isPrimary: Boolean(row.is_primary),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at as string,
  }
}

export async function saveProductImage(params: {
  productId: string
  imagePath: string
  originalName: string
  mimeType: string
  fileSize: number
  isPrimary: boolean
  sortOrder: number
}): Promise<ProductImageRow> {
  const id = crypto.randomUUID()
  await run(
    `INSERT INTO product_images (id, product_id, image_path, original_name, mime_type, file_size, is_primary, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.productId, params.imagePath, params.originalName, params.mimeType, params.fileSize, params.isPrimary ? 1 : 0, params.sortOrder]
  )
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM product_images WHERE id = ?',
    [id]
  )
  return toProductImageRow(result.rows[0]!)
}

export async function deleteProductImage(id: string): Promise<boolean> {
  const result = await run('DELETE FROM product_images WHERE id = ?', [id])
  return result.changes > 0
}

export async function deleteAllProductImages(productId: string): Promise<void> {
  await run('DELETE FROM product_images WHERE product_id = ?', [productId])
}

// ── Inventory ────────────────────────────────────────────────────

export async function updateProductStock(productId: string, newQuantity: number): Promise<void> {
  await run(
    `UPDATE products SET current_stock = ?, updated_at = datetime('now') WHERE id = ?`,
    [newQuantity, productId]
  )
}

// ── Inventory Transactions ───────────────────────────────────────

export async function createTransaction(params: {
  productId: string
  transactionType: InventoryTransactionRow['transactionType']
  unitId: string
  unitQuantity: number
  baseQuantity: number
  previousStock: number
  remainingStock: number
  referenceType?: string
  referenceId?: string
  notes?: string
}): Promise<InventoryTransactionRow> {
  const id = crypto.randomUUID()
  const result = await query<Record<string, unknown>>(
    `INSERT INTO inventory_transactions (id, product_id, transaction_type, unit_id, unit_quantity, base_quantity, previous_stock, remaining_stock, reference_type, reference_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      id, params.productId, params.transactionType, params.unitId,
      params.unitQuantity, params.baseQuantity, params.previousStock,
      params.remainingStock, params.referenceType ?? null, params.referenceId ?? null,
      params.notes ?? '',
    ]
  )
  return (await getTransactionById(id))!
}

export async function getTransactionById(id: string): Promise<InventoryTransactionRow | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT t.*, u.name AS unit_name, u.symbol AS unit_symbol, p.name AS product_name
     FROM inventory_transactions t
     JOIN units u ON u.id = t.unit_id
     JOIN products p ON p.id = t.product_id
     WHERE t.id = ?`,
    [id]
  )
  return result.rows[0] ? toTransactionRow(result.rows[0]) : null
}

export async function getProductTransactions(
  productId: string,
  limit = 50
): Promise<InventoryTransactionRow[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT t.*, u.name AS unit_name, u.symbol AS unit_symbol, p.name AS product_name
     FROM inventory_transactions t
     JOIN units u ON u.id = t.unit_id
     JOIN products p ON p.id = t.product_id
     WHERE t.product_id = ?
     ORDER BY t.created_at DESC
     LIMIT ?`,
    [productId, limit]
  )
  return result.rows.map(toTransactionRow)
}

export async function getAllTransactions(limit = 100): Promise<InventoryTransactionRow[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT t.*, u.name AS unit_name, u.symbol AS unit_symbol, p.name AS product_name
     FROM inventory_transactions t
     JOIN units u ON u.id = t.unit_id
     JOIN products p ON p.id = t.product_id
     ORDER BY t.created_at DESC
     LIMIT ?`,
    [limit]
  )
  return result.rows.map(toTransactionRow)
}

// ── Purchase ─────────────────────────────────────────────────────

export async function createPurchase(params: {
  supplierId?: string | null
  supplierName: string
  notes: string
  purchaseNumber: string
}): Promise<PurchaseRow> {
  const id = crypto.randomUUID()

  // Denormalize the supplier name onto the purchase when linked to a supplier,
  // so historical records stay readable even if the supplier is later renamed.
  // The linked record's name wins over any free-text value sent by the client.
  let supplierName = params.supplierName
  if (params.supplierId) {
    const supplier = await query<Record<string, unknown>>(
      'SELECT name FROM suppliers WHERE id = ?',
      [params.supplierId]
    )
    supplierName = (supplier.rows[0]?.name as string) ?? supplierName
  }

  const result = await query<Record<string, unknown>>(
    `INSERT INTO purchases (id, purchase_number, supplier_id, supplier_name, notes) VALUES (?, ?, ?, ?, ?) RETURNING *`,
    [id, params.purchaseNumber, params.supplierId ?? null, supplierName, params.notes]
  )
  return toPurchaseRow(result.rows[0]!)
}

function toPurchaseRow(row: Record<string, unknown>): PurchaseRow {
  return {
    id: row.id as string,
    purchaseNumber: row.purchase_number as string,
    supplierId: (row.supplier_id as string | null) ?? null,
    supplierName: (row.supplier_name as string) ?? '',
    notes: row.notes as string,
    totalItems: Number(row.total_items),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function createPurchaseItem(params: {
  purchaseId: string
  productId: string
  unitId: string
  quantity: number
  baseQuantity: number
  unitPrice: number
}): Promise<PurchaseItemRow> {
  const id = crypto.randomUUID()
  const totalPrice = params.unitPrice * params.quantity
  const result = await query<Record<string, unknown>>(
    `INSERT INTO purchase_items (id, purchase_id, product_id, unit_id, quantity, base_quantity, unit_price, total_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [id, params.purchaseId, params.productId, params.unitId, params.quantity, params.baseQuantity, params.unitPrice, totalPrice]
  )
  await run(
    "UPDATE purchases SET total_items = total_items + 1, updated_at = datetime('now') WHERE id = ?",
    [params.purchaseId]
  )
  return toPurchaseItemRow(result.rows[0]!)
}

function toPurchaseItemRow(row: Record<string, unknown>): PurchaseItemRow {
  return {
    id: row.id as string,
    purchaseId: row.purchase_id as string,
    productId: row.product_id as string,
    productName: row.product_name as string || '',
    productSku: row.product_sku as string || '',
    unitId: row.unit_id as string,
    unitName: row.unit_name as string || '',
    unitSymbol: row.unit_symbol as string || '',
    quantity: Number(row.quantity),
    baseQuantity: Number(row.base_quantity),
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
    createdAt: row.created_at as string,
  }
}

const PURCHASE_SELECT_SQL = `
  SELECT p.*, COALESCE(s.name, p.supplier_name) AS supplier_name
  FROM purchases p
  LEFT JOIN suppliers s ON s.id = p.supplier_id
`

export async function getPurchases(limit = 50): Promise<PurchaseRow[]> {
  const result = await query<Record<string, unknown>>(
    `${PURCHASE_SELECT_SQL} ORDER BY p.created_at DESC LIMIT ?`,
    [limit]
  )
  return result.rows.map(toPurchaseRow)
}

export async function getPurchaseById(id: string): Promise<PurchaseRow | null> {
  const result = await query<Record<string, unknown>>(
    `${PURCHASE_SELECT_SQL} WHERE p.id = ?`,
    [id]
  )
  if (!result.rows[0]) return null
  const purchase = toPurchaseRow(result.rows[0])
  purchase.items = await getPurchaseItems(id)
  return purchase
}

export async function getPurchaseItems(purchaseId: string): Promise<PurchaseItemRow[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT pi.*, p.name AS product_name, p.sku AS product_sku, u.name AS unit_name, u.symbol AS unit_symbol
     FROM purchase_items pi
     JOIN products p ON p.id = pi.product_id
     JOIN units u ON u.id = pi.unit_id
     WHERE pi.purchase_id = ?
     ORDER BY pi.created_at`,
    [purchaseId]
  )
  return result.rows.map(toPurchaseItemRow)
}

// ── Sales ────────────────────────────────────────────────────────

export async function createSale(params: {
  customerId?: string | null
  customerName: string
  notes: string
  saleNumber: string
}): Promise<SaleRow> {
  const id = crypto.randomUUID()

  // Denormalize the customer name onto the sale when linked to a customer.
  // The linked record's name wins over any free-text value sent by the client.
  let customerName = params.customerName
  if (params.customerId) {
    const customer = await query<Record<string, unknown>>(
      'SELECT name FROM customers WHERE id = ?',
      [params.customerId]
    )
    customerName = (customer.rows[0]?.name as string) ?? customerName
  }

  const result = await query<Record<string, unknown>>(
    `INSERT INTO sales (id, sale_number, customer_id, customer_name, notes) VALUES (?, ?, ?, ?, ?) RETURNING *`,
    [id, params.saleNumber, params.customerId ?? null, customerName, params.notes]
  )
  return toSaleRow(result.rows[0]!)
}

function toSaleRow(row: Record<string, unknown>): SaleRow {
  return {
    id: row.id as string,
    saleNumber: row.sale_number as string,
    customerId: (row.customer_id as string | null) ?? null,
    customerName: (row.customer_name as string) ?? '',
    notes: row.notes as string,
    totalItems: Number(row.total_items),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function createSaleItem(params: {
  saleId: string
  productId: string
  unitId: string
  quantity: number
  baseQuantity: number
  unitPrice: number
}): Promise<SaleItemRow> {
  const id = crypto.randomUUID()
  const totalPrice = params.unitPrice * params.quantity
  const result = await query<Record<string, unknown>>(
    `INSERT INTO sale_items (id, sale_id, product_id, unit_id, quantity, base_quantity, unit_price, total_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [id, params.saleId, params.productId, params.unitId, params.quantity, params.baseQuantity, params.unitPrice, totalPrice]
  )
  await run(
    "UPDATE sales SET total_items = total_items + 1, updated_at = datetime('now') WHERE id = ?",
    [params.saleId]
  )
  return toSaleItemRow(result.rows[0]!)
}

function toSaleItemRow(row: Record<string, unknown>): SaleItemRow {
  return {
    id: row.id as string,
    saleId: row.sale_id as string,
    productId: row.product_id as string,
    productName: row.product_name as string || '',
    productSku: row.product_sku as string || '',
    unitId: row.unit_id as string,
    unitName: row.unit_name as string || '',
    unitSymbol: row.unit_symbol as string || '',
    quantity: Number(row.quantity),
    baseQuantity: Number(row.base_quantity),
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
    createdAt: row.created_at as string,
  }
}

const SALE_SELECT_SQL = `
  SELECT s.*, COALESCE(c.name, s.customer_name) AS customer_name
  FROM sales s
  LEFT JOIN customers c ON c.id = s.customer_id
`

export async function getSales(limit = 50): Promise<SaleRow[]> {
  const result = await query<Record<string, unknown>>(
    `${SALE_SELECT_SQL} ORDER BY s.created_at DESC LIMIT ?`,
    [limit]
  )
  return result.rows.map(toSaleRow)
}

export async function getSaleById(id: string): Promise<SaleRow | null> {
  const result = await query<Record<string, unknown>>(
    `${SALE_SELECT_SQL} WHERE s.id = ?`,
    [id]
  )
  if (!result.rows[0]) return null
  const sale = toSaleRow(result.rows[0])
  sale.items = await getSaleItems(id)
  return sale
}

export async function getSaleItems(saleId: string): Promise<SaleItemRow[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT si.*, p.name AS product_name, p.sku AS product_sku, u.name AS unit_name, u.symbol AS unit_symbol
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN units u ON u.id = si.unit_id
     WHERE si.sale_id = ?
     ORDER BY si.created_at`,
    [saleId]
  )
  return result.rows.map(toSaleItemRow)
}
