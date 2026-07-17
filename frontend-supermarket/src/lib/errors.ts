import { toast } from "sonner"
import { ApiError } from "./api"

/**
 * Display a success toast notification
 */
export function showSuccess(message: string, description?: string) {
  toast.success(message, {
    description,
    duration: 3000,
  })
}

/**
 * Display an error toast based on an ApiError or generic Error.
 * Shows user-friendly messages with error type categorization.
 */
export function showApiError(error: unknown) {
  if (error instanceof ApiError) {
    // Build a user-friendly description from validation details
    let description = ""
    if (error.details.length > 0) {
      description = error.details
        .slice(0, 3) // Show first 3 field errors at most
        .map(d => `• ${d.field.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}: ${d.message}`)
        .join("\n")
      if (error.details.length > 3) {
        description += `\n• ...and ${error.details.length - 3} more`
      }
    }

    const errorLabel = getErrorLabel(error.type)

    toast.error(`${errorLabel}: ${error.userMessage}`, {
      description: description || undefined,
      duration: error.type === 'validation' ? 6000 : 5000,
    })
  } else if (error instanceof Error) {
    toast.error(error.message || "An unexpected error occurred", {
      duration: 5000,
    })
  } else {
    toast.error("An unexpected error occurred", {
      duration: 5000,
    })
  }
}

/**
 * Display a warning toast
 */
export function showWarning(message: string, description?: string) {
  toast.warning(message, {
    description,
    duration: 4000,
  })
}

/**
 * Display an info toast
 */
export function showInfo(message: string, description?: string) {
  toast.info(message, {
    description,
    duration: 3000,
  })
}

/**
 * Map error type to a human-readable label
 */
function getErrorLabel(type: string): string {
  switch (type) {
    case 'validation': return 'Invalid Input'
    case 'not_found': return 'Not Found'
    case 'conflict': return 'Already Exists'
    case 'auth': return 'Access Denied'
    case 'server': return 'Server Error'
    case 'network': return 'Connection Error'
    default: return 'Error'
  }
}
