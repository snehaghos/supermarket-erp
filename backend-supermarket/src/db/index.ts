import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { config } from '../config'

const dbDir = path.dirname(config.db.path)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db: Database.Database = new Database(config.db.path)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export interface QueryResult<T> {
  rows: T[]
  rowCount: number | null
}

export async function query<T>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now()
  const stmt = db.prepare(text)

  try {
    if (params && params.length > 0) {
      const result = stmt.all(...params) as T[]
      if (config.nodeEnv === 'development') {
        console.log(`[DB] Query executed in ${Date.now() - start}ms | rows: ${result.length}`)
      }
      return { rows: result, rowCount: result.length }
    } else {
      const result = stmt.all() as T[]
      if (config.nodeEnv === 'development') {
        console.log(`[DB] Query executed in ${Date.now() - start}ms | rows: ${result.length}`)
      }
      return { rows: result, rowCount: result.length }
    }
  } catch (error) {
    console.error('[DB] Query error:', error)
    throw error
  }
}

export async function queryOne<T>(
  text: string,
  params?: unknown[]
): Promise<T | undefined> {
  const stmt = db.prepare(text)
  try {
    if (params && params.length > 0) {
      return stmt.get(...params) as T | undefined
    }
    return stmt.get() as T | undefined
  } catch (error) {
    console.error('[DB] Query error:', error)
    throw error
  }
}

export interface RunResult {
  changes: number
}

export async function run(
  text: string,
  params?: unknown[]
): Promise<RunResult> {
  const start = Date.now()
  const stmt = db.prepare(text)

  try {
    const result = params && params.length > 0
      ? stmt.run(...params)
      : stmt.run()

    if (config.nodeEnv === 'development') {
      console.log(`[DB] Run executed in ${Date.now() - start}ms | changes: ${result.changes}`)
    }

    return { changes: Number(result.changes) }
  } catch (error) {
    console.error('[DB] Run error:', error)
    throw error
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    db.prepare('SELECT 1').get()
    console.log('[DB] SQLite connection established successfully')
    return true
  } catch (error) {
    console.error('[DB] Failed to connect to SQLite:', error)
    return false
  }
}

export default db
