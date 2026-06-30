import type { ConversionRow, ConversionStep, CreateConversionInput, UpdateConversionInput } from './conversion.validation'
import * as conversionModel from './conversion.model'
import { findById as findUnitById } from '../units/unit.model'
import { AppError } from '../../middleware/errorHandler'

export async function getAll(): Promise<ConversionRow[]> {
  return conversionModel.findAll()
}

export async function getById(id: string): Promise<ConversionRow> {
  const conversion = await conversionModel.findById(id)
  if (!conversion) {
    throw new AppError(404, 'Conversion not found', 'CONVERSION_NOT_FOUND')
  }
  return conversion
}

export async function create(input: CreateConversionInput): Promise<ConversionRow> {
  // Validate that parent and child units exist
  const [parent, child] = await Promise.all([
    findUnitById(input.parentUnitId),
    findUnitById(input.childUnitId),
  ])

  if (!parent) {
    throw new AppError(404, 'Parent unit not found', 'PARENT_UNIT_NOT_FOUND')
  }
  if (!child) {
    throw new AppError(404, 'Child unit not found', 'CHILD_UNIT_NOT_FOUND')
  }

  if (input.parentUnitId === input.childUnitId) {
    throw new AppError(400, 'Parent and child units must be different', 'SAME_UNIT')
  }

  return conversionModel.create(input)
}

export async function update(id: string, input: UpdateConversionInput): Promise<ConversionRow> {
  const existing = await conversionModel.findById(id)
  if (!existing) {
    throw new AppError(404, 'Conversion not found', 'CONVERSION_NOT_FOUND')
  }

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

  const updated = await conversionModel.update(id, input)
  if (!updated) {
    throw new AppError(500, 'Failed to update conversion', 'UPDATE_FAILED')
  }
  return updated
}

export async function remove(id: string): Promise<void> {
  const existing = await conversionModel.findById(id)
  if (!existing) {
    throw new AppError(404, 'Conversion not found', 'CONVERSION_NOT_FOUND')
  }

  const deleted = await conversionModel.remove(id)
  if (!deleted) {
    throw new AppError(500, 'Failed to delete conversion', 'DELETE_FAILED')
  }
}

export async function getPreview(quantity: number, unitId: string): Promise<ConversionStep[]> {
  const unit = await findUnitById(unitId)
  if (!unit) {
    throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND')
  }

  const steps = await conversionModel.preview(quantity, unitId)
  return steps
}
