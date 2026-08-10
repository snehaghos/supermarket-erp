'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface SlideInPanelProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  /** Width of the panel (default: max-w-lg) */
  width?: string
}

export function SlideInPanel({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  width = 'max-w-lg',
  showHeader = true,
}: SlideInPanelProps & { showHeader?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative w-full ${width} h-full bg-card border-r border-border shadow-2xl flex flex-col animate-in slide-in-from-left duration-300`}
      >
        {/* Header */}
        {showHeader && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-foreground truncate">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
      </div>
    </div>
  )
}
