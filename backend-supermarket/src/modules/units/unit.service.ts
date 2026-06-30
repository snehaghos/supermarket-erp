import type { CreateUnitInput, UpdateUnitInput, UnitRow } from './unit.validation'
import * as unitModel from './unit.model'
import { AppError } from '../../middleware/errorHandler'

export async function getAll(): Promise<UnitRow[]> {
  return unitModel.findAll()
}

export async function getById(id: string): Promise<UnitRow> {
  const unit = await unitModel.findById(id)
  if (!unit) {
    throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND')
  }
  return unit
}

export async function create(input: CreateUnitInput): Promise<UnitRow> {
  // Check for duplicate name
  const existing = await unitModel.findByName(input.name)
  if (existing) {
    throw new AppError(409, 'A unit with this name already exists', 'DUPLICATE_UNIT_NAME')
  }

  return unitModel.create(input)
}

export async function update(id: string, input: UpdateUnitInput): Promise<UnitRow> {
  // Verify unit exists
  const existing = await unitModel.findById(id)
  if (!existing) {
    throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND')
  }

  // Check name uniqueness if name is being changed
  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await unitModel.findByName(input.name)
    if (duplicate) {
      throw new AppError(409, 'A unit with this name already exists', 'DUPLICATE_UNIT_NAME')
    }
  }

  const updated = await unitModel.update(id, input)
  if (!updated) {
    throw new AppError(500, 'Failed to update unit', 'UPDATE_FAILED')
  }
  return updated
}

export async function remove(id: string): Promise<void> {
  const existing = await unitModel.findById(id)
  if (!existing) {
    throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND')
  }

  const deleted = await unitModel.remove(id)
  if (!deleted) {
    throw new AppError(500, 'Failed to delete unit', 'DELETE_FAILED')
  }
}
