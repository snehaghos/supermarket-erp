import { z } from 'zod'

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(255),
  email: z.string().email('Invalid email address').optional().or(z.literal('')).default(''),
  phone: z.string().max(50).optional().default(''),
  address: z.string().optional().default(''),
  city: z.string().max(100).optional().default(''),
  state: z.string().max(100).optional().default(''),
  pincode: z.string().max(20).optional().default(''),
  creditLimit: z.number().min(0, 'Credit limit cannot be negative').optional().default(0),
})

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  creditLimit: z.number().min(0, 'Credit limit cannot be negative').optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
