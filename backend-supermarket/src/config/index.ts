import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    path: process.env.DB_PATH || path.resolve(__dirname, '../../data/inventory.db'),
  },
} as const
