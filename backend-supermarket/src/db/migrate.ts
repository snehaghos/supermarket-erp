import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const connectionString = process.env.DATABASE_URL

const pool = connectionString
  ? new Pool({ connectionString })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'supermarket_inventory',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    })

async function migrate(): Promise<void> {
  console.log('Running database migration...')
  const sqlPath = path.resolve(__dirname, 'schema.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  try {
    await pool.query(sql)
    console.log('Migration completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
