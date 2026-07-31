import 'express-async-errors'
import express from 'express'
import type { Request } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import path from 'path'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'

import { config } from './config'
import { testConnection } from './db'
import { migrate } from './db/migrate'
import { errorHandler } from './middleware/errorHandler'

import unitRoutes from './modules/units/unit.routes'
import conversionRoutes from './modules/conversions/conversion.routes'
import productRoutes from './modules/products/product.routes'
import measurementTypeRoutes from './modules/measurementTypes/measurementType.routes'

const app = express()

app.use(cors())
app.use(express.json())
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'))

// ── Image Upload Configuration ────────────────────────────────────

const UPLOADS_DIR = path.resolve(__dirname, '../uploads')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, UPLOADS_DIR),
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const name = `${crypto.randomUUID()}${ext}`
    cb(null, name)
  },
})

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only JPG, PNG, and WEBP are allowed.`))
      return
    }
    cb(null, true)
  },
})

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR))

// Image upload endpoint: returns the saved file path
app.post('/api/upload', upload.single('image'), (req: Request, res: express.Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  res.json({
    path: `/uploads/${req.file.filename}`,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
  })
})

// Multer error handling
app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large. Maximum size is 5 MB.' })
      return
    }
    res.status(400).json({ error: err.message })
    return
  }
  if (err.message?.startsWith('Invalid file type')) {
    res.status(400).json({ error: err.message })
    return
  }
  next(err)
})

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.use('/api/units', unitRoutes)
app.use('/api/conversions', conversionRoutes)
app.use('/api/products', productRoutes)
app.use('/api/measurement-types', measurementTypeRoutes)

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
  console.log(`  GET    /api/measurement-types`)
  console.log(`  GET    /api/measurement-types/:id`)
  console.log(`  GET    /api/units`)
  console.log(`  GET    /api/units/:id`)
  console.log(`  GET    /api/units/by-type/:measurementTypeId`)
  console.log(`  POST   /api/units`)
  console.log(`  PATCH  /api/units/:id`)
  console.log(`  DELETE /api/units/:id`)
  console.log(`  GET    /api/conversions`)
  console.log(`  POST   /api/conversions/preview`)
  console.log(`  POST   /api/conversions`)
  console.log(`  PATCH  /api/conversions/:id`)
  console.log(`  DELETE /api/conversions/:id`)
  console.log(`  GET    /api/products`)
  console.log(`  GET    /api/products/:id`)
  console.log(`  POST   /api/products`)
  console.log(`  PATCH  /api/products/:id`)
  console.log(`  DELETE /api/products/:id`)
  console.log(`  POST   /api/products/stock/purchase`)
  console.log(`  POST   /api/products/stock/sell`)
  console.log(`  POST   /api/products/stock/adjust`)
  console.log(`  POST   /api/products/stock/validate`)
  console.log(`  GET    /api/products/:id/stock/display`)
  console.log(`  GET    /api/products/transactions/all`)
  console.log(`  GET    /api/products/purchases/list`)
  console.log(`  GET    /api/products/purchases/:id`)
  console.log(`  GET    /api/products/sales/list`)
  console.log(`  GET    /api/products/sales/:id`)
  console.log(`=========================================\n`)
  })
}

start().catch((err) => {
  console.error('[SERVER] Failed to start:', err)
  process.exit(1)
})
