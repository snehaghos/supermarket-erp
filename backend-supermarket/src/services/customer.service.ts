import { AppError } from '../middleware/errorHandler'
import * as customerRepository from '../repositories/customer.repository'
import type { CustomerRow } from '../modules/customers/customer.model'
import type { CreateCustomerInput, UpdateCustomerInput } from '../modules/customers/customer.validation'

export async function getCustomerOrThrow(id: string): Promise<CustomerRow> {
  const customer = await customerRepository.getById(id)
  if (!customer) {
    throw new AppError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND')
  }
  return customer
}

export async function ensureUniqueName(name: string, excludeId?: string): Promise<void> {
  const existing = await customerRepository.getByName(name)
  if (existing && existing.id !== excludeId) {
    throw new AppError(409, 'A customer with this name already exists', 'DUPLICATE_CUSTOMER_NAME')
  }
}

export async function getAll(): Promise<CustomerRow[]> {
  return customerRepository.getAll()
}

export async function create(input: CreateCustomerInput): Promise<CustomerRow> {
  await ensureUniqueName(input.name)
  return customerRepository.create(input)
}

export async function update(id: string, input: UpdateCustomerInput): Promise<CustomerRow> {
  await getCustomerOrThrow(id)
  if (input.name) {
    await ensureUniqueName(input.name, id)
  }
  const updated = await customerRepository.update(id, input)
  if (!updated) {
    throw new AppError(500, 'Failed to update customer', 'UPDATE_FAILED')
  }
  return updated
}

export async function remove(id: string): Promise<void> {
  await getCustomerOrThrow(id)
  try {
    const deleted = await customerRepository.remove(id)
    if (!deleted) {
      throw new AppError(500, 'Failed to delete customer', 'DELETE_FAILED')
    }
  } catch (err: any) {
    if (err?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || err?.code === 'SQLITE_CONSTRAINT') {
      throw new AppError(
        409,
        'This customer has sales history and cannot be deleted',
        'CUSTOMER_IN_USE'
      )
    }
    throw err
  }
}
