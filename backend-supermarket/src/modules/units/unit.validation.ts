import { z } from 'zod'

export const createUnitSchema = z.object({
  name: z.string().min(1, 'Unit name is required').max(255),
  symbol: z.string().min(1, 'Symbol is required').max(50),
  measurementTypeId: z.string().uuid('Invalid measurement type ID'),
  isPackaging: z.boolean().default(false),
})

export const updateUnitSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  symbol: z.string().min(1).max(50).optional(),
  measurementTypeId: z.string().uuid('Invalid measurement type ID').optional(),
  isPackaging: z.boolean().optional(),
})

export type CreateUnitInput = z.infer<typeof createUnitSchema>
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>
