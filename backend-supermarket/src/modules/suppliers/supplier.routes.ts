import { Router } from 'express'
import * as supplierController from '../../controllers/supplier.controller'
import { validate } from '../../middleware/validate'
import { createSupplierSchema, updateSupplierSchema } from './supplier.validation'

const router = Router()

router.get('/', supplierController.getAll)
router.get('/:id', supplierController.getById)
router.post('/', validate(createSupplierSchema), supplierController.create)
router.patch('/:id', validate(updateSupplierSchema), supplierController.update)
router.delete('/:id', supplierController.remove)

export default router
