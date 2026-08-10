import type { Request, Response } from 'express'
import * as supplierService from '../services/supplier.service'
import type { CreateSupplierInput, UpdateSupplierInput } from '../modules/suppliers/supplier.validation'

export async function getAll(_req: Request, res: Response): Promise<void> {
  const suppliers = await supplierService.getAll()
  res.json(suppliers)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const supplier = await supplierService.getSupplierOrThrow(req.params.id!)
  res.json(supplier)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateSupplierInput
  const supplier = await supplierService.create(input)
  res.status(201).json(supplier)
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  const input = req.body as UpdateSupplierInput
  const supplier = await supplierService.update(id, input)
  res.json(supplier)
}

export async function remove(req: Request, res: Response): Promise<void> {
  await supplierService.remove(req.params.id!)
  res.status(204).send()
}
