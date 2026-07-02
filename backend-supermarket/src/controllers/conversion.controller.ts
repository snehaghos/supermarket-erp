import type { Request, Response } from 'express'
import { query } from '../db'
import { AppError } from '../middleware/errorHandler'
import type { ConversionRow, ConversionStep } from '../modules/conversions/conversion.model'
import type { CreateConversionInput, UpdateConversionInput } from '../modules/conversions/conversion.validation'

// ── Helpers ───────────────────────────────────────────────────────

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

const toConversionRow = (row: ConversionDbRow): ConversionRow => ({
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

const CONVERSION_JOIN_SQL = `
  SELECT
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
`

// ── Repository (SQL queries) ──────────────────────────────────────

async function findAll(): Promise<ConversionRow[]> {
  const result = await query<ConversionDbRow>(
    `${CONVERSION_JOIN_SQL} ORDER BY c.created_at DESC`
  )
  return result.rows.map(toConversionRow)
}

async function findById(id: string): Promise<ConversionRow | null> {
  const result = await query<ConversionDbRow>(
    `${CONVERSION_JOIN_SQL} WHERE c.id = $1`,
    [id]
  )
  return result.rows[0] ? toConversionRow(result.rows[0]) : null
}

async function findUnitById(id: string): Promise<{ id: string; name: string; symbol: string } | null> {
  const result = await query<{ id: string; name: string; symbol: string }>(
    'SELECT id, name, symbol FROM units WHERE id = $1',
    [id]
  )
  return result.rows[0] ?? null
}

async function createConversion(input: CreateConversionInput): Promise<ConversionRow> {
  const result = await query<ConversionDbRow>(
    `INSERT INTO conversions (parent_unit_id, child_unit_id, factor)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.parentUnitId, input.childUnitId, input.factor]
  )

  return findById(result.rows[0]!.id) as Promise<ConversionRow>
}

async function updateConversion(id: string, input: UpdateConversionInput): Promise<ConversionRow | null> {
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

async function removeConversion(id: string): Promise<boolean> {
  const result = await query('DELETE FROM conversions WHERE id = $1', [id])
  return (result.rowCount ?? 0) > 0
}

async function getConversionPreview(quantity: number, unitId: string): Promise<ConversionStep[]> {
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

// ── Business Logic ────────────────────────────────────────────────

async function getOrThrow(id: string): Promise<ConversionRow> {
  const conversion = await findById(id)
  if (!conversion) {
    throw new AppError(404, 'Conversion not found', 'CONVERSION_NOT_FOUND')
  }
  return conversion
}

async function validateUnits(parentUnitId: string, childUnitId: string): Promise<void> {
  const [parent, child] = await Promise.all([
    findUnitById(parentUnitId),
    findUnitById(childUnitId),
  ])

  if (!parent) {
    throw new AppError(404, 'Parent unit not found', 'PARENT_UNIT_NOT_FOUND')
  }
  if (!child) {
    throw new AppError(404, 'Child unit not found', 'CHILD_UNIT_NOT_FOUND')
  }

  if (parentUnitId === childUnitId) {
    throw new AppError(400, 'Parent and child units must be different', 'SAME_UNIT')
  }
}

// ── HTTP Handlers ─────────────────────────────────────────────────

export async function getAll(_req: Request, res: Response): Promise<void> {
  const conversions = await findAll()
  res.json(conversions)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const conversion = await getOrThrow(req.params.id!)
  res.json(conversion)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateConversionInput
  await validateUnits(input.parentUnitId, input.childUnitId)
  const conversion = await createConversion(input)
  res.status(201).json(conversion)
}

export async function preview(req: Request, res: Response): Promise<void> {
  const { quantity, unitId } = req.body as { quantity: number; unitId: string }

  const unit = await findUnitById(unitId)
  if (!unit) {
    throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND')
  }

  const steps = await getConversionPreview(quantity, unitId)
  res.json({ steps })
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  const input = req.body as UpdateConversionInput

  await getOrThrow(id)

  // Validate units if provided
  if (input.parentUnitId) {
    const parent = await findUnitById(input.parentUnitId)
    if (!parent) {
      throw new AppError(404, 'Parent unit not found', 'PARENT_UNIT_NOT_FOUND')
    }
  }
  if (input.childUnitId) {
    const child = await findUnitById(input.childUnitId)
    if (!child) {
      throw new AppError(404, 'Child unit not found', 'CHILD_UNIT_NOT_FOUND')
    }
  }

  const conversion = await updateConversion(id, input)
  if (!conversion) {
    throw new AppError(500, 'Failed to update conversion', 'UPDATE_FAILED')
  }
  res.json(conversion)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  await getOrThrow(id)

  const deleted = await removeConversion(id)
  if (!deleted) {
    throw new AppError(500, 'Failed to delete conversion', 'DELETE_FAILED')
  }
  res.status(204).send()
}
