import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import unitsRouter from './routes/units'
import conversionsRouter from './routes/conversions'

const app = express()
const PORT = process.env.PORT ?? 4000

// Middleware
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

// Routes
app.use('/api/units', unitsRouter)
app.use('/api/conversions', conversionsRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`API endpoints:`)
  console.log(`  GET    /api/health`)
  console.log(`  GET    /api/units`)
  console.log(`  POST   /api/units`)
  console.log(`  PATCH  /api/units/:id`)
  console.log(`  DELETE /api/units/:id`)
  console.log(`  GET    /api/conversions`)
  console.log(`  POST   /api/conversions`)
  console.log(`  PATCH  /api/conversions/:id`)
  console.log(`  DELETE /api/conversions/:id`)
  console.log(`  POST   /api/conversions/preview`)
})
