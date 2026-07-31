"use client"
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearch } from '@tanstack/react-router'
import {
  LayoutDashboard, Menu, X, Search, Package, Warehouse,
  ShoppingCart, Receipt, ArrowLeftRight, Ruler, GitCompare,
  Users, BarChart3, Settings, Bell,
  ChevronDown, ChevronRight, LogOut,
  Truck, ScrollText,
} from 'lucide-react'
import DashboardOverview from './dashboard-overview'
import { UnitsSection } from '@/features/units/components/units'
import { ConversionsSection } from '@/features/conversions/components/conversions'
import { ProductsSection } from '@/features/products/components/products'
import { SuppliersSection } from '@/features/suppliers/components/suppliers'
import { CustomersSection } from '@/features/customers/components/customers'
import { LayoutModeProvider, LayoutModeSelector } from '@/features/layout-mode'
import { ThemeToggle } from '@/features/theme'
import { SettingsSection } from '@/features/settings'
import { StockOverviewSection } from '@/features/stock-overview'

// ─── Navigation Structure ────────────────────────────────────────────

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  badgeColor?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { id: 'PRODUCTS', label: 'Products', icon: Package },
      { id: 'STOCK', label: 'Stock Overview', icon: Warehouse, badge: 0, badgeColor: 'bg-amber-500' },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { id: 'PURCHASES', label: 'Purchases', icon: ShoppingCart },
      { id: 'SALES', label: 'Sales', icon: Receipt },
      { id: 'RETURNS', label: 'Returns', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { id: 'UNITS', label: 'Units', icon: Ruler },
      { id: 'CONVERSIONS', label: 'Conversions', icon: GitCompare },
      { id: 'SUPPLIERS', label: 'Suppliers', icon: Truck },
      { id: 'CUSTOMERS', label: 'Customers', icon: Users },
    ],
  },
  {
    label: 'Reports',
    items: [
      { id: 'REPORTS', label: 'Reports & Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Settings',
    items: [
      { id: 'SETTINGS', label: 'Settings', icon: Settings },
      { id: 'ACTIVITY', label: 'Activity Logs', icon: ScrollText },
    ],
  },
]

const ALL_NAV_IDS = NAV_GROUPS.flatMap(g => g.items.map(i => i.id))

// ─── Search Functionality ─────────────────────────────────────────

function fuzzySearch(query: string, items: NavItem[]): NavItem[] {
  const q = query.toLowerCase()
  return items.filter(
    item =>
      item.label.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
  )
}

// ─── Sidebar Component ────────────────────────────────────────────

function Sidebar({
  activeTab,
  onTabChange,
  sidebarOpen,
  onClose,
  lowStockCount,
}: {
  activeTab: string
  onTabChange: (tab: string) => void
  sidebarOpen: boolean
  onClose: () => void
  lowStockCount: number
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Overview', 'Inventory']))

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.map(item => ({
          ...item,
          badge: item.id === 'STOCK' ? lowStockCount : item.badge,
        })),
        visible: true,
      }))
    }

    const allItems = NAV_GROUPS.flatMap(g => g.items)
    const matched = fuzzySearch(searchQuery, allItems)
    const matchedIds = new Set(matched.map(m => m.id))

    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items
        .filter(item => matchedIds.has(item.id))
        .map(item => ({
          ...item,
          badge: item.id === 'STOCK' ? lowStockCount : item.badge,
        })),
      visible: group.items.some(item => matchedIds.has(item.id)),
    })).filter(g => g.visible)
  }, [searchQuery, lowStockCount])

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar text-sidebar-foreground
          flex flex-col transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
          shadow-2xl lg:shadow-none
        `}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">
              SI
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-white">SuperMarket</p>
              <p className="text-[9px] text-emerald-400/80 font-medium uppercase tracking-wider">Inventory ERP</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sidebar-muted" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search menu..."
              className="w-full h-8 pl-8 pr-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-sidebar-muted/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 space-y-1">
          {filteredGroups.map(group => {
            const isExpanded = expandedGroups.has(group.label)

            return (
              <div key={group.label} className="mb-1">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted/70 hover:text-sidebar-muted transition-colors group"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-2.5 h-2.5 transition-transform duration-200" />
                  ) : (
                    <ChevronRight className="w-2.5 h-2.5 transition-transform duration-200" />
                  )}
                  {group.label}
                  <span className="flex-1 border-t border-white/5 ml-2" />
                </button>

                {/* Group Items */}
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="space-y-0.5 ml-1">
                    {group.items.map(item => {
                      const Icon = item.icon
                      const isActive = activeTab === item.id

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onTabChange(item.id)
                            setSearchQuery('')
                            onClose()
                          }}
                          className={`
                            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium
                            transition-all duration-150 text-left relative group
                            ${isActive
                              ? 'bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/5'
                              : 'text-sidebar-foreground/65 hover:bg-white/5 hover:text-sidebar-foreground/90'
                            }
                          `}
                        >
                          {/* Active indicator */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-500 rounded-full" />
                          )}

                          <Icon className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                            isActive ? 'text-emerald-400' : 'text-sidebar-muted/70'
                          }`} />

                          <span className="flex-1 truncate">{item.label}</span>

                          {/* Badge */}
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold text-white ${
                              item.badgeColor || 'bg-emerald-500'
                            }`}>
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="shrink-0 border-t border-white/10 px-3 py-3">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">Admin User</p>
              <p className="text-[9px] text-sidebar-muted/60 truncate">Administrator</p>
            </div>
            <button className="p-1 rounded-md hover:bg-white/10 text-sidebar-muted/50 hover:text-white/70 transition-colors shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

// ─── Header Component ──────────────────────────────────────────────

function Header({
  activeLabel,
  onMenuClick,
  onSearch,
}: {
  activeLabel: string
  onMenuClick: () => void
  onSearch?: (query: string) => void
}) {
  const [notifications] = useState(3)
  const [searchText, setSearchText] = useState('')

  return (
    <header className="h-16 bg-[var(--header-bg)]/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb */}
        <nav className="hidden sm:flex items-center gap-2 text-sm">
          <span className="text-muted-foreground/60 text-xs">Inventory</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
          <span className="font-semibold text-foreground">{activeLabel}</span>
        </nav>
        <h1 className="sm:hidden text-lg font-semibold text-foreground">{activeLabel}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Layout Mode Selector */}
        <LayoutModeSelector />

        {/* Global Search */}
        <div className="hidden md:flex relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={searchText}
            onChange={e => {
              setSearchText(e.target.value)
              onSearch?.(e.target.value)
            }}
            placeholder="Search products, units..."
            className="w-56 lg:w-72 h-9 pl-9 pr-3 border border-input rounded-lg text-sm bg-muted/30 focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors group">
          <Bell className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          {notifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center shadow-sm shadow-red-500/30">
              {notifications}
            </span>
          )}
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-medium text-foreground">Admin</p>
            <p className="text-[10px] text-muted-foreground">Supermanager</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm cursor-pointer">
            A
          </div>
        </div>
      </div>
    </header>
  )
}

// ─── Placeholder Components (for new modules) ─────────────────────

function PlaceholderPage({ title, description, icon: Icon }: { title: string; description: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </div>
  )
}

// ─── Main Layout ────────────────────────────────────────────────────

export function PortfolioLayout() {
  const search = useSearch({ from: '/' }) as { tab?: string }
  const [activeTab, setActiveTab] = useState('DASHBOARD')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  useEffect(() => {
    if (search?.tab && ALL_NAV_IDS.includes(search.tab)) setActiveTab(search.tab)
  }, [search?.tab])

  const activeLabel = useMemo(() => {
    for (const group of NAV_GROUPS) {
      const found = group.items.find(n => n.id === activeTab)
      if (found) return found.label
    }
    return 'Dashboard'
  }, [activeTab])

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    window.history.replaceState({}, '', `/?tab=${tab}`)
  }, [])

  // Mock badge data
  const lowStockCount = 0 // Will be populated by dashboard data

  const renderContent = () => {
    switch (activeTab) {
      case 'DASHBOARD':
        return <DashboardOverview />
      case 'PRODUCTS':
        return <ProductsSection />
      case 'UNITS':
        return <UnitsSection />
      case 'CONVERSIONS':
        return <ConversionsSection />
      case 'SUPPLIERS':
        return <SuppliersSection />
      case 'CUSTOMERS':
        return <CustomersSection />
      case 'PURCHASES':
        return <PlaceholderPage title="Purchases" description="Complete purchase workflow: Purchase Request → Purchase Order → Goods Receipt Note → Supplier Invoice → Payment. Coming soon." icon={ShoppingCart} />
      case 'SALES':
        return <PlaceholderPage title="Sales" description="Complete sales workflow: Shopping Cart → Invoice → Discounts → Taxes → Payment → Receipt. Coming soon." icon={Receipt} />
      case 'RETURNS':
        return <PlaceholderPage title="Returns" description="Manage purchase returns and sales returns with full audit trail. Coming soon." icon={ArrowLeftRight} />
      case 'STOCK':
        return <StockOverviewSection />
      case 'REPORTS':
        return <PlaceholderPage title="Reports & Analytics" description="Inventory reports, purchase reports, sales reports, profit & loss, stock valuation, expiry reports, and fast/slow moving products. Coming soon." icon={BarChart3} />
      case 'SETTINGS':
        return <SettingsSection />
      case 'ACTIVITY':
        return <PlaceholderPage title="Activity Logs" description="Audit trails for all system actions — who did what, when, and where. Coming soon." icon={ScrollText} />
      default:
        return <DashboardOverview />
    }
  }

  return (
    <LayoutModeProvider>
      <div className="min-h-screen bg-background flex">
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          lowStockCount={lowStockCount}
        />

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full">
          <Header
            activeLabel={activeLabel}
            onMenuClick={() => setSidebarOpen(true)}
          />

          {/* Content */}
          <main className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </LayoutModeProvider>
  )
}
