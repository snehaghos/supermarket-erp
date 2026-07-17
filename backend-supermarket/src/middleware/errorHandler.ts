import type { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public details?: { field: string; message: string }[]
  ) {
    super(message)
    this.name = 'AppError'
  }
}

interface ErrorResponse {
  error: string      // User-friendly message
  code: string       // Machine-readable error code
  status: number     // HTTP status code
  details?: { field: string; message: string }[]  // Validation errors (field-level)
  timestamp: string  // ISO timestamp
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const timestamp = new Date().toISOString()

  if (err instanceof AppError) {
    const body: ErrorResponse = {
      error: err.message,
      code: err.code,
      status: err.statusCode,
      timestamp,
    }
    if (err.details && err.details.length > 0) {
      body.details = err.details
    }
    res.status(err.statusCode).json(body)
    return
  }

  console.error('[ERROR] Unhandled error:', err)

  const body: ErrorResponse = {
    error: 'Something went wrong. Please try again later.',
    code: 'INTERNAL_ERROR',
    status: 500,
    timestamp,
  }
  res.status(500).json(body)
}
