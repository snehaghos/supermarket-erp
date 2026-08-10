import { Router } from 'express'
import * as productController from '../../controllers/product.controller'
import { validate } from '../../middleware/validate'
import {
  createProductSchema,
  updateProductSchema,
  purchaseStockSchema,
  sellStockSchema,
  adjustStockSchema,
  returnStockSchema,
  createProductConversionSchema,
  updateProductConversionSchema,
} from './product.validation'

const router = Router()

// Product CRUD
router.get('/', productController.getAll)
router.get('/:id', productController.getById)
router.post('/', validate(createProductSchema), productController.create)
router.patch('/:id', validate(updateProductSchema), productController.update)
router.delete('/:id', productController.remove)

// Inventory operations
router.post('/stock/purchase', validate(purchaseStockSchema), productController.purchaseStock)
router.post('/stock/sell', validate(sellStockSchema), productController.sellStock)
router.post('/stock/adjust', validate(adjustStockSchema), productController.adjustStock)
router.post('/stock/return', validate(returnStockSchema), productController.returnStock)
router.post('/stock/validate', productController.validateStock)

// Display
router.get('/:id/stock/display', productController.getDisplayStock)

// Transactions
router.get('/transactions/all', productController.getTransactions)

// Purchase Orders
router.get('/purchases/list', productController.getPurchases)
router.get('/purchases/:id', productController.getPurchaseById)

// Sales Orders
router.get('/sales/list', productController.getSales)
router.get('/sales/:id', productController.getSaleById)

// Product-specific conversions
router.get('/:productId/conversions', productController.getProductConversions)
router.post('/:productId/conversions', validate(createProductConversionSchema), productController.createProductConversion)
router.patch('/conversions/:id', validate(updateProductConversionSchema), productController.updateProductConversion)
router.delete('/conversions/:id', productController.deleteProductConversion)

export default router
