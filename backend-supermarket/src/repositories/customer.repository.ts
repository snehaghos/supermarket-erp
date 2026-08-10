import crypto from 'node:crypto'
import { query, run } from '../db'
import type { CustomerRow } from '../modules/customers/customer.model'
import type { CreateCustomerInput, UpdateCustomerInput } from '../modules/customers/customer.validation'

// total_purchases counts sale orders; last_purchase_date is the most recent
// sale. outstanding_balance is a stored column (no ledger yet).
const CUSTOMER_SELECT_SQL = `
  SELECT c.*,
    (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id) AS total_purchases,
    (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id) AS last_purchase_date
  FROM customers c
`

function toCustomerRow(row: Record<string, unknown>): CustomerRow {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string) ?? '',
    phone: (row.phone as string) ?? '',
    address: (row.address as string) ?? '',
    city: (row.city as string) ?? '',
    state: (row.state as string) ?? '',
    pincode: (row.pincode as string) ?? '',
    loyaltyPoints: Number(row.loyalty_points ?? 0),
    creditLimit: Number(row.credit_limit ?? 0),
    outstandingBalance: Number(row.outstanding_balance ?? 0),
    status: row.status as CustomerRow['status'],
    totalPurchases: Number(row.total_purchases ?? 0),
    lastPurchaseDate: (row.last_purchase_date as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function getAll(): Promise<CustomerRow[]> {
  const result = await query<Record<string, unknown>>(
    `${CUSTOMER_SELECT_SQL} ORDER BY c.name COLLATE NOCASE`
  )
  return result.rows.map(toCustomerRow)
}

export async function getById(id: string): Promise<CustomerRow | null> {
  const result = await query<Record<string, unknown>>(
    `${CUSTOMER_SELECT_SQL} WHERE c.id = ?`,
    [id]
  )
  return result.rows[0] ? toCustomerRow(result.rows[0]) : null
}

export async function getByName(name: string): Promise<CustomerRow | null> {
  const result = await query<Record<string, unknown>>(
    `${CUSTOMER_SELECT_SQL} WHERE LOWER(c.name) = LOWER(?)`,
    [name]
  )
  return result.rows[0] ? toCustomerRow(result.rows[0]) : null
}

export async function create(input: CreateCustomerInput): Promise<CustomerRow> {
  const id = crypto.randomUUID()
  await query<Record<string, unknown>>(
    `INSERT INTO customers (id, name, email, phone, address, city, state, pincode, credit_limit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      id,
      input.name,
      input.email ?? '',
      input.phone ?? '',
      input.address ?? '',
      input.city ?? '',
      input.state ?? '',
      input.pincode ?? '',
      input.creditLimit ?? 0,
    ]
  )
  return (await getById(id))!
}

export async function update(id: string, input: UpdateCustomerInput): Promise<CustomerRow | null> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name) }
  if (input.email !== undefined) { fields.push('email = ?'); values.push(input.email) }
  if (input.phone !== undefined) { fields.push('phone = ?'); values.push(input.phone) }
  if (input.address !== undefined) { fields.push('address = ?'); values.push(input.address) }
  if (input.city !== undefined) { fields.push('city = ?'); values.push(input.city) }
  if (input.state !== undefined) { fields.push('state = ?'); values.push(input.state) }
  if (input.pincode !== undefined) { fields.push('pincode = ?'); values.push(input.pincode) }
  if (input.creditLimit !== undefined) { fields.push('credit_limit = ?'); values.push(input.creditLimit) }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status) }

  if (fields.length === 0) return getById(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  await run(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values)
  return getById(id)
}

export async function remove(id: string): Promise<boolean> {
  const result = await run('DELETE FROM customers WHERE id = ?', [id])
  return result.changes > 0
}
