import { query } from '../../db'
import type { UnitRow, CreateUnitInput, UpdateUnitInput } from './unit.validation'

const rowMap = (row: Record<string, unknown>): UnitRow => ({
  id: row.id as string,
  name: row.name as string,
  symbol: row.symbol as string,
  type: row.type as UnitRow['type'],
  status: row.status as UnitRow['status'],
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
})

export async function findAll(): Promise<UnitRow[]> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM units ORDER BY created_at DESC'
  )
  return result.rows.map(rowMap)
}

export async function findById(id: string): Promise<UnitRow | null> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM units WHERE id = $1',
    [id]
  )
  return result.rows[0] ? rowMap(result.rows[0]) : null
}

export async function findByName(name: string): Promise<UnitRow | null> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM units WHERE LOWER(name) = LOWER($1)',
    [name]
  )
  return result.rows[0] ? rowMap(result.rows[0]) : null
}

export async function create(input: CreateUnitInput): Promise<UnitRow> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO units (name, symbol, type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.name, input.symbol, input.type]
  )
  return rowMap(result.rows[0]!)
}

export async function update(id: string, input: UpdateUnitInput): Promise<UnitRow | null> {
  // Build dynamic SET clause
  const fields: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (input.name !== undefined) {
    fields.push(`name = $${paramIndex++}`)
    values.push(input.name)
  }
  if (input.symbol !== undefined) {
    fields.push(`symbol = $${paramIndex++}`)
    values.push(input.symbol)
  }
  if (input.type !== undefined) {
    fields.push(`type = $${paramIndex++}`)
    values.push(input.type)
  }

  if (fields.length === 0) {
    return findById(id)
  }

  fields.push(`updated_at = NOW()`)
  values.push(id)

  const result = await query<Record<string, unknown>>(
    `UPDATE units SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  )
  return result.rows[0] ? rowMap(result.rows[0]) : null
}

export async function remove(id: string): Promise<boolean> {
  const result = await query('DELETE FROM units WHERE id = $1', [id])
  return (result.rowCount ?? 0) > 0
}
