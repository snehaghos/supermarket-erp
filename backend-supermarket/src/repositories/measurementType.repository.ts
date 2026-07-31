import { query } from '../db'
import type { MeasurementTypeRow } from '../modules/units/unit.model'

function toRow(row: Record<string, unknown>): MeasurementTypeRow {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at as string,
  }
}

export async function getAll(): Promise<MeasurementTypeRow[]> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM measurement_types ORDER BY sort_order ASC'
  )
  return result.rows.map(toRow)
}

export async function getById(id: string): Promise<MeasurementTypeRow | null> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM measurement_types WHERE id = ?', [id]
  )
  return result.rows[0] ? toRow(result.rows[0]) : null
}
