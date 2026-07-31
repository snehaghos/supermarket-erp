import { AppError } from '../middleware/errorHandler'
import * as unitRepository from '../repositories/unit.repository'
import type { UnitRow } from '../modules/units/unit.model'
import type { CreateUnitInput, UpdateUnitInput } from '../modules/units/unit.validation'

export async function getUnitOrThrow(id: string): Promise<UnitRow> {
  const unit = await unitRepository.getById(id)
  if (!unit) {
    throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND')
  }
  return unit
}

export async function ensureUniqueName(name: string, excludeId?: string): Promise<void> {
  const existing = await unitRepository.getByName(name)
  if (existing && existing.id !== excludeId) {
    throw new AppError(409, 'A unit with this name already exists', 'DUPLICATE_UNIT_NAME')
  }
}

export async function getAll(): Promise<UnitRow[]> {
  return unitRepository.getAll()
}

export async function getByMeasurementType(measurementTypeId: string): Promise<UnitRow[]> {
  return unitRepository.getByMeasurementType(measurementTypeId)
}

export async function create(input: CreateUnitInput): Promise<UnitRow> {
  await ensureUniqueName(input.name)
  return unitRepository.create(input)
}

export async function update(id: string, input: UpdateUnitInput): Promise<UnitRow> {
  await getUnitOrThrow(id)
  if (input.name) {
    await ensureUniqueName(input.name, id)
  }
  const updated = await unitRepository.update(id, input)
  if (!updated) {
    throw new AppError(500, 'Failed to update unit', 'UPDATE_FAILED')
  }
  return updated
}

export async function remove(id: string): Promise<void> {
  await getUnitOrThrow(id)
  const deleted = await unitRepository.remove(id)
  if (!deleted) {
    throw new AppError(500, 'Failed to delete unit', 'DELETE_FAILED')
  }
}
