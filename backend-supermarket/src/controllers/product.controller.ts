import type { Request, Response } from 'express'
import * as productService from '../services/product.service'
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateProductConversionInput,
  UpdateProductConversionInput,
  PurchaseStockInput,
  SellStockInput,
  AdjustStockInput,
  ReturnStockInput,
} from '../modules/products/product.validation'

// ── Product CRUD ─────────────────────────────────────────────────

export async function getAll(_req: Request, res: Response): Promise<void> {
  const products = await productService.getAll()
  res.json(products)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const product = await productService.getById(req.params.id!)
  res.json(product)
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateProductInput
  const product = await productService.create(input)
  res.status(201).json(product)
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = req.params.id!
  const input = req.body as UpdateProductInput
  const product = await productService.update(id, input)
  res.json(product)
}

export async function remove(req: Request, res: Response): Promise<void> {
  await productService.remove(req.params.id!)
  res.status(204).send()
}

// ── Inventory ────────────────────────────────────────────────────

export async function purchaseStock(req: Request, res: Response): Promise<void> {
  const input = req.body as PurchaseStockInput
  const result = await productService.purchaseStock(input)
  res.status(201).json(result)
}

export async function sellStock(req: Request, res: Response): Promise<void> {
  const input = req.body as SellStockInput
  const result = await productService.sellStock(input)
  res.status(201).json(result)
}

export async function adjustStock(req: Request, res: Response): Promise<void> {
  const input = req.body as AdjustStockInput
  const result = await productService.adjustStock(input)
  res.json(result)
}

export async function returnStock(req: Request, res: Response): Promise<void> {
  const input = req.body as ReturnStockInput
  const result = await productService.returnStock(input)
  res.status(201).json(result)
}

export async function validateStock(req: Request, res: Response): Promise<void> {
  const { productId, unitId, quantity } = req.body as { productId: string; unitId: string; quantity: number }
  const result = await productService.validateStockAvailability(productId, unitId, quantity)
  res.json(result)
}

export async function getDisplayStock(req: Request, res: Response): Promise<void> {
  const result = await productService.getDisplayStock(req.params.id!)
  res.json(result)
}

// ── Transactions ─────────────────────────────────────────────────

export async function getTransactions(req: Request, res: Response): Promise<void> {
  const productId = req.query.productId as string | undefined
  const limit = Number(req.query.limit) || 100
  const transactions = await productService.getTransactions(productId, limit)
  res.json(transactions)
}

// ── Purchase Orders ──────────────────────────────────────────────

export async function getPurchases(_req: Request, res: Response): Promise<void> {
  const purchases = await productService.getPurchases()
  res.json(purchases)
}

export async function getPurchaseById(req: Request, res: Response): Promise<void> {
  const purchase = await productService.getPurchaseById(req.params.id!)
  res.json(purchase)
}

// ── Sales Orders ─────────────────────────────────────────────────

export async function getSales(_req: Request, res: Response): Promise<void> {
  const sales = await productService.getSales()
  res.json(sales)
}

export async function getSaleById(req: Request, res: Response): Promise<void> {
  const sale = await productService.getSaleById(req.params.id!)
  res.json(sale)
}

// ── Product-specific Conversions ─────────────────────────────────

export async function getProductConversions(req: Request, res: Response): Promise<void> {
  const conversions = await productService.getProductConversions(req.params.productId!)
  res.json(conversions)
}

export async function createProductConversion(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateProductConversionInput
  const conversion = await productService.createProductConversion(req.params.productId!, input)
  res.status(201).json(conversion)
}

export async function updateProductConversion(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateProductConversionInput
  const conversion = await productService.updateProductConversion(req.params.id!, input)
  res.json(conversion)
}

export async function deleteProductConversion(req: Request, res: Response): Promise<void> {
  await productService.deleteProductConversion(req.params.id!)
  res.status(204).send()
}
