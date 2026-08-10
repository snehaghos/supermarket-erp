export interface CustomerRow {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  pincode: string
  loyaltyPoints: number
  creditLimit: number
  outstandingBalance: number
  status: 'active' | 'inactive'
  totalPurchases: number
  lastPurchaseDate: string | null
  createdAt: string
  updatedAt: string
}
