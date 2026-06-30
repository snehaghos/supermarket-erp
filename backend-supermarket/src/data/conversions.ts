import { v4 as uuidv4 } from 'uuid'
import { getAllUnits } from './units'

export interface Conversion {
  id: string
  parentUnitId: string
  childUnitId: string
  factor: number
  parentUnitName?: string
  parentUnitSymbol?: string
  childUnitName?: string
  childUnitSymbol?: string
  createdAt?: string
}

const conversions: Conversion[] = [
  {
    id: '1',
    parentUnitId: '1',
    childUnitId: '2',
    factor: 10,
    createdAt: new Date('2024-03-01').toISOString(),
  },
  {
    id: '2',
    parentUnitId: '2',
    childUnitId: '3',
    factor: 10,
    createdAt: new Date('2024-03-01').toISOString(),
  },
  {
    id: '3',
    parentUnitId: '4',
    childUnitId: '5',
    factor: 1000,
    createdAt: new Date('2024-03-15').toISOString(),
  },
]

function enrichConversion(c: Conversion): Conversion {
  const units = getAllUnits()
  const parent = units.find((u) => u.id === c.parentUnitId)
  const child = units.find((u) => u.id === c.childUnitId)
  return {
    ...c,
    parentUnitName: parent?.name,
    parentUnitSymbol: parent?.symbol,
    childUnitName: child?.name,
    childUnitSymbol: child?.symbol,
  }
}

export function getAllConversions(): Conversion[] {
  return conversions.map(enrichConversion)
}

export function getConversionById(id: string): Conversion | undefined {
  const c = conversions.find((conv) => conv.id === id)
  return c ? enrichConversion(c) : undefined
}

export function createConversion(input: { parentUnitId: string; childUnitId: string; factor: number }): Conversion {
  const conversion: Conversion = {
    id: uuidv4(),
    parentUnitId: input.parentUnitId,
    childUnitId: input.childUnitId,
    factor: input.factor,
    createdAt: new Date().toISOString(),
  }
  conversions.push(conversion)
  return enrichConversion(conversion)
}

export function updateConversion(id: string, input: Partial<{ parentUnitId: string; childUnitId: string; factor: number }>): Conversion | undefined {
  const index = conversions.findIndex((c) => c.id === id)
  if (index === -1) return undefined

  conversions[index] = {
    ...conversions[index]!,
    ...(input.parentUnitId && { parentUnitId: input.parentUnitId }),
    ...(input.childUnitId && { childUnitId: input.childUnitId }),
    ...(input.factor && { factor: input.factor }),
  }

  return enrichConversion(conversions[index]!)
}

export function deleteConversion(id: string): boolean {
  const index = conversions.findIndex((c) => c.id === id)
  if (index === -1) return false
  conversions.splice(index, 1)
  return true
}

export interface ConversionStep {
  unitId: string
  unitName: string
  unitSymbol: string
  quantity: number
}

export function previewConversion(quantity: number, unitId: string): ConversionStep[] {
  const steps: ConversionStep[] = []
  const units = getAllUnits()
  const unit = units.find((u) => u.id === unitId)
  if (!unit) return steps

  steps.push({
    unitId: unit.id,
    unitName: unit.name,
    unitSymbol: unit.symbol,
    quantity,
  })

  // Walk down the conversion chain (parent → child)
  let currentId = unitId
  let currentQty = quantity

  // Limit to prevent infinite loops
  let maxIterations = 20
  while (maxIterations > 0) {
    maxIterations--

    const conv = conversions.find((c) => c.parentUnitId === currentId)
    if (!conv) break

    currentQty = currentQty * conv.factor
    currentId = conv.childUnitId

    const childUnit = units.find((u) => u.id === currentId)
    steps.push({
      unitId: currentId,
      unitName: childUnit?.name ?? 'Unknown',
      unitSymbol: childUnit?.symbol ?? '',
      quantity: currentQty,
    })
  }

  return steps
}
