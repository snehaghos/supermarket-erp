"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type LayoutMode = "modal" | "inline" | "sidebar"

interface LayoutModeContextValue {
  /** The current layout mode for opening forms/modals */
  mode: LayoutMode
  /** Change the layout mode globally */
  setMode: (mode: LayoutMode) => void
}

const LayoutModeContext = createContext<LayoutModeContextValue>({
  mode: "modal",
  setMode: () => {},
})

export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LayoutMode>(() => {
    // Persist preference in localStorage
    const saved = typeof window !== "undefined" ? localStorage.getItem("layout-mode") : null
    return (saved as LayoutMode) || "modal"
  })

  const setMode = useCallback((newMode: LayoutMode) => {
    setModeState(newMode)
    if (typeof window !== "undefined") {
      localStorage.setItem("layout-mode", newMode)
    }
  }, [])

  return (
    <LayoutModeContext.Provider value={{ mode, setMode }}>
      {children}
    </LayoutModeContext.Provider>
  )
}

export function useLayoutMode(): LayoutModeContextValue {
  const ctx = useContext(LayoutModeContext)
  if (!ctx) {
    throw new Error("useLayoutMode must be used within a LayoutModeProvider")
  }
  return ctx
}
