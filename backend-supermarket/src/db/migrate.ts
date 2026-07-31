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
    // ── Step 1: Prepare existing tables for new schema ──
    // Must add columns BEFORE executing schema.sql, because the schema.sql
    // contains INSERT statements that reference these columns. On an existing
    // database, CREATE TABLE IF NOT EXISTS for 'units' will skip (table exists),
    // so the old table won't have these columns yet.

    // Ensure measurement_types table exists first (needed for FK reference)
    const mtColumns = getTableColumns('measurement_types')
    if (mtColumns.length === 0) {
      console.log('[MIGRATE] Creating measurement_types table')
      db.exec(`
        CREATE TABLE IF NOT EXISTS measurement_types (
          id TEXT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
    }

    // Add new columns to existing units table
    const unitColumns = getTableColumns('units')
    if (!unitColumns.includes('measurement_type_id')) {
      console.log('[MIGRATE] Adding measurement_type_id column to units')
      db.exec(`ALTER TABLE units ADD COLUMN measurement_type_id TEXT REFERENCES measurement_types(id)`)
    }
    if (!unitColumns.includes('is_packaging')) {
      console.log('[MIGRATE] Adding is_packaging column to units')
      db.exec(`ALTER TABLE units ADD COLUMN is_packaging INTEGER NOT NULL DEFAULT 0`)
    }

    // ── Step 2: Create/update tables and seed data ──
    // Disable FK enforcement during schema execution to allow seed INSERTs
    // to populate reference tables (measurement_types → units → conversions).
    // FK enforcement is re-enabled at startup via PRAGMA in db/index.ts
    db.pragma('foreign_keys = OFF')
    db.exec(sql)
    db.pragma('foreign_keys = ON')

    // ── Step 3: Schema additions (for existing databases) ─────────────────
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

    // ── Step 4: Populate measurement_type_id for existing units ──
    const measurementTypeMap: Record<string, string> = {
      'Weight': '00000000-0000-0000-0000-000000000101',
      'Length': '00000000-0000-0000-0000-000000000102',
      'Volume': '00000000-0000-0000-0000-000000000103',
      'Count': '00000000-0000-0000-0000-000000000104',
      'Area': '00000000-0000-0000-0000-000000000105',
      'Time': '00000000-0000-0000-0000-000000000106',
      'Temperature': '00000000-0000-0000-0000-000000000107',
      'Energy': '00000000-0000-0000-0000-000000000108',
      'Digital': '00000000-0000-0000-0000-000000000109',
      'Packaging': '00000000-0000-0000-0000-00000000010a',
    }
    for (const [typeName, typeId] of Object.entries(measurementTypeMap)) {
      const count = db.prepare(
        `UPDATE units SET measurement_type_id = ?, type = ? WHERE type = ? AND measurement_type_id IS NULL`
      ).run(typeId, typeName, typeName).changes
      if (count > 0) {
        console.log(`[MIGRATE] Updated ${count} '${typeName}' units with measurement_type_id`)
      }
    }

    // Update existing packaging units to have is_packaging = 1
    const packagingCount = db.prepare(
      `UPDATE units SET is_packaging = 1 WHERE type = 'Packaging' AND is_packaging = 0`
    ).run().changes
    if (packagingCount > 0) {
      console.log(`[MIGRATE] Marked ${packagingCount} packaging units with is_packaging=1`)
    }

    // ── Step 5: Ensure indexes exist ──
    db.exec('CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_units_measurement_type ON units(measurement_type_id)')

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
