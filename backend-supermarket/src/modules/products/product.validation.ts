import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  category: z.string().max(100).default('General'),
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().max(100).default(''),
  brand: z.string().max(255).default(''),
  description: z.string().default(''),
  imageUrl: z.string().default(''),
  baseUnitId: z.string().uuid('Invalid base unit ID'),
  purchaseUnitId: z.string().uuid('Invalid purchase unit ID').optional().nullable(),
  sellingUnitId: z.string().uuid('Invalid selling unit ID').optional().nullable(),
  purchasePrice: z.number().min(0, 'Purchase price cannot be negative').default(0),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative').default(0),
  mrp: z.number().min(0, 'MRP cannot be negative').default(0),
  taxClass: z.string().default(''),
  minStock: z.number().min(0, 'Minimum stock cannot be negative').default(0),
  maxStock: z.number().min(0, 'Maximum stock cannot be negative').default(0),
  reorderLevel: z.number().min(0, 'Reorder level cannot be negative').default(0),
  openingStock: z.number().min(0, 'Opening stock cannot be negative').default(0),
  trackBatch: z.boolean().default(false),
  trackExpiry: z.boolean().default(false),
  trackSerialNumber: z.boolean().default(false),
  batchNumberFormat: z.string().default(''),
  manufacturingDateField: z.string().default(''),
  expiryDateField: z.string().default(''),
  serialNumberFormat: z.string().default(''),
  serialNumberValidation: z.string().default(''),
  additionalUnits: z.array(
    z.object({
      unitId: z.string().uuid('Invalid unit ID'),
      isPurchaseUnit: z.boolean().default(false),
      isSellingUnit: z.boolean().default(false),
    })
  ).optional().default([]),
  productConversions: z.array(
    z.object({
      fromUnitId: z.string().uuid('Invalid from unit ID'),
      toUnitId: z.string().uuid('Invalid to unit ID'),
      conversionFactor: z.number().positive('Conversion factor must be positive'),
    })
  ).optional().default([]),
  productImages: z.array(z.string()).optional().default([]),
})

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().max(100).optional(),
  sku: z.string().min(1).max(100).optional(),
  barcode: z.string().max(100).optional(),
  brand: z.string().max(255).optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  baseUnitId: z.string().uuid().optional(),
  purchaseUnitId: z.string().uuid().optional().nullable(),
  sellingUnitId: z.string().uuid().optional().nullable(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  mrp: z.number().min(0).optional(),
  taxClass: z.string().optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  trackBatch: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  trackSerialNumber: z.boolean().optional(),
  batchNumberFormat: z.string().optional(),
  manufacturingDateField: z.string().optional(),
  expiryDateField: z.string().optional(),
  serialNumberFormat: z.string().optional(),
  serialNumberValidation: z.string().optional(),
  additionalUnits: z.array(
    z.object({
      unitId: z.string().uuid('Invalid unit ID'),
      isPurchaseUnit: z.boolean().default(false),
      isSellingUnit: z.boolean().default(false),
    })
  ).optional(),
  productConversions: z.array(
    z.object({
      fromUnitId: z.string().uuid('Invalid from unit ID'),
      toUnitId: z.string().uuid('Invalid to unit ID'),
      conversionFactor: z.number().positive('Conversion factor must be positive'),
    })
  ).optional(),
  productImages: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
})

export const createProductConversionSchema = z.object({
  fromUnitId: z.string().uuid('Invalid from unit ID'),
  toUnitId: z.string().uuid('Invalid to unit ID'),
  conversionFactor: z.number().positive('Conversion factor must be positive'),
  relationshipText: z.string().optional(),
})

export const updateProductConversionSchema = z.object({
  fromUnitId: z.string().uuid().optional(),
  toUnitId: z.string().uuid().optional(),
  conversionFactor: z.number().positive().optional(),
})

export const purchaseStockSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  unitId: z.string().uuid('Invalid unit ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative').default(0),
  supplierName: z.string().max(255).default(''),
  notes: z.string().default(''),
})

export const sellStockSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  unitId: z.string().uuid('Invalid unit ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative').default(0),
  customerName: z.string().max(255).default(''),
  notes: z.string().default(''),
})

export const adjustStockSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  newQuantity: z.number().min(0, 'Quantity cannot be negative'),
  notes: z.string().default(''),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type CreateProductConversionInput = z.infer<typeof createProductConversionSchema>
export type UpdateProductConversionInput = z.infer<typeof updateProductConversionSchema>
export type PurchaseStockInput = z.infer<typeof purchaseStockSchema>
export type SellStockInput = z.infer<typeof sellStockSchema>
export type AdjustStockInput = z.infer<typeof adjustStockSchema>
export type AdditionalUnitInput = { unitId: string; isPurchaseUnit: boolean; isSellingUnit: boolean }
export type ProductConversionInput = { fromUnitId: string; toUnitId: string; conversionFactor: number }
