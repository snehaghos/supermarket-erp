import { z } from 'zod'

export const createConversionSchema = z.object({
  parentUnitId: z.string().uuid('Invalid parent unit ID'),
  childUnitId: z.string().uuid('Invalid child unit ID'),
  factor: z.number().positive('Factor must be a positive number'),
})

export const updateConversionSchema = z.object({
  parentUnitId: z.string().uuid('Invalid parent unit ID').optional(),
  childUnitId: z.string().uuid('Invalid child unit ID').optional(),
  factor: z.number().positive('Factor must be a positive number').optional(),
})

export const previewConversionSchema = z.object({
  quantity: z.number().positive('Quantity must be a positive number'),
  unitId: z.string().uuid('Invalid unit ID'),
})

export type CreateConversionInput = z.infer<typeof createConversionSchema>
export type UpdateConversionInput = z.infer<typeof updateConversionSchema>
export type PreviewConversionInput = z.infer<typeof previewConversionSchema>
