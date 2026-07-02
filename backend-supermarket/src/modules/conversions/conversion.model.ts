// Model: Table structure definition only
// All SQL query logic is in the controller

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

export interface ConversionStep {
  unitId: string
  unitName: string
  unitSymbol: string
  quantity: number
}
