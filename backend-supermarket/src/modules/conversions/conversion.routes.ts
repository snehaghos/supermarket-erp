import { Router } from 'express'
import * as conversionController from './conversion.controller'
import { validate } from '../../middleware/validate'
import { createConversionSchema, updateConversionSchema, previewConversionSchema } from './conversion.validation'

const router = Router()

// Preview must come BEFORE :id to avoid route conflict
router.post('/preview', validate(previewConversionSchema), conversionController.preview)

router.get('/', conversionController.getAll)
router.get('/:id', conversionController.getById)
router.post('/', validate(createConversionSchema), conversionController.create)
router.patch('/:id', validate(updateConversionSchema), conversionController.update)
router.delete('/:id', conversionController.remove)

export default router
