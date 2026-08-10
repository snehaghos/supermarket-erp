'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronRight as Crumb,
  GitCompare,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Ruler,
  ScrollText,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  X,
} from 'lucide-react'
import DashboardOverview from './dashboard-overview'
import type { ProductWithRelations } from '@/lib/api'
import { UnitsSection } from '@/features/units/components/units'
import { ConversionsSection } from '@/features/conversions/components/conversions'
import { ProductsSection } from '@/features/products/components/products'
import { SuppliersSection } from '@/features/suppliers/components/suppliers'
import { CustomersSection } from '@/features/customers/components/customers'
import { PurchasesSection } from '@/features/purchases'
import { SalesSection } from '@/features/sales'
import { ReturnsSection } from '@/features/returns'
import { ReportsSection } from '@/features/reports'
import { ActivityLogsSection } from '@/features/activity'
import { LayoutModeProvider, LayoutModeSelector } from '@/features/layout-mode'
import { ThemeToggle } from '@/features/theme'
import { SettingsSection } from '@/features/settings'
import { StockOverviewSection } from '@/features/stock-overview'
import { productsApi } from '@/lib/api'
import { showInfo } from '@/lib/errors'

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
  items: Array<NavItem>
}

const NAV_GROUPS: Array<NavGroup> = [
  {
    label: 'Overview',
    items: [{ id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Inventory',
    items: [
      { id: 'PRODUCTS', label: 'Products', icon: Package },
      {
        id: 'STOCK',
        label: 'Stock Overview',
        icon: Warehouse,
        badge: 0,
        badgeColor: 'bg-amber-500',
      },
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
    items: [{ id: 'REPORTS', label: 'Reports & Analytics', icon: BarChart3 }],
  },
  {
    label: 'Settings',
    items: [
      { id: 'SETTINGS', label: 'Settings', icon: Settings },
      { id: 'ACTIVITY', label: 'Activity Logs', icon: ScrollText },
    ],
  },
]

const ALL_NAV_IDS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id))

// ─── Search Functionality ─────────────────────────────────────────

function fuzzySearch(query: string, items: Array<NavItem>): Array<NavItem> {
  const q = query.toLowerCase()
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q),
  )
}

// ─── Sidebar Component ────────────────────────────────────────────

function Sidebar({
  activeTab,
  onTabChange,
  sidebarOpen,
  onClose,
  lowStockCount,
  onLogout,
}: {
  activeTab: string
  onTabChange: (tab: string) => void
  sidebarOpen: boolean
  onClose: () => void
  lowStockCount: number
  onLogout: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['Overview', 'Inventory']),
  )

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          badge: item.id === 'STOCK' ? lowStockCount : item.badge,
        })),
        visible: true,
      }))
    }

    const allItems = NAV_GROUPS.flatMap((g) => g.items)
    const matched = fuzzySearch(searchQuery, allItems)
    const matchedIds = new Set(matched.map((m) => m.id))

    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items
        .filter((item) => matchedIds.has(item.id))
        .map((item) => ({
          ...item,
          badge: item.id === 'STOCK' ? lowStockCount : item.badge,
        })),
      visible: group.items.some((item) => matchedIds.has(item.id)),
    })).filter((g) => g.visible)
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
              <p className="text-sm font-bold leading-tight text-white">
                SuperMarket
              </p>
              <p className="text-[9px] text-emerald-400/80 font-medium uppercase tracking-wider">
                Inventory ERP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sidebar-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu..."
              className="w-full h-8 pl-8 pr-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-sidebar-muted/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 space-y-1">
          {filteredGroups.map((group) => {
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
                    isExpanded
                      ? 'max-h-[500px] opacity-100'
                      : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="space-y-0.5 ml-1">
                    {group.items.map((item) => {
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
                            ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/5'
                                : 'text-sidebar-foreground/65 hover:bg-white/5 hover:text-sidebar-foreground/90'
                            }
                          `}
                        >
                          {/* Active indicator */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-500 rounded-full" />
                          )}

                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                              isActive
                                ? 'text-emerald-400'
                                : 'text-sidebar-muted/70'
                            }`}
                          />

                          <span className="flex-1 truncate">{item.label}</span>

                          {/* Badge */}
                          {item.badge !== undefined && item.badge > 0 && (
                            <span
                              className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold text-white ${
                                item.badgeColor || 'bg-emerald-500'
                              }`}
                            >
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
              <p className="text-xs font-medium text-white truncate">
                Admin User
              </p>
              <p className="text-[9px] text-sidebar-muted/60 truncate">
                Administrator
              </p>
            </div>
            <button
              onClick={onLogout}
              className="p-1 rounded-md hover:bg-white/10 text-sidebar-muted/50 hover:text-white/70 transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

// ─── Global Product Search (header) ───────────────────────────────

function ProductSearch({
  products,
  onSelectProduct,
  onSubmitQuery,
}: {
  products: Array<ProductWithRelations>
  onSelectProduct: (product: ProductWithRelations) => void
  onSubmitQuery: (query: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [products, query])

  return (
    <div className="hidden md:block relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim() && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim()) {
            onSubmitQuery(query)
            setQuery('')
            setOpen(false)
          }
        }}
        placeholder="Search products, units..."
        className="w-56 lg:w-72 h-9 pl-9 pr-3 border border-input rounded-lg text-sm bg-muted/30 focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-all"
      />
      {open && (
        <div className="absolute top-11 left-0 right-0 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              No matching products
            </div>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                onMouseDown={() => {
                  onSelectProduct(p)
                  setQuery('')
                  setOpen(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {p.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.sku} · {p.currentStock} {p.baseUnitSymbol} in stock
                  </p>
                </div>
                <Crumb className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Notifications Panel ─────────────────────────────────────────

function NotificationsBell({
  products,
  onNavigateToProducts,
}: {
  products: Array<ProductWithRelations>
  onNavigateToProducts: (searchQuery: string) => void
}) {
  const [open, setOpen] = useState(false)

  const lowStock = products.filter(
    (p) => p.currentStock <= p.minStock && p.currentStock > 0,
  )
  const outOfStock = products.filter((p) => p.currentStock === 0)
  const overstock = products.filter(
    (p) => p.maxStock > 0 && p.currentStock >= p.maxStock,
  )
  const total = lowStock.length + outOfStock.length + overstock.length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors group"
        title="Notifications"
      >
        <Bell className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center shadow-sm shadow-red-500/30">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold text-foreground">
                Notifications
              </p>
              <span className="text-[10px] text-muted-foreground">
                {total} alerts
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {total === 0 ? (
                <div className="px-4 py-10 text-center">
                  <AlertTriangle className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    All stock levels are healthy
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {outOfStock.slice(0, 5).map((p) => (
                    <NotificationRow
                      key={p.id}
                      product={p}
                      label="Out of stock"
                      className="bg-red-50/60"
                      dot="bg-red-500"
                      onClick={onNavigateToProducts}
                    />
                  ))}
                  {lowStock.slice(0, 5).map((p) => (
                    <NotificationRow
                      key={p.id}
                      product={p}
                      label="Low stock"
                      className="bg-amber-50/60"
                      dot="bg-amber-400"
                      onClick={onNavigateToProducts}
                    />
                  ))}
                  {overstock.slice(0, 3).map((p) => (
                    <NotificationRow
                      key={p.id}
                      product={p}
                      label="Overstock"
                      className="bg-blue-50/40"
                      dot="bg-blue-400"
                      onClick={onNavigateToProducts}
                    />
                  ))}
                </div>
              )}
            </div>
            {total > 0 && (
              <button
                onClick={() => {
                  setOpen(false)
                  onNavigateToProducts('')
                }}
                className="w-full py-2.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-border"
              >
                View all in Stock Overview
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function NotificationRow({
  product,
  label,
  className,
  dot,
  onClick,
}: {
  product: ProductWithRelations
  label: string
  className: string
  dot: string
  onClick: (searchQuery: string) => void
}) {
  return (
    <button
      onClick={() => onClick(product.name)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left ${className}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">
          {product.name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {label} · {product.currentStock} {product.baseUnitSymbol} in stock
        </p>
      </div>
    </button>
  )
}

// ─── Header Component ──────────────────────────────────────────────

function Header({
  activeLabel,
  onMenuClick,
  onLogout,
  products,
  onSelectProduct,
  onSearchSubmit,
  onNavigateToProducts,
}: {
  activeLabel: string
  onMenuClick: () => void
  onLogout: () => void
  products: Array<ProductWithRelations>
  onSelectProduct: (product: ProductWithRelations) => void
  onSearchSubmit: (query: string) => void
  onNavigateToProducts: (searchQuery: string) => void
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
          <Crumb className="w-3 h-3 text-muted-foreground/40" />
          <span className="font-semibold text-foreground">{activeLabel}</span>
        </nav>
        <h1 className="sm:hidden text-lg font-semibold text-foreground">
          {activeLabel}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Layout Mode Selector */}
        <LayoutModeSelector />

        {/* Global Search */}
        <ProductSearch
          products={products}
          onSelectProduct={onSelectProduct}
          onSubmitQuery={onSearchSubmit}
        />

        {/* Notifications */}
        <NotificationsBell
          products={products}
          onNavigateToProducts={onNavigateToProducts}
        />

        {/* User Avatar */}
        <div className="relative pl-2 border-l border-border">
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg hover:bg-muted transition-colors p-1"
          >
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium text-foreground">Admin</p>
              <p className="text-[10px] text-muted-foreground">Supermanager</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              A
            </div>
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 top-12 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <p className="text-sm font-semibold text-foreground">
                    Admin User
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Administrator
                  </p>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false)
                      onLogout()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Main Layout ────────────────────────────────────────────────────

export function PortfolioLayout() {
  const search = useSearch({ from: '/' })
  const [activeTab, setActiveTab] = useState('DASHBOARD')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [products, setProducts] = useState<Array<ProductWithRelations>>([])
  const [productsInitialSearch, setProductsInitialSearch] = useState<
    string | undefined
  >(undefined)
  const [focusProductId, setFocusProductId] = useState<string | null>(null)

  useEffect(() => {
    if (search?.tab && ALL_NAV_IDS.includes(search.tab))
      setActiveTab(search.tab)
  }, [search?.tab])

  // Load product data for the sidebar badge + notifications
  useEffect(() => {
    productsApi
      .getAll()
      .then(setProducts)
      .catch(() => {})
  }, [])

  const activeLabel = useMemo(() => {
    for (const group of NAV_GROUPS) {
      const found = group.items.find((n) => n.id === activeTab)
      if (found) return found.label
    }
    return 'Dashboard'
  }, [activeTab])

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    // Reset one-off navigation state so header-search results don't stick
    setProductsInitialSearch(undefined)
    setFocusProductId(null)
    window.history.replaceState({}, '', `/?tab=${tab}`)
  }, [])

  const lowStockCount = useMemo(
    () => products.filter((p) => p.currentStock <= p.minStock).length,
    [products],
  )

  const handleLogout = useCallback(() => {
    showInfo(
      'Signed in as Admin',
      'Authentication is not configured yet — this is a local single-user workspace.',
    )
  }, [])

  const handleSelectProduct = useCallback(
    (product: ProductWithRelations) => {
      handleTabChange('PRODUCTS')
      setFocusProductId(product.id)
    },
    [handleTabChange],
  )

  const handleSearchSubmit = useCallback(
    (query: string) => {
      handleTabChange('PRODUCTS')
      setProductsInitialSearch(query)
      setFocusProductId(null)
    },
    [handleTabChange],
  )

  const handleNavigateToProducts = useCallback(
    (query: string) => {
      handleTabChange('PRODUCTS')
      setProductsInitialSearch(query || undefined)
      setFocusProductId(null)
    },
    [handleTabChange],
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'DASHBOARD':
        return <DashboardOverview />
      case 'PRODUCTS':
        return (
          <ProductsSection
            initialSearch={productsInitialSearch}
            focusProductId={focusProductId}
            onFocusProductIdChange={setFocusProductId}
          />
        )
      case 'UNITS':
        return <UnitsSection />
      case 'CONVERSIONS':
        return <ConversionsSection />
      case 'SUPPLIERS':
        return <SuppliersSection />
      case 'CUSTOMERS':
        return <CustomersSection />
      case 'PURCHASES':
        return <PurchasesSection />
      case 'SALES':
        return <SalesSection />
      case 'RETURNS':
        return <ReturnsSection />
      case 'STOCK':
        return <StockOverviewSection />
      case 'REPORTS':
        return <ReportsSection />
      case 'SETTINGS':
        return <SettingsSection />
      case 'ACTIVITY':
        return <ActivityLogsSection />
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
          onLogout={handleLogout}
        />

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full">
          <Header
            activeLabel={activeLabel}
            onMenuClick={() => setSidebarOpen(true)}
            onLogout={handleLogout}
            products={products}
            onSelectProduct={handleSelectProduct}
            onSearchSubmit={handleSearchSubmit}
            onNavigateToProducts={handleNavigateToProducts}
          />

          {/* Content */}
          <main className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">{renderContent()}</div>
          </main>
        </div>
      </div>
    </LayoutModeProvider>
  )
}
