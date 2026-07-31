import type { Request, Response } from 'express'
import * as measurementTypeService from '../services/measurementType.service'
import { AppError } from '../middleware/errorHandler'

export async function getAll(_req: Request, res: Response): Promise<void> {
  const types = await measurementTypeService.getAll()
  res.json(types)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const type = await measurementTypeService.getById(req.params.id!)
  if (!type) {
    throw new AppError(404, 'Measurement type not found', 'NOT_FOUND')
  }
  res.json(type)
}
