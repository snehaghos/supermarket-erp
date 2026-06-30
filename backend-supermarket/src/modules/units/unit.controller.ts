import type { Request, Response } from 'express'
import * as unitService from './unit.service'

export async function getAll(_req: Request, res: Response): Promise<void> {
  const units = await unitService.getAll()
  res.json(units)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const unit = await unitService.getById(req.params.id!)
  res.json(unit)
}

export async function create(req: Request, res: Response): Promise<void> {
  const unit = await unitService.create(req.body)
  res.status(201).json(unit)
}

export async function update(req: Request, res: Response): Promise<void> {
  const unit = await unitService.update(req.params.id!, req.body)
  res.json(unit)
}

export async function remove(req: Request, res: Response): Promise<void> {
  await unitService.remove(req.params.id!)
  res.status(204).send()
}
