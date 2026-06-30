import { Router, type Request, type Response } from 'express'
import {
  getAllConversions,
  getConversionById,
  createConversion,
  updateConversion,
  deleteConversion,
  previewConversion,
} from '../data/conversions'

const router = Router()

// GET /api/conversions
router.get('/', (_req: Request, res: Response) => {
  const conversions = getAllConversions()
  res.json(conversions)
})

// GET /api/conversions/:id
router.get('/:id', (req: Request, res: Response) => {
  const conversion = getConversionById(req.params.id!)
  if (!conversion) {
    res.status(404).json({ error: 'Conversion not found' })
    return
  }
  res.json(conversion)
})

// POST /api/conversions
router.post('/', (req: Request, res: Response) => {
  const { parentUnitId, childUnitId, factor } = req.body
  if (!parentUnitId || !childUnitId || factor === undefined) {
    res.status(400).json({ error: 'parentUnitId, childUnitId, and factor are required' })
    return
  }

  if (parentUnitId === childUnitId) {
    res.status(400).json({ error: 'Parent and child units must be different' })
    return
  }

  const conversion = createConversion({ parentUnitId, childUnitId, factor: Number(factor) })
  res.status(201).json(conversion)
})

// POST /api/conversions/preview
router.post('/preview', (req: Request, res: Response) => {
  const { quantity, unitId } = req.body
  if (quantity === undefined || !unitId) {
    res.status(400).json({ error: 'quantity and unitId are required' })
    return
  }

  const steps = previewConversion(Number(quantity), unitId)
  res.json({ steps })
})

// PATCH /api/conversions/:id
router.patch('/:id', (req: Request, res: Response) => {
  const updated = updateConversion(req.params.id!, req.body)
  if (!updated) {
    res.status(404).json({ error: 'Conversion not found' })
    return
  }
  res.json(updated)
})

// DELETE /api/conversions/:id
router.delete('/:id', (req: Request, res: Response) => {
  const deleted = deleteConversion(req.params.id!)
  if (!deleted) {
    res.status(404).json({ error: 'Conversion not found' })
    return
  }
  res.status(204).send()
})

export default router
