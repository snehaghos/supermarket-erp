import { AppError } from '../middleware/errorHandler'
import * as supplierRepository from '../repositories/supplier.repository'
import type { SupplierRow } from '../modules/suppliers/supplier.model'
import type { CreateSupplierInput, UpdateSupplierInput } from '../modules/suppliers/supplier.validation'

export async function getSupplierOrThrow(id: string): Promise<SupplierRow> {
  const supplier = await supplierRepository.getById(id)
  if (!supplier) {
    throw new AppError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND')
  }
  return supplier
}

export async function ensureUniqueName(name: string, excludeId?: string): Promise<void> {
  const existing = await supplierRepository.getByName(name)
  if (existing && existing.id !== excludeId) {
    throw new AppError(409, 'A supplier with this name already exists', 'DUPLICATE_SUPPLIER_NAME')
  }
}

export async function getAll(): Promise<SupplierRow[]> {
  return supplierRepository.getAll()
}

export async function create(input: CreateSupplierInput): Promise<SupplierRow> {
  await ensureUniqueName(input.name)
  return supplierRepository.create(input)
}

export async function update(id: string, input: UpdateSupplierInput): Promise<SupplierRow> {
  await getSupplierOrThrow(id)
  if (input.name) {
    await ensureUniqueName(input.name, id)
  }
  const updated = await supplierRepository.update(id, input)
  if (!updated) {
    throw new AppError(500, 'Failed to update supplier', 'UPDATE_FAILED')
  }
  return updated
}

export async function remove(id: string): Promise<void> {
  await getSupplierOrThrow(id)
  try {
    const deleted = await supplierRepository.remove(id)
    if (!deleted) {
      throw new AppError(500, 'Failed to delete supplier', 'DELETE_FAILED')
    }
  } catch (err: any) {
    if (err?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || err?.code === 'SQLITE_CONSTRAINT') {
      throw new AppError(
        409,
        'This supplier has purchase history and cannot be deleted',
        'SUPPLIER_IN_USE'
      )
    }
    throw err
  }
}
