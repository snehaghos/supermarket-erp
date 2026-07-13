import type { Request, Response } from 'express'
import * as conversionService from '../services/conversion.service'
import type { CreateConversionInput, UpdateConversionInput } from '../modules/conversions/conversion.validation'

export async function getAll(_req: Request, res: Response): Promise<void> {
  const conversions = await conversionService.getAll()
  res.json(conversions)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const conversion = await conversionService.getConversionOrThrow(req.params.id!)
  res.json(conversion)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateConversionInput
  const conversion = await conversionService.create(input)
  res.status(201).json(conversion)
}

export async function preview(req: Request, res: Response): Promise<void> {
  const { quantity, unitId } = req.body as { quantity: number; unitId: string }
  const steps = await conversionService.getConversionPreview(quantity, unitId)
  res.json({ steps })
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  const input = req.body as UpdateConversionInput
  const conversion = await conversionService.update(id, input)
  res.json(conversion)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  await conversionService.remove(id)
  res.status(204).send()
}
