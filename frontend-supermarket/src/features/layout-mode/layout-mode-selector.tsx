'use client'

import { useEffect, useRef, useState } from 'react'
import { LayoutPanelLeft, LayoutPanelTop, LayoutTemplate } from 'lucide-react'
import { useLayoutMode } from './layout-mode-context'
import type { LayoutMode } from './layout-mode-context'

const MODE_OPTIONS: Array<{
  value: LayoutMode
  label: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  {
    value: 'modal',
    label: 'Modal',
    desc: 'Forms open as centered modal overlays',
    icon: LayoutTemplate,
  },
  {
    value: 'inline',
    label: 'Inline',
    desc: 'Forms appear inline on the page below the header',
    icon: LayoutPanelTop,
  },
  {
    value: 'sidebar',
    label: 'Side Panel',
    desc: 'Forms slide in from the right side as a panel',
    icon: LayoutPanelLeft,
  },
]

export function LayoutModeSelector() {
  const { mode, setMode } = useLayoutMode()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const current = MODE_OPTIONS.find((o) => o.value === mode)!

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border transition-all"
        title="Change form layout mode"
      >
        <current.icon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Form Layout
            </p>
          </div>
          <div className="p-1.5 space-y-0.5">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isActive = mode === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setMode(opt.value)
                    setOpen(false)
                  }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isActive ? 'text-emerald-500' : 'text-muted-foreground/60'
                    }`}
                  />
                  <div>
                    <p
                      className={`text-xs font-medium ${
                        isActive ? 'text-emerald-700' : 'text-foreground'
                      }`}
                    >
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
