/**
 * Minimal smoke test — no external test framework required.
 * Verifies the database migrates cleanly, connects, and exposes the
 * core tables every module depends on.
 *
 * Run with: npm test
 */
import { migrate } from '../src/db/migrate'
import { query, testConnection } from '../src/db'

const CORE_TABLES = [
  'units',
  'measurement_types',
  'conversions',
  'products',
  'product_units',
  'product_conversions',
  'inventory_transactions',
  'suppliers',
  'customers',
  'purchases',
  'sales',
] as const

async function main(): Promise<void> {
  await migrate()

  const connected = await testConnection()
  if (!connected) {
    throw new Error('Database connection failed')
  }

  for (const table of CORE_TABLES) {
    const result = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`)
    if (result.rows.length !== 1) {
      throw new Error(`Table "${table}" is missing or unreadable`)
    }
  }

  // Seed data sanity check: measurement types must exist (units depend on them).
  const seed = await query<{ name: string }>(
    "SELECT name FROM measurement_types WHERE name = 'Weight' LIMIT 1"
  )
  if (seed.rows.length !== 1) {
    throw new Error('Seed data missing: measurement_types has no "Weight" row')
  }

  console.log(`[SMOKE] OK — ${CORE_TABLES.length} core tables present, seed data intact`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[SMOKE] FAILED:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
