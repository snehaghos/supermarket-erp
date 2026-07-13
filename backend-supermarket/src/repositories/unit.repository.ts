import crypto from 'node:crypto'
import { query, run } from '../db'
import type { UnitRow } from '../modules/units/unit.model'
import type { CreateUnitInput, UpdateUnitInput } from '../modules/units/unit.validation'

function toUnitRow(row: Record<string, unknown>): UnitRow {
  return {
    id: row.id as string,
    name: row.name as string,
    symbol: row.symbol as string,
    type: row.type as UnitRow['type'],
    status: row.status as UnitRow['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function getAll(): Promise<UnitRow[]> {
  const result = await query<Record<string, unknown>>('SELECT * FROM units ORDER BY created_at DESC')
  return result.rows.map(toUnitRow)
}

export async function getById(id: string): Promise<UnitRow | null> {
  const result = await query<Record<string, unknown>>('SELECT * FROM units WHERE id = ?', [id])
  return result.rows[0] ? toUnitRow(result.rows[0]) : null
}

export async function getByName(name: string): Promise<UnitRow | null> {
  const result = await query<Record<string, unknown>>('SELECT * FROM units WHERE LOWER(name) = LOWER(?)', [name])
  return result.rows[0] ? toUnitRow(result.rows[0]) : null
}

export async function create(input: CreateUnitInput): Promise<UnitRow> {
  const id = crypto.randomUUID()
  const result = await query<Record<string, unknown>>(
    `INSERT INTO units (id, name, symbol, type) VALUES (?, ?, ?, ?) RETURNING *`,
    [id, input.name, input.symbol, input.type]
  )
  return toUnitRow(result.rows[0]!)
}

export async function update(id: string, input: UpdateUnitInput): Promise<UnitRow | null> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name) }
  if (input.symbol !== undefined) { fields.push('symbol = ?'); values.push(input.symbol) }
  if (input.type !== undefined) { fields.push('type = ?'); values.push(input.type) }

  if (fields.length === 0) return getById(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  const result = await query<Record<string, unknown>>(
    `UPDATE units SET ${fields.join(', ')} WHERE id = ? RETURNING *`, values
  )
  return result.rows[0] ? toUnitRow(result.rows[0]) : null
}

export async function remove(id: string): Promise<boolean> {
  const result = await run('DELETE FROM units WHERE id = ?', [id])
  return result.changes > 0
}
