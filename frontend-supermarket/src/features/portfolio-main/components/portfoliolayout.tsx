"use client"
import { useState, useEffect } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import DashboardOverview from './dashboard-overview'
import { UnitsSection } from '@/features/units/components/units'
import { ConversionsSection } from '@/features/conversions/components/conversions'

const NAV_ITEMS = [
  { id: 'DASHBOARD', label: 'Dashboard' },
  { id: 'UNITS', label: 'Units' },
  { id: 'CONVERSIONS', label: 'Conversions' },
]

export function PortfolioLayout() {
  const search = useSearch({ from: '/' }) as { tab?: string }
  const [activeTab, setActiveTab] = useState('DASHBOARD')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (search?.tab) setActiveTab(search.tab)
  }, [search?.tab])

  const activeLabel = NAV_ITEMS.find(n => n.id === activeTab)?.label ?? 'Dashboard'

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[240px] bg-sidebar text-sidebar-foreground
          flex flex-col transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
            SI
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Supermarket</p>
            <p className="text-[10px] text-sidebar-muted font-medium">Inventory Manager</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 text-left
                ${activeTab === item.id
                  ? 'bg-sidebar-active/15 text-emerald-400 shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground'
                }
              `}
            >
              <span className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                activeTab === item.id ? 'bg-emerald-400 scale-125' : 'bg-sidebar-muted'
              }`} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-sidebar-muted">
            <span className={`w-2 h-2 rounded-full ${false ? 'bg-emerald-400' : 'bg-red-400'}`} />
            API Offline
          </div>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">{activeLabel}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md font-medium">
              GET /api/{activeTab === 'DASHBOARD' ? 'health' : activeTab.toLowerCase()}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">
          {activeTab === 'DASHBOARD' && <DashboardOverview />}
          {activeTab === 'UNITS' && <UnitsSection />}
          {activeTab === 'CONVERSIONS' && <ConversionsSection />}
        </main>
      </div>
    </div>
  )
}
