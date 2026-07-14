import { AppError } from '../middleware/errorHandler'
import * as conversionRepository from '../repositories/conversion.repository'
import * as unitRepository from '../repositories/unit.repository'
import type { ConversionRow, ConversionStep } from '../modules/conversions/conversion.model'
import type { CreateConversionInput, UpdateConversionInput } from '../modules/conversions/conversion.validation'
import type { UnitRow } from '../modules/units/unit.model'

const MAX_CONVERSION_CHAIN_DEPTH = 20

// ============================================================
// CONVERSION ENGINE — Core reusable conversion functions
// ============================================================

/**
 * Walk the conversion chain to find how many base units equal 1 `fromUnit`.
 *
 * Tries TWO directions:
 *   1. Downward (parent→child): multiply by factor at each step
 *   2. Upward (child→parent): divide by factor at each step
 *
 * Parent → Child chain:  1 parent = factor × child
 *   e.g. Box → Strip (×20), Strip → Tablet (×10)
 *   resolveFactorToBase('Box', 'Tablet')  => 200  (downward)
 *   resolveFactorToBase('Strip', 'Box')   => 0.05 (upward via division: 1/20)
 */
export async function resolveFactorToBase(
  fromUnitId: string,
  baseUnitId: string
): Promise<number> {
  // If already the base unit, factor is 1
  if (fromUnitId === baseUnitId) return 1

  // Validate same category
  const fromUnit = await unitRepository.getById(fromUnitId)
  const baseUnit = await unitRepository.getById(baseUnitId)
  if (!fromUnit || !baseUnit) {
    throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND')
  }
  if (fromUnit.type !== baseUnit.type) {
    throw new AppError(
      400,
      `Cannot convert between different unit categories: ${fromUnit.type} → ${baseUnit.type}`,
      'INVALID_UNIT_CATEGORY'
    )
  }

  // ── Try direction 1: walk parent→child (downward) ──────────
  async function walkDownward(): Promise<number | null> {
    let factor = 1
    let current = fromUnitId
    let steps = 0
    while (steps < MAX_CONVERSION_CHAIN_DEPTH) {
      steps++
      if (current === baseUnitId) return factor
      const conv = await conversionRepository.getByParentId(current)
      if (!conv) return null
      factor *= conv.factor
      current = conv.childUnitId
    }
    return current === baseUnitId ? factor : null
  }

  const downward = await walkDownward()
  if (downward !== null) return downward

  // ── Try direction 2: walk child→parent (upward) ────────────
  async function walkUpward(): Promise<number | null> {
    let factor = 1
    let current = fromUnitId
    let steps = 0
    while (steps < MAX_CONVERSION_CHAIN_DEPTH) {
      steps++
      if (current === baseUnitId) return factor
      // Find a conversion where current unit is the CHILD
      const conv = await conversionRepository.getByChildId(current)
      if (!conv) return null
      // Going upward: 1 child = (1/factor) parent
      // So divide by factor at each step
      factor /= conv.factor
      current = conv.parentUnitId
    }
    return current === baseUnitId ? factor : null
  }

  const upward = await walkUpward()
  if (upward !== null) return upward

  throw new AppError(
    400,
    `No conversion path found from ${fromUnit?.name ?? 'unknown'} to ${baseUnit?.name ?? 'unknown'}`,
    'NO_CONVERSION_PATH'
  )
}

/**
 * Convert a quantity from a given unit to the base unit.
 * quantity_in_base = quantity × factor_to_base
 */
export async function convertToBaseUnit(
  quantity: number,
  fromUnitId: string,
  baseUnitId: string
): Promise<number> {
  if (quantity < 0) {
    throw new AppError(400, 'Quantity cannot be negative', 'NEGATIVE_QUANTITY')
  }
  const factor = await resolveFactorToBase(fromUnitId, baseUnitId)
  return quantity * factor
}

/**
 * Convert a quantity from the base unit to a target unit.
 * quantity_in_target = base_quantity / factor_to_base
 */
export async function convertFromBaseUnit(
  baseQuantity: number,
  toUnitId: string,
  baseUnitId: string
): Promise<number> {
  if (baseQuantity < 0) {
    throw new AppError(400, 'Quantity cannot be negative', 'NEGATIVE_QUANTITY')
  }
  const factor = await resolveFactorToBase(toUnitId, baseUnitId)
  return baseQuantity / factor
}

/**
 * Display breakdown: given a base quantity and a list of display units
 * (sorted by factor_to_base descending), decompose the quantity into
 * human-readable parts.
 *
 * Example:
 *   baseQuantity = 295 (Tablets)
 *   units = [{ unit: Box, factor_to_base: 200 }, { unit: Strip, factor_to_base: 10 }, { unit: Tablet, factor_to_base: 1 }]
 *   Result: [{ unit: Box, quantity: 1 }, { unit: Strip, quantity: 9 }, { unit: Tablet, quantity: 5 }]
 */
export function getDisplayQuantity(
  baseQuantity: number,
  displayUnits: { unitId: string; unitName: string; unitSymbol: string; factorToBase: number }[]
): { unitId: string; unitName: string; unitSymbol: string; quantity: number }[] {
  if (displayUnits.length === 0) {
    return [{ unitId: '', unitName: 'Units', unitSymbol: 'U', quantity: baseQuantity }]
  }

  // Sort by factor_to_base descending (largest unit first)
  const sorted = [...displayUnits].sort((a, b) => b.factorToBase - a.factorToBase)

  const result: { unitId: string; unitName: string; unitSymbol: string; quantity: number }[] = []
  let remainder = Math.abs(baseQuantity)

  for (const unit of sorted) {
    if (unit.factorToBase <= 0) continue
    const wholePart = Math.floor(remainder / unit.factorToBase)
    if (wholePart > 0 || result.length > 0) {
      result.push({
        unitId: unit.unitId,
        unitName: unit.unitName,
        unitSymbol: unit.unitSymbol,
        quantity: wholePart,
      })
    }
    remainder = remainder % unit.factorToBase
  }

  // If no display units matched (remainder < smallest unit's factor_to_base), add remainder as the smallest unit
  if (result.length === 0 || remainder > 0) {
    // Use the smallest unit (last in sorted, which is the base unit typically)
    const smallestUnit = sorted[sorted.length - 1]!
    result.push({
      unitId: smallestUnit.unitId,
      unitName: smallestUnit.unitName,
      unitSymbol: smallestUnit.unitSymbol,
      quantity: remainder + (result.length === 0 ? Math.floor(Math.abs(baseQuantity) / smallestUnit.factorToBase) : 0),
    })
  }

  return result
}

/**
 * Simple text display of quantity in base unit.
 * e.g. 15340 Grams → "15.34 kg" or "15 Kilograms, 340 Grams"
 */
export function formatDisplayQuantity(
  baseQuantity: number,
  displayUnits: { unitId: string; unitName: string; unitSymbol: string; factorToBase: number }[]
): string {
  const parts = getDisplayQuantity(baseQuantity, displayUnits)
  return parts.map(p => `${p.quantity} ${p.unitSymbol}`).join(', ')
}

// ============================================================
// EXISTING CONVERSION SERVICE FUNCTIONS (preserved)
// ============================================================

export async function getConversionOrThrow(id: string): Promise<ConversionRow> {
  const conversion = await conversionRepository.getById(id)
  if (!conversion) {
    throw new AppError(404, 'Conversion not found', 'CONVERSION_NOT_FOUND')
  }
  return conversion
}

export async function validateUnits(
  parentUnitId: string,
  childUnitId: string
): Promise<{ parent: UnitRow; child: UnitRow }> {
  const parent = await unitRepository.getById(parentUnitId)
  if (!parent) {
    throw new AppError(404, 'Parent unit not found', 'PARENT_UNIT_NOT_FOUND')
  }
  const child = await unitRepository.getById(childUnitId)
  if (!child) {
    throw new AppError(404, 'Child unit not found', 'CHILD_UNIT_NOT_FOUND')
  }
  if (parentUnitId === childUnitId) {
    throw new AppError(400, 'Parent and child units must be different', 'SAME_UNIT')
  }
  if (parent.type !== child.type) {
    throw new AppError(
      400,
      `Cannot convert between different unit categories: ${parent.name} (${parent.type}) → ${child.name} (${child.type})`,
      'INVALID_UNIT_CATEGORY'
    )
  }
  return { parent, child }
}

// Walk from child → ... → parent to detect circular chains
export async function validateNoCircularChain(
  parentUnitId: string,
  childUnitId: string
): Promise<void> {
  let currentUnitId = childUnitId
  let stepsChecked = 0

  while (stepsChecked < MAX_CONVERSION_CHAIN_DEPTH) {
    stepsChecked++
    const nextConversion = await conversionRepository.getByParentId(currentUnitId)
    if (!nextConversion) break
    if (nextConversion.childUnitId === parentUnitId) {
      throw new AppError(400, 'This conversion would create a circular chain', 'CIRCULAR_CONVERSION_CHAIN')
    }
    currentUnitId = nextConversion.childUnitId
  }
}

// Walk parent → child chain applying factors: quantity × factor at each step
export async function getConversionPreview(
  quantity: number,
  unitId: string
): Promise<ConversionStep[]> {
  const steps: ConversionStep[] = []

  const startingUnit = await unitRepository.getById(unitId)
  if (!startingUnit) {
    throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND')
  }

  steps.push({
    unitId: startingUnit.id,
    unitName: startingUnit.name,
    unitSymbol: startingUnit.symbol,
    quantity,
  })

  let currentUnitId = unitId
  let currentQuantity = quantity
  let stepsRemaining = MAX_CONVERSION_CHAIN_DEPTH

  while (stepsRemaining > 0) {
    stepsRemaining--
    const conversion = await conversionRepository.getByParentId(currentUnitId)
    if (!conversion) break
    currentQuantity = currentQuantity * conversion.factor
    currentUnitId = conversion.childUnitId
    const childUnit = await unitRepository.getById(currentUnitId)
    steps.push({
      unitId: currentUnitId,
      unitName: childUnit?.name ?? 'Unknown',
      unitSymbol: childUnit?.symbol ?? '',
      quantity: currentQuantity,
    })
  }

  return steps
}

export async function getAll(): Promise<ConversionRow[]> {
  return conversionRepository.getAll()
}

export async function create(input: CreateConversionInput): Promise<ConversionRow> {
  await validateUnits(input.parentUnitId, input.childUnitId)
  await validateNoCircularChain(input.parentUnitId, input.childUnitId)
  try {
    return await conversionRepository.create(input)
  } catch (err: any) {
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new AppError(409, 'This conversion pair already exists', 'DUPLICATE_CONVERSION')
    }
    throw err
  }
}

export async function update(id: string, input: UpdateConversionInput): Promise<ConversionRow> {
  await getConversionOrThrow(id)
  if (input.parentUnitId && input.childUnitId) {
    await validateUnits(input.parentUnitId, input.childUnitId)
    await validateNoCircularChain(input.parentUnitId, input.childUnitId)
  } else if (input.parentUnitId) {
    const parent = await unitRepository.getById(input.parentUnitId)
    if (!parent) throw new AppError(404, 'Parent unit not found', 'PARENT_UNIT_NOT_FOUND')
  } else if (input.childUnitId) {
    const child = await unitRepository.getById(input.childUnitId)
    if (!child) throw new AppError(404, 'Child unit not found', 'CHILD_UNIT_NOT_FOUND')
  }
  const updated = await conversionRepository.update(id, input)
  if (!updated) throw new AppError(500, 'Failed to update conversion', 'UPDATE_FAILED')
  return updated
}

export async function remove(id: string): Promise<void> {
  await getConversionOrThrow(id)
  const deleted = await conversionRepository.remove(id)
  if (!deleted) throw new AppError(500, 'Failed to delete conversion', 'DELETE_FAILED')
}
