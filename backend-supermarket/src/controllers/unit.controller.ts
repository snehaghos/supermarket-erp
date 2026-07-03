import type { Request, Response } from 'express'
import { query } from '../db'
import { AppError } from '../middleware/errorHandler'
import type { UnitRow } from '../modules/units/unit.model'
import type { CreateUnitInput, UpdateUnitInput } from '../modules/units/unit.validation'

const toUnitRow = (row: Record<string, unknown>): UnitRow => ({
  id: row.id as string,
  name: row.name as string,
  symbol: row.symbol as string,
  type: row.type as UnitRow['type'],
  status: row.status as UnitRow['status'],
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
})

// ── Repository (SQL queries) ──────────────────────────────────────

async function findAll(): Promise<UnitRow[]> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM units ORDER BY created_at DESC'
  )
  return result.rows.map(toUnitRow)
}

async function findById(id: string): Promise<UnitRow | null> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM units WHERE id = $1',
    [id]
  )
  return result.rows[0] ? toUnitRow(result.rows[0]) : null
}

async function findByName(name: string): Promise<UnitRow | null> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM units WHERE LOWER(name) = LOWER($1)',
    [name]
  )
  return result.rows[0] ? toUnitRow(result.rows[0]) : null
}

async function createUnit(input: CreateUnitInput): Promise<UnitRow> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO units (name, symbol, type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.name, input.symbol, input.type]
  )
  return toUnitRow(result.rows[0]!)
}

async function updateUnit(id: string, input: UpdateUnitInput): Promise<UnitRow | null> {
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

  fields.push('updated_at = NOW()')
  values.push(id)

  const result = await query<Record<string, unknown>>(
    `UPDATE units SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  )
  return result.rows[0] ? toUnitRow(result.rows[0]) : null
}

async function removeUnit(id: string): Promise<boolean> {
  const result = await query('DELETE FROM units WHERE id = $1', [id])
  return (result.rowCount ?? 0) > 0
}

// ── Business Logic ────────────────────────────────────────────────

async function getOrThrow(id: string): Promise<UnitRow> {
  const unit = await findById(id)
  if (!unit) {
    throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND')
  }
  return unit
}

async function ensureUniqueName(name: string, excludeId?: string): Promise<void> {
  const existing = await findByName(name)
  if (existing && existing.id !== excludeId) {
    throw new AppError(409, 'A unit with this name already exists', 'DUPLICATE_UNIT_NAME')
  }
}

// ── HTTP Handlers ─────────────────────────────────────────────────

export async function getAll(_req: Request, res: Response): Promise<void> {
  const units = await findAll()
  res.json(units)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const unit = await getOrThrow(req.params.id!)
  res.json(unit)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateUnitInput
  await ensureUniqueName(input.name)
  const unit = await createUnit(input)
  res.status(201).json(unit)
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  const input = req.body as UpdateUnitInput

  await getOrThrow(id)

  if (input.name) {
    await ensureUniqueName(input.name, id)
  }

  const unit = await updateUnit(id, input)
  if (!unit) {
    throw new AppError(500, 'Failed to update unit', 'UPDATE_FAILED')
  }
  res.json(unit)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  await getOrThrow(id)

  const deleted = await removeUnit(id)
  if (!deleted) {
    throw new AppError(500, 'Failed to delete unit', 'DELETE_FAILED')
  }
  res.status(204).send()
}
