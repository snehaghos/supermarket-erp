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
