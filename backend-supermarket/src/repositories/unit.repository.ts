import crypto from 'node:crypto'
import { query, run } from '../db'
import type { UnitRow } from '../modules/units/unit.model'
import type { CreateUnitInput, UpdateUnitInput } from '../modules/units/unit.validation'

const UNIT_SELECT_SQL = `
  SELECT u.*, mt.name AS measurement_type_name
  FROM units u
  LEFT JOIN measurement_types mt ON mt.id = u.measurement_type_id
`

function toUnitRow(row: Record<string, unknown>): UnitRow {
  return {
    id: row.id as string,
    name: row.name as string,
    symbol: row.symbol as string,
    measurementTypeId: row.measurement_type_id as string,
    measurementTypeName: row.measurement_type_name as string | undefined,
    type: (row.type as string) ?? '',
    isPackaging: Boolean(row.is_packaging),
    status: row.status as UnitRow['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function getAll(): Promise<UnitRow[]> {
  const result = await query<Record<string, unknown>>(
    `${UNIT_SELECT_SQL} ORDER BY mt.sort_order, u.name`
  )
  return result.rows.map(toUnitRow)
}

export async function getById(id: string): Promise<UnitRow | null> {
  const result = await query<Record<string, unknown>>(
    `${UNIT_SELECT_SQL} WHERE u.id = ?`, [id]
  )
  return result.rows[0] ? toUnitRow(result.rows[0]) : null
}

export async function getByName(name: string): Promise<UnitRow | null> {
  const result = await query<Record<string, unknown>>(
    `${UNIT_SELECT_SQL} WHERE LOWER(u.name) = LOWER(?)`, [name]
  )
  return result.rows[0] ? toUnitRow(result.rows[0]) : null
}

export async function getByMeasurementType(measurementTypeId: string): Promise<UnitRow[]> {
  const result = await query<Record<string, unknown>>(
    `${UNIT_SELECT_SQL} WHERE u.measurement_type_id = ? AND u.status = 'active' ORDER BY u.name`,
    [measurementTypeId]
  )
  return result.rows.map(toUnitRow)
}

export async function create(input: CreateUnitInput): Promise<UnitRow> {
  const id = crypto.randomUUID()
  const type = await getMeasurementTypeName(input.measurementTypeId)
  const result = await query<Record<string, unknown>>(
    `INSERT INTO units (id, name, symbol, measurement_type_id, type, is_packaging)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    [id, input.name, input.symbol, input.measurementTypeId, type, input.isPackaging ? 1 : 0]
  )
  return toUnitRow(result.rows[0]!)
}

export async function update(id: string, input: UpdateUnitInput): Promise<UnitRow | null> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name) }
  if (input.symbol !== undefined) { fields.push('symbol = ?'); values.push(input.symbol) }
  if (input.measurementTypeId !== undefined) {
    fields.push('measurement_type_id = ?')
    fields.push('type = ?')
    const type = await getMeasurementTypeName(input.measurementTypeId)
    values.push(input.measurementTypeId, type)
  }
  if (input.isPackaging !== undefined) { fields.push('is_packaging = ?'); values.push(input.isPackaging ? 1 : 0) }

  if (fields.length === 0) return getById(id)

  fields.push("updated_at = datetime('now')")
  values.push(id)

  const result = await query<Record<string, unknown>>(
    `UPDATE units SET ${fields.join(', ')} WHERE id = ? RETURNING *`, values
  )
  // Return the full row with measurement type name
  if (!result.rows[0]) return null
  return getById(id)
}

export async function remove(id: string): Promise<boolean> {
  const result = await run('DELETE FROM units WHERE id = ?', [id])
  return result.changes > 0
}

async function getMeasurementTypeName(measurementTypeId: string): Promise<string> {
  const result = await query<{ name: string }>(
    'SELECT name FROM measurement_types WHERE id = ?', [measurementTypeId]
  )
  return result.rows[0]?.name ?? ''
}
