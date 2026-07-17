import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'
import { AppError } from './errorHandler'

/**
 * Maps a Zod validation issue to a simple, user-friendly message
 */
function friendlyIssueMessage(fieldPath: string, issueMessage: string): string {
  const fieldName = fieldPath.split('.').pop() || fieldPath
  const fieldLabel = fieldName
    .replace(/([A-Z])/g, ' $1')      // Split camelCase: "purchaseUnitId" → "purchase Unit Id"
    .replace(/ Id$/i, ' ID')         // Normalize trailing "Id" → "ID": "Purchase Unit Id" → "Purchase Unit ID"
    .replace(/^./, s => s.toUpperCase()) // Capitalize first letter
    .replace(/_id$/, ' ID')          // Handle snake_case trailing "_id": "purchase_unit_id" → "purchase_unit ID"
    .replace(/_/g, ' ')             // Replace remaining underscores with spaces

  // Zod's built-in messages are pretty good already, but make them more user-friendly
  const lower = issueMessage.toLowerCase()
  if (lower.includes('required')) return `${fieldLabel} is required`
  if (lower.includes('invalid') && lower.includes('uuid')) return `${fieldLabel} is not valid`
  if (lower.includes('must be positive')) return `${fieldLabel} must be greater than 0`
  if (lower.includes('cannot be negative')) return `${fieldLabel} cannot be negative`
  if (lower.includes('expected')) {
    if (lower.includes('string')) return `${fieldLabel} must be text`
    if (lower.includes('number')) return `${fieldLabel} must be a number`
  }
  return issueMessage
}

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source])

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: friendlyIssueMessage(issue.path.join('.'), issue.message),
      }))

      next(new AppError(
        400,
        `Please fix the following ${details.length > 1 ? `${details.length} issues` : 'issue'}:`,
        'VALIDATION_ERROR',
        details
      ))
      return
    }

    if (source === 'body') {
      req.body = result.data
    } else if (source === 'query') {
      ;(req as any).parsedQuery = result.data
    }

    next()
  }
}
