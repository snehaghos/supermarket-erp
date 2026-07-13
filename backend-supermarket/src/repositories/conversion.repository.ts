import crypto from 'node:crypto'
import { query, run } from '../db'
import type { ConversionRow } from '../modules/conversions/conversion.model'
import type { CreateConversionInput, UpdateConversionInput } from '../modules/conversions/conversion.validation'

interface ConversionJoinRow {
  id: string
  parent_unit_id: string
  child_unit_id: string
  factor: string
  parent_unit_name: string
  parent_unit_symbol: string
  child_unit_name: string
  child_unit_symbol: string
  created_at: string
}

const CONVERSION_LIST_SQL = `
  SELECT c.id, c.parent_unit_id, c.child_unit_id, c.factor,
         p.name AS parent_unit_name, p.symbol AS parent_unit_symbol,
         ch.name AS child_unit_name, ch.symbol AS child_unit_symbol,
         c.created_at
  FROM conversions c
  JOIN units p ON p.id = c.parent_unit_id
  JOIN units ch ON ch.id = c.child_unit_id
`

function toConversionRow(row: ConversionJoinRow): ConversionRow {
  return {
    id: row.id,
    parentUnitId: row.parent_unit_id,
    childUnitId: row.child_unit_id,
    factor: Number(row.factor),
    parentUnitName: row.parent_unit_name,
    parentUnitSymbol: row.parent_unit_symbol,
    childUnitName: row.child_unit_name,
    childUnitSymbol: row.child_unit_symbol,
    createdAt: row.created_at,
  }
}

export async function getAll(): Promise<ConversionRow[]> {
  const result = await query<ConversionJoinRow>(`${CONVERSION_LIST_SQL} ORDER BY c.created_at DESC`)
  return result.rows.map(toConversionRow)
}

export async function getById(id: string): Promise<ConversionRow | null> {
  const result = await query<ConversionJoinRow>(`${CONVERSION_LIST_SQL} WHERE c.id = ?`, [id])
  return result.rows[0] ? toConversionRow(result.rows[0]) : null
}

export async function create(input: CreateConversionInput): Promise<ConversionRow> {
  const id = crypto.randomUUID()
  await query<ConversionJoinRow>(
    `INSERT INTO conversions (id, parent_unit_id, child_unit_id, factor) VALUES (?, ?, ?, ?) RETURNING *`,
    [id, input.parentUnitId, input.childUnitId, input.factor]
  )
  return (await getById(id))!
}

export async function update(id: string, input: UpdateConversionInput): Promise<ConversionRow | null> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.parentUnitId !== undefined) { fields.push('parent_unit_id = ?'); values.push(input.parentUnitId) }
  if (input.childUnitId !== undefined) { fields.push('child_unit_id = ?'); values.push(input.childUnitId) }
  if (input.factor !== undefined) { fields.push('factor = ?'); values.push(input.factor) }

  if (fields.length === 0) return getById(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  await run(`UPDATE conversions SET ${fields.join(', ')} WHERE id = ?`, values)
  return getById(id)
}

export async function remove(id: string): Promise<boolean> {
  const result = await run('DELETE FROM conversions WHERE id = ?', [id])
  return result.changes > 0
}

export async function getByParentId(parentId: string): Promise<{ childUnitId: string; factor: number } | null> {
  const result = await query<{ child_unit_id: string; factor: string }>(
    'SELECT child_unit_id, factor FROM conversions WHERE parent_unit_id = ? LIMIT 1', [parentId]
  )
  if (!result.rows[0]) return null
  return { childUnitId: result.rows[0].child_unit_id, factor: Number(result.rows[0].factor) }
}
