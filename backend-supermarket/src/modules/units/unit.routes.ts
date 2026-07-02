import { Router } from 'express'
import * as unitController from '../../controllers/unit.controller'
import { validate } from '../../middleware/validate'
import { createUnitSchema, updateUnitSchema } from './unit.validation'

const router = Router()

router.get('/', unitController.getAll)
router.get('/:id', unitController.getById)
router.post('/', validate(createUnitSchema), unitController.create)
router.patch('/:id', validate(updateUnitSchema), unitController.update)
router.delete('/:id', unitController.remove)

export default router
