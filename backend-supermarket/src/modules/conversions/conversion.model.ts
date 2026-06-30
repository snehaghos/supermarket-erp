import { query } from '../../db'
import type { ConversionRow, ConversionStep, CreateConversionInput, UpdateConversionInput } from './conversion.validation'

interface ConversionDbRow {
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

const rowMap = (row: ConversionDbRow): ConversionRow => ({
  id: row.id,
  parentUnitId: row.parent_unit_id,
  childUnitId: row.child_unit_id,
  factor: Number(row.factor),
  parentUnitName: row.parent_unit_name,
  parentUnitSymbol: row.parent_unit_symbol,
  childUnitName: row.child_unit_name,
  childUnitSymbol: row.child_unit_symbol,
  createdAt: row.created_at,
})

export async function findAll(): Promise<ConversionRow[]> {
  const result = await query<ConversionDbRow>(
    `SELECT
       c.id,
       c.parent_unit_id,
       c.child_unit_id,
       c.factor,
       p.name AS parent_unit_name,
       p.symbol AS parent_unit_symbol,
       ch.name AS child_unit_name,
       ch.symbol AS child_unit_symbol,
       c.created_at
     FROM conversions c
     JOIN units p ON p.id = c.parent_unit_id
     JOIN units ch ON ch.id = c.child_unit_id
     ORDER BY c.created_at DESC`
  )
  return result.rows.map(rowMap)
}

export async function findById(id: string): Promise<ConversionRow | null> {
  const result = await query<ConversionDbRow>(
    `SELECT
       c.id,
       c.parent_unit_id,
       c.child_unit_id,
       c.factor,
       p.name AS parent_unit_name,
       p.symbol AS parent_unit_symbol,
       ch.name AS child_unit_name,
       ch.symbol AS child_unit_symbol,
       c.created_at
     FROM conversions c
     JOIN units p ON p.id = c.parent_unit_id
     JOIN units ch ON ch.id = c.child_unit_id
     WHERE c.id = $1`,
    [id]
  )
  return result.rows[0] ? rowMap(result.rows[0]) : null
}

export async function create(input: CreateConversionInput): Promise<ConversionRow> {
  const result = await query<ConversionDbRow>(
    `INSERT INTO conversions (parent_unit_id, child_unit_id, factor)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.parentUnitId, input.childUnitId, input.factor]
  )

  // Fetch with joins
  return findById(result.rows[0]!.id) as Promise<ConversionRow>
}

export async function update(id: string, input: UpdateConversionInput): Promise<ConversionRow | null> {
  const fields: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (input.parentUnitId !== undefined) {
    fields.push(`parent_unit_id = $${paramIndex++}`)
    values.push(input.parentUnitId)
  }
  if (input.childUnitId !== undefined) {
    fields.push(`child_unit_id = $${paramIndex++}`)
    values.push(input.childUnitId)
  }
  if (input.factor !== undefined) {
    fields.push(`factor = $${paramIndex++}`)
    values.push(input.factor)
  }

  if (fields.length === 0) {
    return findById(id)
  }

  fields.push('updated_at = NOW()')
  values.push(id)

  await query<ConversionDbRow>(
    `UPDATE conversions SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  )

  return findById(id)
}

export async function remove(id: string): Promise<boolean> {
  const result = await query('DELETE FROM conversions WHERE id = $1', [id])
  return (result.rowCount ?? 0) > 0
}

export async function preview(quantity: number, unitId: string): Promise<ConversionStep[]> {
  const steps: ConversionStep[] = []

  // Get initial unit
  const unitResult = await query<{ id: string; name: string; symbol: string }>(
    'SELECT id, name, symbol FROM units WHERE id = $1',
    [unitId]
  )
  if (!unitResult.rows[0]) return steps

  steps.push({
    unitId: unitResult.rows[0].id,
    unitName: unitResult.rows[0].name,
    unitSymbol: unitResult.rows[0].symbol,
    quantity,
  })

  // Walk down the conversion chain (parent → child)
  let currentId = unitId
  let currentQty = quantity
  let maxIterations = 20

  while (maxIterations > 0) {
    maxIterations--

    const convResult = await query<{ child_unit_id: string; factor: string }>(
      'SELECT child_unit_id, factor FROM conversions WHERE parent_unit_id = $1 LIMIT 1',
      [currentId]
    )

    if (!convResult.rows[0]) break

    const conv = convResult.rows[0]
    currentQty = currentQty * Number(conv.factor)
    currentId = conv.child_unit_id

    const childResult = await query<{ id: string; name: string; symbol: string }>(
      'SELECT id, name, symbol FROM units WHERE id = $1',
      [currentId]
    )

    steps.push({
      unitId: currentId,
      unitName: childResult.rows[0]?.name ?? 'Unknown',
      unitSymbol: childResult.rows[0]?.symbol ?? '',
      quantity: currentQty,
    })
  }

  return steps
}
