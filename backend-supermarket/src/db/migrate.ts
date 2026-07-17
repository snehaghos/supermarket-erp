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

/**
 * Get column names for a table, or empty array if table doesn't exist.
 */
function getTableColumns(tableName: string): string[] {
  try {
    const result = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[]
    return result.map((r: { name: string }) => r.name)
  } catch {
    return []
  }
}

/**
 * Add a column to a table if it doesn't already exist.
 */
function addColumnIfMissing(table: string, column: string, definition: string): void {
  const columns = getTableColumns(table)
  if (!columns.includes(column)) {
    console.log(`[MIGRATE] Adding column ${table}.${column}`)
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

export async function migrate(): Promise<void> {
  console.log('Running database migration...')
  const sqlPath = path.resolve(__dirname, 'schema.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  try {
    // Create/update tables
    db.exec(sql)

    // ── Schema additions (for existing databases) ─────────────────
    // These ALTER TABLE statements handle columns added in later schema versions.
    // Full list of columns that may be missing in databases created from older schema versions.

    // Basic info fields
    addColumnIfMissing('products', 'barcode', "VARCHAR(100) DEFAULT ''")
    addColumnIfMissing('products', 'brand', "VARCHAR(255) DEFAULT ''")
    addColumnIfMissing('products', 'image_url', "TEXT DEFAULT ''")

    // Pricing
    addColumnIfMissing('products', 'purchase_price', 'REAL NOT NULL DEFAULT 0')
    addColumnIfMissing('products', 'selling_price', 'REAL NOT NULL DEFAULT 0')
    addColumnIfMissing('products', 'mrp', 'REAL NOT NULL DEFAULT 0')
    addColumnIfMissing('products', 'tax_class', "TEXT NOT NULL DEFAULT ''")

    // Stock thresholds
    addColumnIfMissing('products', 'max_stock', 'REAL NOT NULL DEFAULT 0')
    addColumnIfMissing('products', 'reorder_level', 'REAL NOT NULL DEFAULT 0')

    // Product tracking fields
    addColumnIfMissing('products', 'track_batch', 'INTEGER NOT NULL DEFAULT 0')
    addColumnIfMissing('products', 'track_expiry', 'INTEGER NOT NULL DEFAULT 0')
    addColumnIfMissing('products', 'track_serial', 'INTEGER NOT NULL DEFAULT 0')
    addColumnIfMissing('products', 'batch_number_format', "TEXT DEFAULT ''")
    addColumnIfMissing('products', 'manufacturing_date_field', "TEXT DEFAULT ''")
    addColumnIfMissing('products', 'expiry_date_field', "TEXT DEFAULT ''")
    addColumnIfMissing('products', 'serial_format', "TEXT DEFAULT ''")
    addColumnIfMissing('products', 'serial_validation', "TEXT DEFAULT ''")

    // Product images table (if not created by IF NOT EXISTS above)
    const productImagesColumns = getTableColumns('product_images')
    if (productImagesColumns.length === 0) {
      console.log('[MIGRATE] Creating product_images table')
      db.exec(`
        CREATE TABLE IF NOT EXISTS product_images (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          image_path TEXT NOT NULL,
          original_name TEXT DEFAULT '',
          mime_type TEXT DEFAULT '',
          file_size INTEGER DEFAULT 0,
          is_primary INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
    }

    // Ensure indexes exist
    db.exec('CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id)')

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
