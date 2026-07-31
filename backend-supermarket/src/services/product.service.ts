import { AppError } from '../middleware/errorHandler'
import * as productRepository from '../repositories/product.repository'
import * as unitRepository from '../repositories/unit.repository'
import * as conversionService from './conversion.service'
import { run } from '../db'
import type { ProductWithRelations, ProductConversionRow } from '../modules/products/product.model'
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateProductConversionInput,
  UpdateProductConversionInput,
  PurchaseStockInput,
  SellStockInput,
  AdjustStockInput,
} from '../modules/products/product.validation'

// ── Helpers ──────────────────────────────────────────────────────

async function getProductOrThrow(id: string): Promise<ProductWithRelations> {
  const product = await productRepository.getProductById(id)
  if (!product) {
    throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND')
  }
  return product
}

async function ensureUniqueSku(sku: string, excludeId?: string): Promise<void> {
  const existing = await productRepository.getProductBySku(sku)
  if (existing && existing.id !== excludeId) {
    throw new AppError(409, 'A product with this SKU already exists', 'DUPLICATE_SKU')
  }
}

async function validateUnitCategory(
  unitId: string,
  baseUnitId: string,
  label: string,
  productConversions?: { fromUnitId: string; toUnitId: string; conversionFactor: number }[]
): Promise<void> {
  const unit = await unitRepository.getById(unitId)
  if (!unit) {
    throw new AppError(404, `Unit for ${label} not found`, 'UNIT_NOT_FOUND')
  }

  const baseUnit = await unitRepository.getById(baseUnitId)
  if (!baseUnit) {
    throw new AppError(404, 'Base unit not found', 'BASE_UNIT_NOT_FOUND')
  }

  // Allow cross-type conversion if the unit is a packaging unit with a product-specific conversion
  if (unit.type !== baseUnit.type) {
    const isPackagingCrossConversion = unit.isPackaging && productConversions && productConversions.some(
      c => (c.fromUnitId === unitId || c.toUnitId === unitId) &&
           (c.fromUnitId === baseUnitId || c.toUnitId === baseUnitId)
    )

    if (!isPackagingCrossConversion) {
      throw new AppError(
        400,
        `${label} (${unit.name}) must be in the same category as base unit (${baseUnit.name}). ${unit.type} → ${baseUnit.type}`,
        'INVALID_UNIT_CATEGORY'
      )
    }
  }
}

/**
 * Resolve factor to base unit, checking product-specific conversions first.
 * If a product-specific conversion exists for the unit pair, use that factor.
 * Otherwise fall back to the global conversion chain.
 */
async function resolveProductFactorToBase(
  fromUnitId: string,
  baseUnitId: string,
  productConversions: { fromUnitId: string; toUnitId: string; conversionFactor: number }[]
): Promise<number> {
  // Check product-specific conversions first (both directions)
  const directConv = productConversions.find(
    c => c.fromUnitId === fromUnitId && c.toUnitId === baseUnitId
  )
  if (directConv) return directConv.conversionFactor

  const reverseConv = productConversions.find(
    c => c.fromUnitId === baseUnitId && c.toUnitId === fromUnitId
  )
  if (reverseConv) return 1 / reverseConv.conversionFactor

  // Fall back to global conversion chain
  return conversionService.resolveFactorToBase(fromUnitId, baseUnitId)
}

// ── Product CRUD ─────────────────────────────────────────────────

export async function getAll(): Promise<ProductWithRelations[]> {
  return productRepository.getAllProducts()
}

export async function getById(id: string): Promise<ProductWithRelations> {
  return getProductOrThrow(id)
}

export async function create(input: CreateProductInput): Promise<ProductWithRelations> {
  await ensureUniqueSku(input.sku)

  // Validate base unit exists
  const baseUnit = await unitRepository.getById(input.baseUnitId)
  if (!baseUnit) {
    throw new AppError(404, 'Base unit not found', 'BASE_UNIT_NOT_FOUND')
  }

  // ── Build product-specific conversion entries ──────────────
  // Auto-generate from purchase/selling unit factors, then add manual ones
  const productConversionEntries: { fromUnitId: string; toUnitId: string; conversionFactor: number; relationshipText?: string }[] = []

  // If purchase unit differs from base unit and factor is provided, auto-create conversion
  if (input.purchaseUnitId && input.purchaseUnitId !== input.baseUnitId && input.purchaseUnitFactor) {
    const fromUnit = await unitRepository.getById(input.purchaseUnitId)
    const baseUnit = await unitRepository.getById(input.baseUnitId)
    const fromName = fromUnit?.name ?? '?'
    const baseName = baseUnit?.name ?? '?'
    productConversionEntries.push({
      fromUnitId: input.purchaseUnitId,
      toUnitId: input.baseUnitId,
      conversionFactor: input.purchaseUnitFactor,
      relationshipText: `1 ${fromName} = ${input.purchaseUnitFactor} ${baseName} (purchase conversion)`,
    })
  }

  // If selling unit differs from base unit and factor is provided, auto-create conversion
  if (input.sellingUnitId && input.sellingUnitId !== input.baseUnitId && input.sellingUnitFactor) {
    const fromUnit = await unitRepository.getById(input.sellingUnitId)
    const baseUnit = await unitRepository.getById(input.baseUnitId)
    const fromName = fromUnit?.name ?? '?'
    const baseName = baseUnit?.name ?? '?'
    productConversionEntries.push({
      fromUnitId: input.sellingUnitId,
      toUnitId: input.baseUnitId,
      conversionFactor: input.sellingUnitFactor,
      relationshipText: `1 ${fromName} = ${input.sellingUnitFactor} ${baseName} (selling conversion)`,
    })
  }

  // Add manually-defined product conversions
  for (const c of input.productConversions ?? []) {
    const fromUnit = await unitRepository.getById(c.fromUnitId)
    const toUnit = await unitRepository.getById(c.toUnitId)
    const fromName = fromUnit?.name ?? '?'
    const toName = toUnit?.name ?? '?'
    productConversionEntries.push({
      fromUnitId: c.fromUnitId,
      toUnitId: c.toUnitId,
      conversionFactor: c.conversionFactor,
      relationshipText: `1 ${toName} = ${c.conversionFactor} ${fromName}`,
    })
  }

  // Validate purchase and selling units if provided
  if (input.purchaseUnitId) {
    await validateUnitCategory(input.purchaseUnitId, input.baseUnitId, 'Purchase unit', productConversionEntries)
  }
  if (input.sellingUnitId) {
    await validateUnitCategory(input.sellingUnitId, input.baseUnitId, 'Selling unit', productConversionEntries)
  }

  // Build additional unit entries with conversion factors
  const additionalEntries: { unitId: string; factorToBase: number; isPurchaseUnit: boolean; isSellingUnit: boolean }[] = []

  // Process explicit additional units
  for (const au of input.additionalUnits ?? []) {
    const factorToBase = await resolveProductFactorToBase(au.unitId, input.baseUnitId, productConversionEntries)
    additionalEntries.push({
      unitId: au.unitId,
      factorToBase,
      isPurchaseUnit: au.isPurchaseUnit,
      isSellingUnit: au.isSellingUnit,
    })
  }

  // If purchase unit is provided with a factor, use that; otherwise try to resolve
  if (input.purchaseUnitId && !additionalEntries.some(e => e.unitId === input.purchaseUnitId)) {
    const factorToBase = input.purchaseUnitFactor
      ?? await resolveProductFactorToBase(input.purchaseUnitId, input.baseUnitId, productConversionEntries)
    additionalEntries.push({
      unitId: input.purchaseUnitId,
      factorToBase,
      isPurchaseUnit: true,
      isSellingUnit: false,
    })
  }

  // If selling unit is provided with a factor, use that; otherwise try to resolve
  if (input.sellingUnitId && !additionalEntries.some(e => e.unitId === input.sellingUnitId)) {
    const factorToBase = input.sellingUnitFactor
      ?? await resolveProductFactorToBase(input.sellingUnitId, input.baseUnitId, productConversionEntries)
    additionalEntries.push({
      unitId: input.sellingUnitId,
      factorToBase,
      isPurchaseUnit: false,
      isSellingUnit: true,
    })
  }

  // Convert opening stock to base unit if provided in a different unit
  let openingStockBase = input.openingStock
  if (input.purchaseUnitId && input.openingStock > 0) {
    const factor = input.purchaseUnitFactor
      ?? await resolveProductFactorToBase(input.purchaseUnitId, input.baseUnitId, productConversionEntries)
    openingStockBase = input.openingStock * factor
  }

  // Prepare image entries for storage
  const imageEntries = (input.productImages ?? []).map((path, i) => ({
    imagePath: path,
    originalName: path.split('/').pop() ?? '',
  }))

  return productRepository.createProduct(
    input,
    openingStockBase,
    additionalEntries,
    productConversionEntries,
    imageEntries.length > 0 ? imageEntries : undefined
  )
}

export async function update(id: string, input: UpdateProductInput): Promise<ProductWithRelations> {
  const existing = await getProductOrThrow(id)

  if (input.sku) {
    await ensureUniqueSku(input.sku, id)
  }

  // Save the basic product fields
  const updated = await productRepository.updateProduct(id, input)
  if (!updated) {
    throw new AppError(500, 'Failed to update product', 'UPDATE_FAILED')
  }

  // ── Handle product-specific conversions ─────────────────────
  const effectiveBaseUnitId = input.baseUnitId ?? existing.baseUnitId
  const effectivePurchaseUnitId = input.purchaseUnitId !== undefined ? input.purchaseUnitId : existing.purchaseUnitId
  const effectiveSellingUnitId = input.sellingUnitId !== undefined ? input.sellingUnitId : existing.sellingUnitId

  if (input.productConversions !== undefined || input.purchaseUnitFactor !== undefined || input.sellingUnitFactor !== undefined) {
    // Build conversion entries with human-readable relationship text
    const conversionEntries: {
      fromUnitId: string
      toUnitId: string
      conversionFactor: number
      relationshipText: string
    }[] = []

    // Auto-generate from purchase unit factor if provided and unit differs from base
    const purchaseUnitId = input.purchaseUnitId ?? existing.purchaseUnitId
    if (purchaseUnitId && purchaseUnitId !== effectiveBaseUnitId) {
      const factor = input.purchaseUnitFactor ?? existing.productConversions.find(
        c => c.fromUnitId === purchaseUnitId && c.toUnitId === effectiveBaseUnitId
      )?.conversionFactor
      if (factor) {
        const purchaseUnit = await unitRepository.getById(purchaseUnitId)
        const baseUnit = await unitRepository.getById(effectiveBaseUnitId)
        conversionEntries.push({
          fromUnitId: purchaseUnitId,
          toUnitId: effectiveBaseUnitId,
          conversionFactor: factor,
          relationshipText: `1 ${purchaseUnit?.name ?? '?'} = ${factor} ${baseUnit?.name ?? '?'} (purchase)`,
        })
      }
    }

    // Auto-generate from selling unit factor if provided and unit differs from base
    const sellingUnitId = input.sellingUnitId ?? existing.sellingUnitId
    if (sellingUnitId && sellingUnitId !== effectiveBaseUnitId) {
      const factor = input.sellingUnitFactor ?? existing.productConversions.find(
        c => c.fromUnitId === sellingUnitId && c.toUnitId === effectiveBaseUnitId
      )?.conversionFactor
      if (factor) {
        const sellingUnit = await unitRepository.getById(sellingUnitId)
        const baseUnit = await unitRepository.getById(effectiveBaseUnitId)
        conversionEntries.push({
          fromUnitId: sellingUnitId,
          toUnitId: effectiveBaseUnitId,
          conversionFactor: factor,
          relationshipText: `1 ${sellingUnit?.name ?? '?'} = ${factor} ${baseUnit?.name ?? '?'} (selling)`,
        })
      }
    }

    // Add manually-defined product conversions
    for (const c of input.productConversions ?? []) {
      const fromUnit = await unitRepository.getById(c.fromUnitId)
      const toUnit = await unitRepository.getById(c.toUnitId)
      if (!fromUnit || !toUnit) continue

      const fromName = fromUnit.name
      const toName = toUnit.name
      const relationshipText = `1 ${toName} = ${c.conversionFactor} ${fromName}`
      conversionEntries.push({
        fromUnitId: c.fromUnitId,
        toUnitId: c.toUnitId,
        conversionFactor: c.conversionFactor,
        relationshipText,
      })
    }

    // Delete existing and re-insert
    await productRepository.deleteAllProductConversions(id)
    if (conversionEntries.length > 0) {
      await productRepository.saveProductConversions(id, conversionEntries)
    }
  }

  // ── Handle additional units ─────────────────────────────────
  if (input.additionalUnits !== undefined || input.baseUnitId !== undefined ||
      input.purchaseUnitId !== undefined || input.sellingUnitId !== undefined ||
      input.purchaseUnitFactor !== undefined || input.sellingUnitFactor !== undefined) {

    // Build the set of product conversion entries (use new ones if provided, else existing)
    const productConversionEntries = input.productConversions ??
      existing.productConversions.map(c => ({
        fromUnitId: c.fromUnitId,
        toUnitId: c.toUnitId,
        conversionFactor: c.conversionFactor,
      }))

    const additionalEntries: { unitId: string; factorToBase: number; isPurchaseUnit: boolean; isSellingUnit: boolean }[] = []

    // Process explicit additional units
    const unitsToProcess = input.additionalUnits ??
      existing.units.filter(u => u.unitId !== effectiveBaseUnitId).map(u => ({
        unitId: u.unitId,
        isPurchaseUnit: u.isPurchaseUnit,
        isSellingUnit: u.isSellingUnit,
      }))

    for (const au of unitsToProcess) {
      if (au.unitId === effectiveBaseUnitId) continue
      const factorToBase = await resolveProductFactorToBase(au.unitId, effectiveBaseUnitId, productConversionEntries)
      additionalEntries.push({
        unitId: au.unitId,
        factorToBase,
        isPurchaseUnit: au.isPurchaseUnit,
        isSellingUnit: au.isSellingUnit,
      })
    }

    // Add purchase unit if not already included
    if (effectivePurchaseUnitId && !additionalEntries.some(e => e.unitId === effectivePurchaseUnitId)) {
      const factorToBase = await resolveProductFactorToBase(effectivePurchaseUnitId, effectiveBaseUnitId, productConversionEntries)
      additionalEntries.push({
        unitId: effectivePurchaseUnitId,
        factorToBase,
        isPurchaseUnit: true,
        isSellingUnit: false,
      })
    }

    // Add selling unit if not already included
    if (effectiveSellingUnitId && !additionalEntries.some(e => e.unitId === effectiveSellingUnitId)) {
      const factorToBase = await resolveProductFactorToBase(effectiveSellingUnitId, effectiveBaseUnitId, productConversionEntries)
      additionalEntries.push({
        unitId: effectiveSellingUnitId,
        factorToBase,
        isPurchaseUnit: false,
        isSellingUnit: true,
      })
    }

    // Save product units: delete existing and re-insert
    await run('DELETE FROM product_units WHERE product_id = ?', [id])
    await productRepository.saveProductUnits(id, effectiveBaseUnitId, additionalEntries)
  }

  return (await productRepository.getProductById(id))!
}

export async function remove(id: string): Promise<void> {
  await getProductOrThrow(id)
  const deleted = await productRepository.deleteProduct(id)
  if (!deleted) {
    throw new AppError(500, 'Failed to delete product', 'DELETE_FAILED')
  }
}

// ── Product Conversion CRUD ──────────────────────────────────────

export async function getProductConversions(productId: string): Promise<ProductConversionRow[]> {
  await getProductOrThrow(productId)
  return productRepository.getProductConversions(productId)
}

export async function createProductConversion(
  productId: string,
  input: CreateProductConversionInput
): Promise<ProductConversionRow> {
  await getProductOrThrow(productId)

  // Auto-generate human-readable relationship text if not provided
  let relationshipText = input.relationshipText
  if (!relationshipText) {
    const [fromUnit, toUnit] = await Promise.all([
      unitRepository.getById(input.fromUnitId),
      unitRepository.getById(input.toUnitId),
    ])
    const fromName = fromUnit?.name ?? '?'
    const toName = toUnit?.name ?? '?'
    relationshipText = `1 ${toName} = ${input.conversionFactor} ${fromName}`
  }

  return productRepository.createProductConversion(productId, {
    ...input,
    relationshipText,
  })
}

export async function updateProductConversion(
  id: string,
  input: UpdateProductConversionInput
): Promise<ProductConversionRow> {
  const updated = await productRepository.updateProductConversion(id, input)
  if (!updated) {
    throw new AppError(404, 'Product conversion not found', 'CONVERSION_NOT_FOUND')
  }
  return updated
}

export async function deleteProductConversion(id: string): Promise<void> {
  const deleted = await productRepository.deleteProductConversion(id)
  if (!deleted) {
    throw new AppError(404, 'Product conversion not found', 'CONVERSION_NOT_FOUND')
  }
}

// ── Purchase Stock ───────────────────────────────────────────────

export async function purchaseStock(input: PurchaseStockInput): Promise<{
  purchaseId: string
  item: Record<string, unknown>
  remainingStock: number
}> {
  const product = await getProductOrThrow(input.productId)

  const productUnit = await productRepository.getProductUnit(input.productId, input.unitId)
  if (!productUnit) {
    throw new AppError(400, 'This unit is not available for this product', 'UNIT_NOT_AVAILABLE')
  }

  const baseQuantity = await conversionService.convertToBaseUnit(
    input.quantity,
    input.unitId,
    product.baseUnitId
  )

  const previousStock = product.currentStock
  const remainingStock = previousStock + baseQuantity

  const purchaseNumber = `PUR-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  const purchase = await productRepository.createPurchase({
    supplierName: input.supplierName,
    notes: input.notes,
    purchaseNumber,
  })

  const item = await productRepository.createPurchaseItem({
    purchaseId: purchase.id,
    productId: input.productId,
    unitId: input.unitId,
    quantity: input.quantity,
    baseQuantity,
    unitPrice: input.unitPrice,
  })

  await productRepository.updateProductStock(input.productId, remainingStock)

  await productRepository.createTransaction({
    productId: input.productId,
    transactionType: 'purchase',
    unitId: input.unitId,
    unitQuantity: input.quantity,
    baseQuantity,
    previousStock,
    remainingStock,
    referenceType: 'purchase',
    referenceId: purchase.id,
    notes: `Purchased ${input.quantity} via ${purchaseNumber}`,
  })

  return {
    purchaseId: purchase.id,
    item: item as unknown as Record<string, unknown>,
    remainingStock,
  }
}

// ── Sell Stock ───────────────────────────────────────────────────

export async function sellStock(input: SellStockInput): Promise<{
  saleId: string
  item: Record<string, unknown>
  remainingStock: number
}> {
  const product = await getProductOrThrow(input.productId)

  const productUnit = await productRepository.getProductUnit(input.productId, input.unitId)
  if (!productUnit) {
    throw new AppError(400, 'This unit is not available for this product', 'UNIT_NOT_AVAILABLE')
  }

  const baseQuantity = await conversionService.convertToBaseUnit(
    input.quantity,
    input.unitId,
    product.baseUnitId
  )

  const previousStock = product.currentStock
  if (baseQuantity > previousStock) {
    throw new AppError(
      409,
      `Insufficient stock. Available: ${previousStock} ${product.baseUnitSymbol}, requested: ${baseQuantity} ${product.baseUnitSymbol} (${input.quantity} ${productUnit.unitSymbol})`,
      'INSUFFICIENT_STOCK'
    )
  }

  const remainingStock = previousStock - baseQuantity

  const saleNumber = `SAL-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  const sale = await productRepository.createSale({
    customerName: input.customerName,
    notes: input.notes,
    saleNumber,
  })

  const item = await productRepository.createSaleItem({
    saleId: sale.id,
    productId: input.productId,
    unitId: input.unitId,
    quantity: input.quantity,
    baseQuantity,
    unitPrice: input.unitPrice,
  })

  await productRepository.updateProductStock(input.productId, remainingStock)

  await productRepository.createTransaction({
    productId: input.productId,
    transactionType: 'sale',
    unitId: input.unitId,
    unitQuantity: input.quantity,
    baseQuantity,
    previousStock,
    remainingStock,
    referenceType: 'sale',
    referenceId: sale.id,
    notes: `Sold ${input.quantity} via ${saleNumber}`,
  })

  return {
    saleId: sale.id,
    item: item as unknown as Record<string, unknown>,
    remainingStock,
  }
}

// ── Adjust Stock ─────────────────────────────────────────────────

export async function adjustStock(input: AdjustStockInput): Promise<{
  previousStock: number
  newStock: number
  difference: number
}> {
  const product = await getProductOrThrow(input.productId)
  const previousStock = product.currentStock
  const difference = input.newQuantity - previousStock
  const adjustedQuantity = Math.abs(difference)

  await productRepository.updateProductStock(input.productId, input.newQuantity)

  await productRepository.createTransaction({
    productId: input.productId,
    transactionType: 'adjustment' as const,
    unitId: product.baseUnitId,
    unitQuantity: adjustedQuantity,
    baseQuantity: difference,
    previousStock,
    remainingStock: input.newQuantity,
    notes: input.notes || 'Stock adjustment',
  })

  return {
    previousStock,
    newStock: input.newQuantity,
    difference,
  }
}

// ── Stock Validation ─────────────────────────────────────────────

export async function validateStockAvailability(
  productId: string,
  unitId: string,
  quantity: number
): Promise<{
  available: boolean
  availableInBase: number
  requestedInBase: number
  displayAvailable: string
}> {
  const product = await getProductOrThrow(productId)
  const productUnit = await productRepository.getProductUnit(productId, unitId)
  if (!productUnit) {
    throw new AppError(400, 'This unit is not available for this product', 'UNIT_NOT_AVAILABLE')
  }

  const requestedInBase = await conversionService.convertToBaseUnit(quantity, unitId, product.baseUnitId)
  const available = product.currentStock >= requestedInBase

  const allUnits = product.units
  const displayUnits = allUnits.map(u => ({
    unitId: u.unitId,
    unitName: u.unitName,
    unitSymbol: u.unitSymbol,
    factorToBase: u.factorToBase,
  }))
  const displayAvailable = conversionService.formatDisplayQuantity(product.currentStock, displayUnits)

  return {
    available,
    availableInBase: product.currentStock,
    requestedInBase,
    displayAvailable,
  }
}

// ── Display Helpers ──────────────────────────────────────────────

export async function getDisplayStock(productId: string): Promise<{
  baseQuantity: number
  baseUnitName: string
  baseUnitSymbol: string
  display: { unitId: string; unitName: string; unitSymbol: string; quantity: number }[]
  displayText: string
  isLowStock: boolean
}> {
  const product = await getProductOrThrow(productId)

  const displayUnits = product.units.map(u => ({
    unitId: u.unitId,
    unitName: u.unitName,
    unitSymbol: u.unitSymbol,
    factorToBase: u.factorToBase,
  }))

  const display = conversionService.getDisplayQuantity(product.currentStock, displayUnits)
  const displayText = conversionService.formatDisplayQuantity(product.currentStock, displayUnits)

  return {
    baseQuantity: product.currentStock,
    baseUnitName: product.baseUnitName,
    baseUnitSymbol: product.baseUnitSymbol,
    display,
    displayText,
    isLowStock: product.currentStock <= product.minStock,
  }
}

// ── Transactions / Orders ────────────────────────────────────────

export async function getTransactions(productId?: string, limit = 100): Promise<Record<string, unknown>[]> {
  if (productId) {
    await getProductOrThrow(productId)
    const transactions = await productRepository.getProductTransactions(productId, limit)
    return transactions as unknown as Record<string, unknown>[]
  }
  const transactions = await productRepository.getAllTransactions(limit)
  return transactions as unknown as Record<string, unknown>[]
}

export async function getPurchases(limit = 50): Promise<Record<string, unknown>[]> {
  const purchases = await productRepository.getPurchases(limit)
  return purchases as unknown as Record<string, unknown>[]
}

export async function getPurchaseById(id: string): Promise<Record<string, unknown>> {
  const purchase = await productRepository.getPurchaseById(id)
  if (!purchase) {
    throw new AppError(404, 'Purchase not found', 'PURCHASE_NOT_FOUND')
  }
  return purchase as unknown as Record<string, unknown>
}

export async function getSales(limit = 50): Promise<Record<string, unknown>[]> {
  const sales = await productRepository.getSales(limit)
  return sales as unknown as Record<string, unknown>[]
}

export async function getSaleById(id: string): Promise<Record<string, unknown>> {
  const sale = await productRepository.getSaleById(id)
  if (!sale) {
    throw new AppError(404, 'Sale not found', 'SALE_NOT_FOUND')
  }
  return sale as unknown as Record<string, unknown>
}

// ── Conversion Path Validation ────────────────────────────────

export async function checkConversionPaths(
  baseUnitId: string,
  unitIds: string[]
): Promise<{ unitId: string; unitName: string; unitSymbol: string; valid: boolean; factor: number | null; error: string | null }[]> {
  const results: { unitId: string; unitName: string; unitSymbol: string; valid: boolean; factor: number | null; error: string | null }[] = []

  for (const unitId of unitIds) {
    const unit = await unitRepository.getById(unitId)
    const unitName = unit?.name ?? 'Unknown'
    const unitSymbol = unit?.symbol ?? ''

    try {
      const factor = await conversionService.resolveFactorToBase(unitId, baseUnitId)
      results.push({ unitId, unitName, unitSymbol, valid: true, factor, error: null })
    } catch (err) {
      const message = err instanceof AppError ? err.message : 'Unknown error'
      results.push({ unitId, unitName, unitSymbol, valid: false, factor: null, error: message })
    }
  }

  return results
}
