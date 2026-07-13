import { z } from 'zod'

const unitTypes = ['Count', 'Weight', 'Volume', 'Length', 'Area', 'Packaging'] as const

export type UnitType = (typeof unitTypes)[number]

export const createUnitSchema = z.object({
  name: z.string().min(1, 'Unit name is required').max(255),
  symbol: z.string().min(1, 'Symbol is required').max(50),
  type: z.enum(unitTypes, { message: 'Invalid unit type' }),
})

export const updateUnitSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  symbol: z.string().min(1).max(50).optional(),
  type: z.enum(unitTypes, { message: 'Invalid unit type' }).optional(),
})

export type CreateUnitInput = z.infer<typeof createUnitSchema>
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>
