import { Pool, type QueryResult, type QueryResultRow } from 'pg'
import { config } from '../config'

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err)
  process.exit(-1)
})

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now()
  const result = await pool.query<T>(text, params)
  const duration = Date.now() - start
  if (config.nodeEnv === 'development') {
    console.log(`[DB] Query executed in ${duration}ms | rows: ${result.rowCount}`)
  }
  return result
}

export async function testConnection(): Promise<boolean> {
  try {
    await query('SELECT NOW()')
    console.log('[DB] PostgreSQL connection established successfully')
    return true
  } catch (error) {
    console.error('[DB] Failed to connect to PostgreSQL:', error)
    return false
  }
}
