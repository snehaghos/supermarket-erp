import { Router } from 'express'
import * as measurementTypeController from '../../controllers/measurementType.controller'

const router = Router()

router.get('/', measurementTypeController.getAll)
router.get('/:id', measurementTypeController.getById)

export default router
