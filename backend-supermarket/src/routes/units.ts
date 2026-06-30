import { Router, type Request, type Response } from 'express'
import { getAllUnits, getUnitById, createUnit, updateUnit, deleteUnit } from '../data/units'

const router = Router()

// GET /api/units
router.get('/', (_req: Request, res: Response) => {
  const units = getAllUnits()
  res.json(units)
})

// GET /api/units/:id
router.get('/:id', (req: Request, res: Response) => {
  const unit = getUnitById(req.params.id!)
  if (!unit) {
    res.status(404).json({ error: 'Unit not found' })
    return
  }
  res.json(unit)
})

// POST /api/units
router.post('/', (req: Request, res: Response) => {
  const { name, symbol, type } = req.body
  if (!name || !symbol || !type) {
    res.status(400).json({ error: 'Name, symbol, and type are required' })
    return
  }

  // Check for duplicate name
  const existing = getAllUnits().find(
    (u) => u.name.toLowerCase() === (name as string).toLowerCase()
  )
  if (existing) {
    res.status(409).json({ error: 'A unit with this name already exists' })
    return
  }

  const unit = createUnit({ name, symbol, type })
  res.status(201).json(unit)
})

// PATCH /api/units/:id
router.patch('/:id', (req: Request, res: Response) => {
  const updated = updateUnit(req.params.id!, req.body)
  if (!updated) {
    res.status(404).json({ error: 'Unit not found' })
    return
  }
  res.json(updated)
})

// DELETE /api/units/:id
router.delete('/:id', (req: Request, res: Response) => {
  const deleted = deleteUnit(req.params.id!)
  if (!deleted) {
    res.status(404).json({ error: 'Unit not found' })
    return
  }
  res.status(204).send()
})

export default router
