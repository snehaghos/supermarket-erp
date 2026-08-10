import type { Request, Response } from 'express'
import * as customerService from '../services/customer.service'
import type { CreateCustomerInput, UpdateCustomerInput } from '../modules/customers/customer.validation'

export async function getAll(_req: Request, res: Response): Promise<void> {
  const customers = await customerService.getAll()
  res.json(customers)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const customer = await customerService.getCustomerOrThrow(req.params.id!)
  res.json(customer)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateCustomerInput
  const customer = await customerService.create(input)
  res.status(201).json(customer)
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  const input = req.body as UpdateCustomerInput
  const customer = await customerService.update(id, input)
  res.json(customer)
}

export async function remove(req: Request, res: Response): Promise<void> {
  await customerService.remove(req.params.id!)
  res.status(204).send()
}
