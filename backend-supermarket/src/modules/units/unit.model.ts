// Model: Table structure definition only
// All SQL query logic is in the controller

export interface UnitRow {
  id: string
  name: string
  symbol: string
  type: 'Packaging' | 'Quantity' | 'Weight' | 'Volume' | 'Length'
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}
