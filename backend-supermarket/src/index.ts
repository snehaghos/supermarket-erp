import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import { config } from './config'
import { testConnection } from './db'
import { migrate } from './db/migrate'
import { errorHandler } from './middleware/errorHandler'

import unitRoutes from './modules/units/unit.routes'
import conversionRoutes from './modules/conversions/conversion.routes'

const app = express()

app.use(cors())
app.use(express.json())
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'))

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.use('/api/units', unitRoutes)
app.use('/api/conversions', conversionRoutes)

app.use(errorHandler)

async function start(): Promise<void> {
  try {
    await migrate()
    console.log('[SERVER] Database migrated')
  } catch (err) {
    console.error('[SERVER] Migration failed:', err)
    process.exit(1)
  }

  const dbConnected = await testConnection()
  if (!dbConnected) {
    console.error('[SERVER] Failed to connect to database. Exiting.')
    process.exit(1)
  }

  app.listen(config.port, () => {
    console.log(`\n=========================================`)
    console.log(`  Server running on http://localhost:${config.port}`)
    console.log(`  Environment: ${config.nodeEnv}`)
    console.log(`=========================================`)
    console.log(`  Endpoints:`)
    console.log(`  GET    /api/health`)
    console.log(`  GET    /api/units`)
    console.log(`  GET    /api/units/:id`)
    console.log(`  POST   /api/units`)
    console.log(`  PATCH  /api/units/:id`)
    console.log(`  DELETE /api/units/:id`)
    console.log(`  GET    /api/conversions`)
    console.log(`  POST   /api/conversions/preview`)
    console.log(`  POST   /api/conversions`)
    console.log(`  PATCH  /api/conversions/:id`)
    console.log(`  DELETE /api/conversions/:id`)
    console.log(`=========================================\n`)
  })
}

start().catch((err) => {
  console.error('[SERVER] Failed to start:', err)
  process.exit(1)
})
