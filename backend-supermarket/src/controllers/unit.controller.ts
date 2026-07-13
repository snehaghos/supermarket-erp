import type { Request, Response } from 'express'
import * as unitService from '../services/unit.service'
import type { CreateUnitInput, UpdateUnitInput } from '../modules/units/unit.validation'

export async function getAll(_req: Request, res: Response): Promise<void> {
  const units = await unitService.getAll()
  res.json(units)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const unit = await unitService.getUnitOrThrow(req.params.id!)
  res.json(unit)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateUnitInput
  const unit = await unitService.create(input)
  res.status(201).json(unit)
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  const input = req.body as UpdateUnitInput
  const unit = await unitService.update(id, input)
  res.json(unit)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  await unitService.remove(id)
  res.status(204).send()
}
