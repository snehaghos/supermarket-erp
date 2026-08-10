import { AppError } from '../middleware/errorHandler'
import * as productRepository from '../repositories/product.repository'
import * as unitRepository from '../repositories/unit.repository'
import * as supplierRepository from '../repositories/supplier.repository'
import * as customerRepository from '../repositories/customer.repository'
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
  ReturnStockInput,
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

// ── Product Conversion Helpers (user-defined, product-scoped) ──
// Categories are NOT validated here — a unit may be linked to any product and
// the user defines its conversion factor per product. We only guard against
// empty/zero/negative factors, duplicate units, circular chains, and
// inconsistent chains (all checked on save, never while selecting).

interface ProductConversionLike {
  fromUnitId: string
  toUnitId: string
  conversionFactor: number
}

/**
 * Resolve how many base units equal 1 fromUnit using ONLY the product's
 * own conversion graph — never the global conversion table.
 *
 * Edge A → B with factor f means: 1 A = f × B.
 * Returns null when no path exists (the user still needs to define it).
 */
function resolveFactorFromGraph(
  fromUnitId: string,
  baseUnitId: string,
  conversions: ProductConversionLike[]
): number | null {
  if (fromUnitId === baseUnitId) return 1

  const adj = new Map<string, { to: string; factor: number }[]>()
  for (const c of conversions) {
    if (!adj.has(c.fromUnitId)) adj.set(c.fromUnitId, [])
    if (!adj.has(c.toUnitId)) adj.set(c.toUnitId, [])
    adj.get(c.fromUnitId)!.push({ to: c.toUnitId, factor: c.conversionFactor })
    adj.get(c.toUnitId)!.push({ to: c.fromUnitId, factor: 1 / c.conversionFactor })
  }

  const queue: { node: string; factor: number }[] = [{ node: fromUnitId, factor: 1 }]
  const visited = new Set<string>()
  while (queue.length > 0) {
    const { node, factor } = queue.shift()!
    if (node === baseUnitId) return factor
    if (visited.has(node)) continue
    visited.add(node)
    for (const edge of adj.get(node) ?? []) {
      if (!visited.has(edge.to)) queue.push({ node: edge.to, factor: factor * edge.factor })
    }
  }
  return null
}

/** Reject circular chains in the product's conversion graph. */
function validateNoCircularConversion(conversions: ProductConversionLike[]): void {
  const adj = new Map<string, string[]>()
  for (const c of conversions) {
    if (!adj.has(c.fromUnitId)) adj.set(c.fromUnitId, [])
    adj.get(c.fromUnitId)!.push(c.toUnitId)
  }
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()

  function visit(node: string): void {
    color.set(node, GRAY)
    for (const next of adj.get(node) ?? []) {
      const state = color.get(next) ?? WHITE
      if (state === GRAY) {
        throw new AppError(400, 'Circular conversion would create ambiguity', 'CIRCULAR_CONVERSION_CHAIN')
      }
      if (state === WHITE) visit(next)
    }
    color.set(node, BLACK)
  }

  for (const node of adj.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) visit(node)
  }
}

/** Reject duplicate/conflicting factors for the same unit pair or via different paths. */
function validateConversionConsistency(conversions: ProductConversionLike[]): void {
  const pairFactors = new Map<string, number>()
  for (const c of conversions) {
    const key = `${c.fromUnitId}->${c.toUnitId}`
    const existing = pairFactors.get(key)
    if (existing !== undefined) {
      if (Math.abs(existing - c.conversionFactor) > 1e-9) {
        throw new AppError(400, 'Conflicting conversion factors for the same unit pair', 'INCONSISTENT_CONVERSION_CHAIN')
      }
      throw new AppError(400, 'Duplicate conversion for the same unit pair', 'DUPLICATE_CONVERSION')
    }
    pairFactors.set(key, c.conversionFactor)
  }

  for (const c of conversions) {
    const others = conversions.filter(
      x => !(x.fromUnitId === c.fromUnitId && x.toUnitId === c.toUnitId)
    )
    const resolved = resolveFactorFromGraph(c.fromUnitId, c.toUnitId, others)
    if (resolved !== null && Math.abs(resolved - c.conversionFactor) > 1e-9) {
      throw new AppError(400, 'Conversion chain is inconsistent', 'INCONSISTENT_CONVERSION_CHAIN')
    }
  }
}

/**
 * Determine factor_to_base for a linked unit.
 * 1. An explicit user-entered factor wins (must be > 0).
 * 2. Otherwise it is resolved from the product's own conversion graph.
 * 3. If neither exists, saving fails with a clear "define the conversion" error.
 */
async function requireFactorToBase(
  unitId: string,
  baseUnitId: string,
  explicitFactor: number | undefined,
  conversions: ProductConversionLike[],
  label: string
): Promise<number> {
  if (unitId === baseUnitId) return 1
  if (explicitFactor !== undefined) {
    if (!isFinite(explicitFactor) || explicitFactor <= 0) {
      const unit = await unitRepository.getById(unitId)
      throw new AppError(
        400,
        `${label} (${unit?.name ?? 'Unknown'}): enter a conversion factor greater than 0`,
        'INVALID_CONVERSION_FACTOR'
      )
    }
    // An explicit factor must agree with the product's conversion graph when a
    // path already exists — otherwise the chain would be inconsistent.
    const resolved = resolveFactorFromGraph(unitId, baseUnitId, conversions)
    if (resolved !== null && Math.abs(resolved - explicitFactor) > 1e-9) {
      const [unit, baseUnit] = await Promise.all([
        unitRepository.getById(unitId),
        unitRepository.getById(baseUnitId),
      ])
      throw new AppError(
        400,
        `${label} (${unit?.name ?? 'Unknown'}): 1 ${unit?.name ?? '?'} = ${explicitFactor} ${baseUnit?.name ?? '?'} conflicts with the conversion chain (1 ${unit?.name ?? '?'} = ${resolved} ${baseUnit?.name ?? '?'})`,
        'INCONSISTENT_CONVERSION_CHAIN'
      )
    }
    return explicitFactor
  }
  const resolved = resolveFactorFromGraph(unitId, baseUnitId, conversions)
  if (resolved !== null && resolved > 0) return resolved

  const [unit, baseUnit] = await Promise.all([
    unitRepository.getById(unitId),
    unitRepository.getById(baseUnitId),
  ])
  throw new AppError(
    400,
    `Define the conversion: 1 ${unit?.name ?? 'unit'} = ? ${baseUnit?.name ?? 'base unit'} (${label})`,
    'MISSING_CONVERSION'
  )
}

/**
 * Build the product conversion entries + factor_to_base for every linked unit.
 * Shared by create and update. Throws only on Save for the rules the user set:
 * empty/zero/negative factor, duplicate unit, circular chain, inconsistent chain.
 */
async function buildProductConversionData(params: {
  baseUnitId: string
  purchaseUnitId: string | null
  purchaseUnitFactor?: number
  sellingUnitId: string | null
  sellingUnitFactor?: number
  additionalUnits: { unitId: string; factorToBase?: number; isPurchaseUnit: boolean; isSellingUnit: boolean }[]
  productConversions: ProductConversionLike[]
}): Promise<{
  conversionEntries: { fromUnitId: string; toUnitId: string; conversionFactor: number; relationshipText: string }[]
  additionalEntries: { unitId: string; factorToBase: number; isPurchaseUnit: boolean; isSellingUnit: boolean }[]
}> {
  const { baseUnitId, purchaseUnitId, sellingUnitId } = params

  // Auto-generated purchase/selling relationships (primary user input).
  // Skip when the same pair is already defined in productConversions so the
  // duplicate check below doesn't false-positive on consistent input.
  const conversions: ProductConversionLike[] = [...params.productConversions]
  const pushIfAbsent = (entry: ProductConversionLike) => {
    if (!conversions.some(c => c.fromUnitId === entry.fromUnitId && c.toUnitId === entry.toUnitId)) {
      conversions.push(entry)
    }
  }
  if (purchaseUnitId && purchaseUnitId !== baseUnitId && params.purchaseUnitFactor) {
    pushIfAbsent({ fromUnitId: purchaseUnitId, toUnitId: baseUnitId, conversionFactor: params.purchaseUnitFactor })
  }
  if (sellingUnitId && sellingUnitId !== baseUnitId && params.sellingUnitFactor) {
    pushIfAbsent({ fromUnitId: sellingUnitId, toUnitId: baseUnitId, conversionFactor: params.sellingUnitFactor })
  }

  validateNoCircularConversion(conversions)
  validateConversionConsistency(conversions)

  const additionalEntries: { unitId: string; factorToBase: number; isPurchaseUnit: boolean; isSellingUnit: boolean }[] = []

  for (const au of params.additionalUnits) {
    const factorToBase = await requireFactorToBase(au.unitId, baseUnitId, au.factorToBase, conversions, 'Additional unit')
    additionalEntries.push({ unitId: au.unitId, factorToBase, isPurchaseUnit: au.isPurchaseUnit, isSellingUnit: au.isSellingUnit })
  }

  if (purchaseUnitId && !additionalEntries.some(e => e.unitId === purchaseUnitId)) {
    const factorToBase = await requireFactorToBase(purchaseUnitId, baseUnitId, params.purchaseUnitFactor, conversions, 'Purchase unit')
    additionalEntries.push({ unitId: purchaseUnitId, factorToBase, isPurchaseUnit: true, isSellingUnit: false })
  }

  if (sellingUnitId && !additionalEntries.some(e => e.unitId === sellingUnitId)) {
    const factorToBase = await requireFactorToBase(sellingUnitId, baseUnitId, params.sellingUnitFactor, conversions, 'Selling unit')
    additionalEntries.push({ unitId: sellingUnitId, factorToBase, isPurchaseUnit: false, isSellingUnit: true })
  }

  // Human-readable relationship text (from = larger unit, to = smaller unit)
  const conversionEntries: { fromUnitId: string; toUnitId: string; conversionFactor: number; relationshipText: string }[] = []
  for (const c of conversions) {
    const [fromUnit, toUnit] = await Promise.all([
      unitRepository.getById(c.fromUnitId),
      unitRepository.getById(c.toUnitId),
    ])
    conversionEntries.push({
      fromUnitId: c.fromUnitId,
      toUnitId: c.toUnitId,
      conversionFactor: c.conversionFactor,
      relationshipText: `1 ${fromUnit?.name ?? '?'} = ${c.conversionFactor} ${toUnit?.name ?? '?'}`,
    })
  }

  return { conversionEntries, additionalEntries }
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

  // ── Reject duplicate unit selections ───────────────────────
  const seenUnits = new Set<string>([input.baseUnitId])
  const selectedUnitIds = [
    ...(input.purchaseUnitId ? [input.purchaseUnitId] : []),
    ...(input.sellingUnitId ? [input.sellingUnitId] : []),
    ...(input.additionalUnits ?? []).map(u => u.unitId).filter(Boolean),
  ]
  for (const unitId of selectedUnitIds) {
    if (seenUnits.has(unitId)) {
      const unit = await unitRepository.getById(unitId)
      throw new AppError(400, `The unit "${unit?.name ?? 'Unknown'}" is selected more than once`, 'DUPLICATE_UNIT')
    }
    seenUnits.add(unitId)
  }

  // ── Build user-defined conversions + per-unit factors ─────
  const { conversionEntries, additionalEntries } = await buildProductConversionData({
    baseUnitId: input.baseUnitId,
    purchaseUnitId: input.purchaseUnitId ?? null,
    purchaseUnitFactor: input.purchaseUnitFactor,
    sellingUnitId: input.sellingUnitId ?? null,
    sellingUnitFactor: input.sellingUnitFactor,
    additionalUnits: input.additionalUnits ?? [],
    productConversions: input.productConversions ?? [],
  })

  // Convert opening stock to base unit if provided in a different unit
  let openingStockBase = input.openingStock
  if (input.purchaseUnitId && input.purchaseUnitId !== input.baseUnitId && input.openingStock > 0) {
    const factor = input.purchaseUnitFactor
      ?? resolveFactorFromGraph(input.purchaseUnitId, input.baseUnitId, conversionEntries)
    if (factor) openingStockBase = input.openingStock * factor
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
    conversionEntries,
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

  // Effective unit selections (fall back to existing values when not provided)
  const effectiveBaseUnitId = input.baseUnitId ?? existing.baseUnitId
  const effectivePurchaseUnitId = input.purchaseUnitId !== undefined ? input.purchaseUnitId : existing.purchaseUnitId
  const effectiveSellingUnitId = input.sellingUnitId !== undefined ? input.sellingUnitId : existing.sellingUnitId

  const unitsTouched =
    input.additionalUnits !== undefined ||
    input.baseUnitId !== undefined ||
    input.purchaseUnitId !== undefined ||
    input.sellingUnitId !== undefined ||
    input.purchaseUnitFactor !== undefined ||
    input.sellingUnitFactor !== undefined ||
    input.productConversions !== undefined

  if (!unitsTouched) {
    return (await productRepository.getProductById(id))!
  }

  // ── Reject duplicate unit selections ───────────────────────
  const selectedUnitIds = [
    ...(effectivePurchaseUnitId ? [effectivePurchaseUnitId] : []),
    ...(effectiveSellingUnitId ? [effectiveSellingUnitId] : []),
    ...(input.additionalUnits ?? []).map(u => u.unitId).filter(Boolean),
  ]
  const seenUnits = new Set<string>([effectiveBaseUnitId])
  for (const unitId of selectedUnitIds) {
    if (seenUnits.has(unitId)) {
      const unit = await unitRepository.getById(unitId)
      throw new AppError(400, `The unit "${unit?.name ?? 'Unknown'}" is selected more than once`, 'DUPLICATE_UNIT')
    }
    seenUnits.add(unitId)
  }

  // Effective conversion data (new if provided, otherwise existing)
  const productConversions = input.productConversions ??
    existing.productConversions.map(c => ({
      fromUnitId: c.fromUnitId,
      toUnitId: c.toUnitId,
      conversionFactor: c.conversionFactor,
    }))

  const additionalUnits = input.additionalUnits ??
    existing.units
      .filter(u => u.unitId !== effectiveBaseUnitId)
      .map(u => ({
        unitId: u.unitId,
        factorToBase: u.factorToBase,
        isPurchaseUnit: u.isPurchaseUnit,
        isSellingUnit: u.isSellingUnit,
      }))

  // Fall back to the factor stored on the product_units row for legacy data.
  const existingPurchaseRow = effectivePurchaseUnitId
    ? existing.units.find(u => u.unitId === effectivePurchaseUnitId)
    : undefined
  const existingSellingRow = effectiveSellingUnitId
    ? existing.units.find(u => u.unitId === effectiveSellingUnitId)
    : undefined
  const purchaseUnitFactor = input.purchaseUnitFactor ??
    existing.productConversions.find(
      c => c.fromUnitId === effectivePurchaseUnitId && c.toUnitId === effectiveBaseUnitId
    )?.conversionFactor ??
    (effectivePurchaseUnitId && effectivePurchaseUnitId !== effectiveBaseUnitId
      ? existingPurchaseRow?.factorToBase
      : undefined)
  const sellingUnitFactor = input.sellingUnitFactor ??
    existing.productConversions.find(
      c => c.fromUnitId === effectiveSellingUnitId && c.toUnitId === effectiveBaseUnitId
    )?.conversionFactor ??
    (effectiveSellingUnitId && effectiveSellingUnitId !== effectiveBaseUnitId
      ? existingSellingRow?.factorToBase
      : undefined)

  // ── Rebuild user-defined conversions + per-unit factors ────
  const { conversionEntries, additionalEntries } = await buildProductConversionData({
    baseUnitId: effectiveBaseUnitId,
    purchaseUnitId: effectivePurchaseUnitId,
    purchaseUnitFactor,
    sellingUnitId: effectiveSellingUnitId,
    sellingUnitFactor,
    additionalUnits,
    productConversions,
  })

  // Persist conversions: delete existing and re-insert
  await productRepository.deleteAllProductConversions(id)
  if (conversionEntries.length > 0) {
    await productRepository.saveProductConversions(id, conversionEntries)
  }

  // Persist product units: delete existing and re-insert
  await run('DELETE FROM product_units WHERE product_id = ?', [id])
  await productRepository.saveProductUnits(id, effectiveBaseUnitId, additionalEntries)

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

  // Reject circular/inconsistent additions before persisting.
  const existing = await productRepository.getProductConversions(productId)
  const candidate: ProductConversionLike[] = [
    ...existing.map(c => ({ fromUnitId: c.fromUnitId, toUnitId: c.toUnitId, conversionFactor: c.conversionFactor })),
    { fromUnitId: input.fromUnitId, toUnitId: input.toUnitId, conversionFactor: input.conversionFactor },
  ]
  validateNoCircularConversion(candidate)
  validateConversionConsistency(candidate)

  // Auto-generate human-readable relationship text if not provided.
  // Graph semantics: 1 fromUnit = factor × toUnit.
  let relationshipText = input.relationshipText
  if (!relationshipText) {
    const [fromUnit, toUnit] = await Promise.all([
      unitRepository.getById(input.fromUnitId),
      unitRepository.getById(input.toUnitId),
    ])
    const fromName = fromUnit?.name ?? '?'
    const toName = toUnit?.name ?? '?'
    relationshipText = `1 ${fromName} = ${input.conversionFactor} ${toName}`
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
  const existing = await productRepository.getProductConversionById(id)
  if (!existing) {
    throw new AppError(404, 'Product conversion not found', 'CONVERSION_NOT_FOUND')
  }

  // Reject circular/inconsistent edits against the product's full graph.
  const all = await productRepository.getProductConversions(existing.productId)
  const candidate: ProductConversionLike[] = all.map(c => {
    if (c.id !== id) {
      return { fromUnitId: c.fromUnitId, toUnitId: c.toUnitId, conversionFactor: c.conversionFactor }
    }
    return {
      fromUnitId: input.fromUnitId ?? c.fromUnitId,
      toUnitId: input.toUnitId ?? c.toUnitId,
      conversionFactor: input.conversionFactor ?? c.conversionFactor,
    }
  })
  validateNoCircularConversion(candidate)
  validateConversionConsistency(candidate)

  const updated = await productRepository.updateProductConversion(id, input)
  if (!updated) {
    throw new AppError(500, 'Failed to update product conversion', 'UPDATE_FAILED')
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

  // Stock is always calculated with the product's OWN user-defined factor,
  // never the global conversion table.
  const baseQuantity = input.quantity * productUnit.factorToBase

  const previousStock = product.currentStock
  const remainingStock = previousStock + baseQuantity

  // If a supplier was selected, make sure it still exists
  if (input.supplierId && !(await supplierRepository.getById(input.supplierId))) {
    throw new AppError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND')
  }

  const purchaseNumber = `PUR-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  const purchase = await productRepository.createPurchase({
    supplierId: input.supplierId,
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

  // Stock is always calculated with the product's OWN user-defined factor.
  const baseQuantity = input.quantity * productUnit.factorToBase

  const previousStock = product.currentStock
  if (baseQuantity > previousStock) {
    throw new AppError(
      409,
      `Insufficient stock. Available: ${previousStock} ${product.baseUnitSymbol}, requested: ${baseQuantity} ${product.baseUnitSymbol} (${input.quantity} ${productUnit.unitSymbol})`,
      'INSUFFICIENT_STOCK'
    )
  }

  const remainingStock = previousStock - baseQuantity

  // If a customer was selected, make sure it still exists
  if (input.customerId && !(await customerRepository.getById(input.customerId))) {
    throw new AppError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND')
  }

  const saleNumber = `SAL-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  const sale = await productRepository.createSale({
    customerId: input.customerId,
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

// ── Return Stock ────────────────────────────────────────────────

export async function returnStock(input: ReturnStockInput): Promise<{
  remainingStock: number
}> {
  const product = await getProductOrThrow(input.productId)

  const productUnit = await productRepository.getProductUnit(input.productId, input.unitId)
  if (!productUnit) {
    throw new AppError(400, 'This unit is not available for this product', 'UNIT_NOT_AVAILABLE')
  }

  // Returns restock the shelf using the product's OWN user-defined factor.
  const baseQuantity = input.quantity * productUnit.factorToBase

  const previousStock = product.currentStock
  const remainingStock = previousStock + baseQuantity

  await productRepository.updateProductStock(input.productId, remainingStock)

  await productRepository.createTransaction({
    productId: input.productId,
    transactionType: 'return' as const,
    unitId: input.unitId,
    unitQuantity: input.quantity,
    baseQuantity,
    previousStock,
    remainingStock,
    notes: input.notes || `Return (${input.reason || 'Customer return'})${input.customerName ? ` — ${input.customerName}` : ''}`,
  })

  return { remainingStock }
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

  // Stock is always calculated with the product's OWN user-defined factor.
  const requestedInBase = quantity * productUnit.factorToBase
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


