import { v4 as uuidv4 } from 'uuid'

export type UnitType = 'Packaging' | 'Quantity' | 'Weight' | 'Volume' | 'Length'

export interface Unit {
  id: string
  name: string
  symbol: string
  type: UnitType
  status: 'active' | 'inactive'
  createdAt: string
}

const units: Unit[] = [
  {
    id: '1',
    name: 'Box',
    symbol: 'bx',
    type: 'Packaging',
    status: 'active',
    createdAt: new Date('2024-01-15').toISOString(),
  },
  {
    id: '2',
    name: 'Strip',
    symbol: 'st',
    type: 'Packaging',
    status: 'active',
    createdAt: new Date('2024-01-15').toISOString(),
  },
  {
    id: '3',
    name: 'Tablet',
    symbol: 'tab',
    type: 'Quantity',
    status: 'active',
    createdAt: new Date('2024-02-01').toISOString(),
  },
  {
    id: '4',
    name: 'Kilogram',
    symbol: 'kg',
    type: 'Weight',
    status: 'active',
    createdAt: new Date('2024-02-10').toISOString(),
  },
  {
    id: '5',
    name: 'Gram',
    symbol: 'g',
    type: 'Weight',
    status: 'active',
    createdAt: new Date('2024-02-10').toISOString(),
  },
  {
    id: '6',
    name: 'Liter',
    symbol: 'L',
    type: 'Volume',
    status: 'active',
    createdAt: new Date('2024-03-01').toISOString(),
  },
  {
    id: '7',
    name: 'Meter',
    symbol: 'm',
    type: 'Length',
    status: 'inactive',
    createdAt: new Date('2024-03-15').toISOString(),
  },
]

export function getAllUnits(): Unit[] {
  return [...units]
}

export function getUnitById(id: string): Unit | undefined {
  return units.find((u) => u.id === id)
}

export function createUnit(input: { name: string; symbol: string; type: string }): Unit {
  const unit: Unit = {
    id: uuidv4(),
    name: input.name,
    symbol: input.symbol,
    type: input.type as UnitType,
    status: 'active',
    createdAt: new Date().toISOString(),
  }
  units.push(unit)
  return unit
}

export function updateUnit(id: string, input: Partial<{ name: string; symbol: string; type: string }>): Unit | undefined {
  const index = units.findIndex((u) => u.id === id)
  if (index === -1) return undefined

  const existing = units[index]!
  const updated: Unit = {
    ...existing,
    ...(input.name && { name: input.name }),
    ...(input.symbol && { symbol: input.symbol }),
    ...(input.type && { type: input.type as UnitType }),
  }
  units[index] = updated
  return updated
}

export function deleteUnit(id: string): boolean {
  const index = units.findIndex((u) => u.id === id)
  if (index === -1) return false
  units.splice(index, 1)
  return true
}
