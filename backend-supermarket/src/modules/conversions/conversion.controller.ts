import type { Request, Response } from 'express'
import * as conversionService from './conversion.service'

export async function getAll(_req: Request, res: Response): Promise<void> {
  const conversions = await conversionService.getAll()
  res.json(conversions)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const conversion = await conversionService.getById(req.params.id!)
  res.json(conversion)
}

export async function create(req: Request, res: Response): Promise<void> {
  const conversion = await conversionService.create(req.body)
  res.status(201).json(conversion)
}

export async function preview(req: Request, res: Response): Promise<void> {
  const steps = await conversionService.getPreview(req.body.quantity, req.body.unitId)
  res.json({ steps })
}

export async function update(req: Request, res: Response): Promise<void> {
  const conversion = await conversionService.update(req.params.id!, req.body)
  res.json(conversion)
}

export async function remove(req: Request, res: Response): Promise<void> {
  await conversionService.remove(req.params.id!)
  res.status(204).send()
}
