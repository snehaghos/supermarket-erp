"use client"

import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  Ruler, Package, ArrowRightLeft,
  AlertTriangle, BarChart3,
  DollarSign, Clock, Activity,
  RefreshCw, ArrowUpRight, ArrowDownRight,
  ShoppingCart, Receipt, Truck, Weight, Droplets,
  Boxes, LayoutGrid,
} from "lucide-react"
import { unitsApi, conversionsApi, productsApi } from "@/lib/api"
import type { UnitRow, ConversionRow, ProductWithRelations, TransactionRow } from "@/lib/api"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"

const PIE_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#f59e0b', '#ef4444']
const CHART_GREEN = '#059669'

export default function DashboardOverview() {
  const navigate = useNavigate()
  const [units, setUnits] = useState<UnitRow[]>([])
  const [conversions, setConversions] = useState<ConversionRow[]>([])
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setDashboardError(null)
    try {
      const [u, c, p, t] = await Promise.allSettled([
        unitsApi.getAll(),
        conversionsApi.getAll(),
        productsApi.getAll(),
        productsApi.getTransactions(),
      ])
      if (u.status === 'fulfilled') setUnits(u.value)
      if (c.status === 'fulfilled') setConversions(c.value)
      if (p.status === 'fulfilled') setProducts(p.value)
      if (t.status === 'fulfilled') setTransactions(t.value as TransactionRow[])
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived KPIs ──────────────────────────────────────────────

  const activeProducts = products.filter(p => p.status === 'active')
  const lowStockProducts = products.filter(p => p.currentStock <= p.minStock && p.currentStock > 0)
  const outOfStockProducts = products.filter(p => p.currentStock === 0)
  const overstockProducts = products.filter(p => p.maxStock > 0 && p.currentStock >= p.maxStock)
  const totalStock = products.reduce((sum, p) => sum + p.currentStock, 0)
  const totalStockValue = products.reduce((sum, p) => sum + (p.currentStock * p.purchasePrice), 0)
  const totalSellingValue = products.reduce((sum, p) => sum + (p.currentStock * p.sellingPrice), 0)
  const potentialProfit = totalSellingValue - totalStockValue

  // Today's transactions
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTransactions = transactions.filter(t => t.createdAt.startsWith(todayStr))
  const todayPurchases = todayTransactions.filter(t => t.transactionType === 'purchase')
  const todaySales = todayTransactions.filter(t => t.transactionType === 'sale')
  const todayPurchaseQty = todayPurchases.reduce((s, t) => s + t.baseQuantity, 0)
  const todaySaleQty = todaySales.reduce((s, t) => s + t.baseQuantity, 0)

  // Weekly data for chart (dynamically generated labels)
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    const dateStr = date.toISOString().split('T')[0]
    const dayTxns = transactions.filter(t => t.createdAt.startsWith(dateStr))
    return {
      name: date.toLocaleDateString('en-US', { weekday: 'short' }),
      purchases: dayTxns.filter(t => t.transactionType === 'purchase').reduce((s, t) => s + t.baseQuantity, 0),
      sales: dayTxns.filter(t => t.transactionType === 'sale').reduce((s, t) => s + t.baseQuantity, 0),
    }
  })

  // Category distribution
  const categoryMap = new Map<string, number>()
  for (const p of activeProducts) {
    categoryMap.set(p.category, (categoryMap.get(p.category) || 0) + p.currentStock)
  }
  const categoryData = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }))

  // Recent transactions
  const recentTransactions = transactions.slice(0, 8)

  // ── KPI Cards ─────────────────────────────────────────────────

  const kpiCards = [
    {
      label: 'Total Products',
      value: activeProducts.length,
      sub: `${products.length} total · ${outOfStockProducts.length} out of stock`,
      icon: Package,
      trend: activeProducts.length > 0 ? 'up' as const : 'neutral' as const,
      trendValue: `${((activeProducts.length / (products.length || 1)) * 100).toFixed(0)}% active`,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-500',
    },
    {
      label: 'Stock Value',
      value: `₹${totalStockValue.toLocaleString()}`,
      sub: `${totalStock.toLocaleString()} units in stock`,
      icon: DollarSign,
      trend: 'up' as const,
      trendValue: `₹${potentialProfit.toLocaleString()} potential profit`,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-500',
    },
    {
      label: 'Low Stock Alerts',
      value: lowStockProducts.length + outOfStockProducts.length,
      sub: `${lowStockProducts.length} low · ${outOfStockProducts.length} out of stock`,
      icon: AlertTriangle,
      trend: (lowStockProducts.length + outOfStockProducts.length) > 0 ? 'down' as const : 'up' as const,
      trendValue: (lowStockProducts.length + outOfStockProducts.length) > 0 ? 'Needs attention' : 'All stocked',
      color: (lowStockProducts.length + outOfStockProducts.length) > 0 ? 'text-amber-600' : 'text-emerald-600',
      bg: (lowStockProducts.length + outOfStockProducts.length) > 0 ? 'bg-amber-50' : 'bg-emerald-50',
      iconBg: (lowStockProducts.length + outOfStockProducts.length) > 0 ? 'bg-amber-500' : 'bg-emerald-500',
    },
    {
      label: 'Today\'s Activity',
      value: todayTransactions.length,
      sub: `${todayPurchaseQty} purchased · ${todaySaleQty} sold`,
      icon: Activity,
      trend: todayTransactions.length > 0 ? 'up' as const : 'neutral' as const,
      trendValue: todayTransactions.length > 0 ? 'Active today' : 'No activity yet',
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      iconBg: 'bg-violet-500',
    },
  ]



  // ── Skeleton ──────────────────────────────────────────────────

  if (loading && !products.length) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Loading your inventory data...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-5">
              <div className="w-10 h-10 bg-muted rounded-lg mb-3 animate-pulse" />
              <div className="h-6 w-20 bg-muted rounded animate-pulse mb-2" />
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {dashboardError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {dashboardError}
          <button onClick={() => setDashboardError(null)} className="ml-auto p-1 rounded hover:bg-red-100 transition-colors">
            ✕
          </button>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <div
            key={i}
            className="group bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:border-emerald-200/50 transition-all duration-200 relative overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br from-transparent to-emerald-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              {card.trend && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                  card.trend === 'up' ? 'text-emerald-600' :
                  card.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {card.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> :
                   card.trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground group-hover:text-emerald-700 transition-colors">
              {card.value}
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{card.label}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Units by Type + Charts Row ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Units by Type (restored from original) */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-emerald-500" />
            Units by Type
          </h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
          ) : units.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No units defined yet</p>
          ) : (
            <div className="space-y-2">
              {(['Count', 'Weight', 'Volume', 'Length', 'Area', 'Packaging'] as const).map(type => {
                const count = units.filter(u => u.type === type).length
                const maxCount = Math.max(...['Count', 'Weight', 'Volume', 'Length', 'Area', 'Packaging'].map(t => units.filter(u => u.type === t).length), 1)
                const TypeIcon = {
                  Count: Boxes, Weight, Volume: Droplets,
                  Length: Ruler, Area: LayoutGrid, Packaging: Package,
                }[type]
                return (
                  <div key={type} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <TypeIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{type}</span>
                        <span className="text-xs font-semibold text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Weekly Activity Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Weekly Activity
            </h3>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Purchases
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                Sales
              </span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="saleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  stroke={CHART_GREEN}
                  fill="url(#purchaseGrad)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_GREEN }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#f97316"
                  fill="url(#saleGrad)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f97316' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Stock by Category
          </h3>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No products yet</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [`${value} units`, 'Stock']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {categoryData.map((cat, i) => (
                  <span
                    key={cat.name}
                    className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {cat.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Two-Column: Alerts + Recent Activity ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Alerts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Stock Alerts
            {(lowStockProducts.length + outOfStockProducts.length) > 0 && (
              <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {lowStockProducts.length + outOfStockProducts.length} alerts
              </span>
            )}
          </h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No products yet. Create products to see stock alerts.</p>
          ) : lowStockProducts.length === 0 && outOfStockProducts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-emerald-700">All Stock Levels Healthy</p>
              <p className="text-xs text-muted-foreground mt-1">No low stock or out-of-stock items</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...outOfStockProducts, ...lowStockProducts].slice(0, 6).map(p => {
                const stockPercent = p.maxStock > 0 ? (p.currentStock / p.maxStock) * 100 : 0
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate({ to: '/', search: { tab: 'PRODUCTS' } })}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${p.currentStock === 0 ? 'bg-red-500' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                        <span className={`text-xs font-semibold shrink-0 ml-2 ${p.currentStock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {p.currentStock} {p.baseUnitSymbol}
                        </span>
                      </div>
                      {p.maxStock > 0 && (
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              p.currentStock === 0 ? 'bg-red-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${Math.min(stockPercent, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                      p.currentStock === 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.currentStock === 0 ? 'Out' : 'Low'}
                    </span>
                  </div>
                )
              })}
              {(lowStockProducts.length + outOfStockProducts.length) > 6 && (
                <button
                  onClick={() => navigate({ to: '/', search: { tab: 'PRODUCTS' } })}
                  className="w-full text-center text-xs text-emerald-600 hover:text-emerald-700 font-medium py-2 transition-colors"
                >
                  View all {lowStockProducts.length + outOfStockProducts.length} alerts →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Recent Activity
          </h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
          ) : recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No recent activity. Start by adding products and making transactions.</p>
          ) : (
            <div className="space-y-1">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    tx.transactionType === 'purchase' ? 'bg-emerald-100 text-emerald-700' :
                    tx.transactionType === 'sale' ? 'bg-orange-100 text-orange-700' :
                    tx.transactionType === 'opening_stock' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {tx.transactionType === 'purchase' ? <ShoppingCart className="w-4 h-4" /> :
                     tx.transactionType === 'sale' ? <Receipt className="w-4 h-4" /> :
                     <ArrowRightLeft className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground capitalize">
                      {tx.transactionType.replace('_', ' ')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {tx.baseQuantity > 0 ? '+' : ''}{tx.baseQuantity} {tx.unitSymbol}
                      {tx.notes ? ` · ${tx.notes}` : ''}
                    </p>
                  </div>
                  <time className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats + Quick Actions ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Quick Stats
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground">Avg Stock per Product</span>
              <span className="text-xs font-semibold text-foreground">
                {activeProducts.length > 0 ? (totalStock / activeProducts.length).toFixed(1) : '0'} units
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground">Overstock Products</span>
              <span className={`text-xs font-semibold ${overstockProducts.length > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                {overstockProducts.length}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground">Conversion Coverage</span>
              <span className="text-xs font-semibold text-foreground">
                {units.length > 0 ? `${((conversions.length / Math.max(units.length - 1, 1)) * 100).toFixed(0)}%` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Profit Margin</span>
              <span className={`text-xs font-semibold ${potentialProfit > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {totalStockValue > 0 ? `${((potentialProfit / totalStockValue) * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ActionCard
              icon={Package}
              label="New Product"
              desc="Add to inventory"
              color="text-emerald-500"
              bg="hover:bg-emerald-50/50 hover:border-emerald-200"
              onClick={() => navigate({ to: '/', search: { tab: 'PRODUCTS' } })}
            />
            <ActionCard
              icon={ShoppingCart}
              label="Purchase"
              desc="Buy stock"
              color="text-blue-500"
              bg="hover:bg-blue-50/50 hover:border-blue-200"
              onClick={() => navigate({ to: '/', search: { tab: 'PRODUCTS' } })}
            />
            <ActionCard
              icon={Receipt}
              label="Sell"
              desc="Process sale"
              color="text-orange-500"
              bg="hover:bg-orange-50/50 hover:border-orange-200"
              onClick={() => navigate({ to: '/', search: { tab: 'PRODUCTS' } })}
            />
            <ActionCard
              icon={Ruler}
              label="New Unit"
              desc="Add measurement"
              color="text-emerald-500"
              bg="hover:bg-emerald-50/50 hover:border-emerald-200"
              onClick={() => navigate({ to: '/', search: { tab: 'UNITS' } })}
            />
            <ActionCard
              icon={ArrowRightLeft}
              label="Conversion"
              desc="Link units"
              color="text-violet-500"
              bg="hover:bg-violet-50/50 hover:border-violet-200"
              onClick={() => navigate({ to: '/', search: { tab: 'CONVERSIONS' } })}
            />
            <ActionCard
              icon={Truck}
              label="Suppliers"
              desc="Manage vendors"
              color="text-sky-500"
              bg="hover:bg-sky-50/50 hover:border-sky-200"
              onClick={() => navigate({ to: '/', search: { tab: 'SUPPLIERS' } })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Action Card Sub-Component ─────────────────────────────────────

function ActionCard({
  icon: Icon, label, desc, color, bg, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  desc: string
  color: string
  bg: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl border border-border transition-all duration-200 group text-left ${bg}`}
    >
      <div className={`w-9 h-9 rounded-lg bg-white border border-border/50 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
    </button>
  )
}
