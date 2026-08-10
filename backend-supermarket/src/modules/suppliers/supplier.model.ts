export interface SupplierRow {
  id: string
  name: string
  gst: string
  contactPerson: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  pincode: string
  creditLimit: number
  paymentTerms: string
  outstandingBalance: number
  status: 'active' | 'inactive'
  totalPurchases: number
  lastPurchaseDate: string | null
  createdAt: string
  updatedAt: string
}
