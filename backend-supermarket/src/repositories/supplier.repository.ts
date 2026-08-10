import crypto from 'node:crypto'
import { query, run } from '../db'
import type { SupplierRow } from '../modules/suppliers/supplier.model'
import type { CreateSupplierInput, UpdateSupplierInput } from '../modules/suppliers/supplier.validation'

// total_purchases counts purchase orders; last_purchase_date is the most
// recent purchase. outstanding_balance is a stored column (no ledger yet).
const SUPPLIER_SELECT_SQL = `
  SELECT s.*,
    (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = s.id) AS total_purchases,
    (SELECT MAX(p.created_at) FROM purchases p WHERE p.supplier_id = s.id) AS last_purchase_date
  FROM suppliers s
`

function toSupplierRow(row: Record<string, unknown>): SupplierRow {
  return {
    id: row.id as string,
    name: row.name as string,
    gst: (row.gst as string) ?? '',
    contactPerson: (row.contact_person as string) ?? '',
    email: (row.email as string) ?? '',
    phone: (row.phone as string) ?? '',
    address: (row.address as string) ?? '',
    city: (row.city as string) ?? '',
    state: (row.state as string) ?? '',
    pincode: (row.pincode as string) ?? '',
    creditLimit: Number(row.credit_limit ?? 0),
    paymentTerms: (row.payment_terms as string) ?? '',
    outstandingBalance: Number(row.outstanding_balance ?? 0),
    status: row.status as SupplierRow['status'],
    totalPurchases: Number(row.total_purchases ?? 0),
    lastPurchaseDate: (row.last_purchase_date as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function getAll(): Promise<SupplierRow[]> {
  const result = await query<Record<string, unknown>>(
    `${SUPPLIER_SELECT_SQL} ORDER BY s.name COLLATE NOCASE`
  )
  return result.rows.map(toSupplierRow)
}

export async function getById(id: string): Promise<SupplierRow | null> {
  const result = await query<Record<string, unknown>>(
    `${SUPPLIER_SELECT_SQL} WHERE s.id = ?`,
    [id]
  )
  return result.rows[0] ? toSupplierRow(result.rows[0]) : null
}

export async function getByName(name: string): Promise<SupplierRow | null> {
  const result = await query<Record<string, unknown>>(
    `${SUPPLIER_SELECT_SQL} WHERE LOWER(s.name) = LOWER(?)`,
    [name]
  )
  return result.rows[0] ? toSupplierRow(result.rows[0]) : null
}

export async function create(input: CreateSupplierInput): Promise<SupplierRow> {
  const id = crypto.randomUUID()
  await query<Record<string, unknown>>(
    `INSERT INTO suppliers (id, name, gst, contact_person, email, phone, address, city, state, pincode, credit_limit, payment_terms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      id,
      input.name,
      input.gst ?? '',
      input.contactPerson ?? '',
      input.email ?? '',
      input.phone ?? '',
      input.address ?? '',
      input.city ?? '',
      input.state ?? '',
      input.pincode ?? '',
      input.creditLimit ?? 0,
      input.paymentTerms ?? '',
    ]
  )
  return (await getById(id))!
}

export async function update(id: string, input: UpdateSupplierInput): Promise<SupplierRow | null> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name) }
  if (input.gst !== undefined) { fields.push('gst = ?'); values.push(input.gst) }
  if (input.contactPerson !== undefined) { fields.push('contact_person = ?'); values.push(input.contactPerson) }
  if (input.email !== undefined) { fields.push('email = ?'); values.push(input.email) }
  if (input.phone !== undefined) { fields.push('phone = ?'); values.push(input.phone) }
  if (input.address !== undefined) { fields.push('address = ?'); values.push(input.address) }
  if (input.city !== undefined) { fields.push('city = ?'); values.push(input.city) }
  if (input.state !== undefined) { fields.push('state = ?'); values.push(input.state) }
  if (input.pincode !== undefined) { fields.push('pincode = ?'); values.push(input.pincode) }
  if (input.creditLimit !== undefined) { fields.push('credit_limit = ?'); values.push(input.creditLimit) }
  if (input.paymentTerms !== undefined) { fields.push('payment_terms = ?'); values.push(input.paymentTerms) }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status) }

  if (fields.length === 0) return getById(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  await run(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, values)
  return getById(id)
}

export async function remove(id: string): Promise<boolean> {
  const result = await run('DELETE FROM suppliers WHERE id = ?', [id])
  return result.changes > 0
}
