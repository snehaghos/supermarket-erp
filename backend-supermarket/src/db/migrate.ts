import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import Database from 'better-sqlite3'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../data/inventory.db')

const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export async function migrate(): Promise<void> {
  console.log('Running database migration...')
  const sqlPath = path.resolve(__dirname, 'schema.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  try {
    db.exec(sql)
    console.log('Migration completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

const isMainModule = process.argv[1] && (process.argv[1].includes('migrate') || process.argv[1].endsWith('migrate.ts'))
if (isMainModule) {
  migrate()
    .then(() => {
      db.close()
      process.exit(0)
    })
    .catch(() => process.exit(1))
}
