export interface UnitRow {
  id: string
  name: string
  symbol: string
  type: 'Count' | 'Weight' | 'Volume' | 'Length' | 'Area' | 'Packaging'
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}
