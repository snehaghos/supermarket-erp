import * as measurementTypeRepository from '../repositories/measurementType.repository'
import type { MeasurementTypeRow } from '../modules/units/unit.model'

export async function getAll(): Promise<MeasurementTypeRow[]> {
  return measurementTypeRepository.getAll()
}

export async function getById(id: string): Promise<MeasurementTypeRow | null> {
  return measurementTypeRepository.getById(id)
}
