'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  Loader2,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  ProductWithRelations,
  PurchaseRow,
  SaleRow,
  TransactionRow,
} from '@/lib/api'
import { productsApi } from '@/lib/api'
import { showApiError } from '@/lib/errors'

const PIE_COLORS = [
  '#059669',
  '#10b981',
  '#34d399',
  '#6ee7b7',
  '#a7f3d0',
  '#f59e0b',
  '#ef4444',
  '#6366f1',
]

export function ReportsSection() {
  const [products, setProducts] = useState<Array<ProductWithRelations>>([])
  const [transactions, setTransactions] = useState<Array<TransactionRow>>([])
  const [purchases, setPurchases] = useState<Array<PurchaseRow>>([])
  const [sales, setSales] = useState<Array<SaleRow>>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [p, t, pu, s] = await Promise.all([
        productsApi.getAll(),
        productsApi.getTransactions(),
        productsApi.getPurchases(),
        productsApi.getSales(),
      ])
      setProducts(p)
      setTransactions(t)
      setPurchases(pu)
      setSales(s)
    } catch (err) {
      showApiError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])
  const { theme } = useTheme()

  const chartColors = useMemo(() => {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    return {
      grid: isDark ? '#1e293b' : '#e2e8f0',
      axis: isDark ? '#64748b' : '#94a3b8',
      tooltipBg: isDark ? '#131821' : '#ffffff',
      tooltipBorder: isDark ? '#1e293b' : '#e2e8f0',
    }
  }, [theme])

  // ── Derived metrics ──────────────────────────────────────────
  const stockValue = products.reduce(
    (s, p) => s + p.currentStock * p.purchasePrice,
    0,
  )
  const sellingValue = products.reduce(
    (s, p) => s + p.currentStock * p.sellingPrice,
    0,
  )
  const potentialProfit = sellingValue - stockValue

  const saleTxns = transactions.filter((t) => t.transactionType === 'sale')
  const purchaseTxns = transactions.filter(
    (t) => t.transactionType === 'purchase',
  )

  const realizedProfit = saleTxns.reduce((s, t) => {
    const product = products.find((p) => p.id === t.productId)
    if (!product) return s
    return s + (product.sellingPrice - product.purchasePrice) * t.baseQuantity
  }, 0)

  const unitsSold = saleTxns.reduce((s, t) => s + t.baseQuantity, 0)
  const unitsPurchased = purchaseTxns.reduce((s, t) => s + t.baseQuantity, 0)

  // Per-product sold quantity from sale transactions
  const soldByProduct = new Map<string, number>()
  for (const t of saleTxns) {
    soldByProduct.set(
      t.productId,
      (soldByProduct.get(t.productId) ?? 0) + t.baseQuantity,
    )
  }

  const topMovers = Array.from(soldByProduct.entries())
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
    .filter((x) => x.product)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)

  // Category distribution
  const categoryMap = new Map<string, { stock: number; value: number }>()
  for (const p of products) {
    const cur = categoryMap.get(p.category) ?? { stock: 0, value: 0 }
    cur.stock += p.currentStock
    cur.value += p.currentStock * p.purchasePrice
    categoryMap.set(p.category, cur)
  }
  const categoryData = Array.from(categoryMap.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 6)
    .map(([name, v]) => ({ name, value: v.value }))

  // Weekly activity (last 7 days)
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    const dateStr = date.toISOString().split('T')[0]
    const dayTxns = transactions.filter((t) => t.createdAt.startsWith(dateStr))
    return {
      name: date.toLocaleDateString('en-US', { weekday: 'short' }),
      purchased: dayTxns
        .filter(
          (t) =>
            t.transactionType === 'purchase' ||
            t.transactionType === 'return' ||
            t.transactionType === 'opening_stock',
        )
        .reduce((s, t) => s + t.baseQuantity, 0),
      sold: dayTxns
        .filter((t) => t.transactionType === 'sale')
        .reduce((s, t) => s + t.baseQuantity, 0),
    }
  })

  const lowStock = products.filter(
    (p) => p.currentStock <= p.minStock && p.currentStock > 0,
  )
  const outOfStock = products.filter((p) => p.currentStock === 0)
  const overstock = products.filter(
    (p) => p.maxStock > 0 && p.currentStock >= p.maxStock,
  )

  const kpis = [
    {
      label: 'Inventory Value',
      value: `₹${stockValue.toLocaleString()}`,
      sub: 'At purchase price',
      icon: Package,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Stock on Hand',
      value: `${products.reduce((s, p) => s + p.currentStock, 0).toLocaleString()}`,
      sub: 'Base units',
      icon: BarChart3,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Units Sold',
      value: unitsSold.toLocaleString(),
      sub: `${saleTxns.length} sale transactions`,
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Units Purchased',
      value: unitsPurchased.toLocaleString(),
      sub: `${purchaseTxns.length} purchase transactions`,
      icon: ShoppingCart,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Realized Profit',
      value: `₹${realizedProfit.toLocaleString()}`,
      sub: 'Cost vs. selling price',
      icon: DollarSign,
      color: realizedProfit >= 0 ? 'text-emerald-600' : 'text-red-600',
      bg: realizedProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
    {
      label: 'Potential Profit',
      value: `₹${potentialProfit.toLocaleString()}`,
      sub: 'On current stock',
      icon: DollarSign,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
  ]

  if (loading && !products.length) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Reports & Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Live insights from your inventory data
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((k, i) => (
          <div
            key={i}
            className={`${k.bg} border border-border rounded-xl p-4`}
          >
            <div className="flex items-center gap-2 mb-2">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {k.label}
              </p>
            </div>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Weekly Movement
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartColors.grid}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke={chartColors.axis}
                />
                <YAxis tick={{ fontSize: 11 }} stroke={chartColors.axis} />
                <Tooltip
                  contentStyle={{
                    background: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="purchased"
                  name="In"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="sold"
                  name="Out"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category value */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Inventory Value by Category
          </h3>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No products yet
            </p>
          ) : (
            <>
              <div className="h-56">
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
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: chartColors.tooltipBg,
                        border: `1px solid ${chartColors.tooltipBorder}`,
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(v) => [
                        `₹${Number(v).toLocaleString()}`,
                        'Value',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {categoryData.map((c, i) => (
                  <span
                    key={c.name}
                    className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                    {c.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top movers */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Top Selling Products
          </h3>
          {topMovers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No sales yet
            </p>
          ) : (
            <div className="space-y-2">
              {topMovers.map(
                (m, i) =>
                  m.product && (
                    <div
                      key={m.product.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {m.product.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {m.product.sku}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-blue-600 shrink-0">
                        {m.qty.toLocaleString()}
                      </span>
                    </div>
                  ),
              )}
            </div>
          )}
        </div>

        {/* Stock health */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Stock Health
          </h3>
          <div className="space-y-3">
            <HealthRow
              label="Healthy"
              count={
                products.length -
                lowStock.length -
                outOfStock.length -
                overstock.length
              }
              color="text-emerald-600"
              bg="bg-emerald-100"
            />
            <HealthRow
              label="Low Stock"
              count={lowStock.length}
              color="text-amber-600"
              bg="bg-amber-100"
            />
            <HealthRow
              label="Out of Stock"
              count={outOfStock.length}
              color="text-red-600"
              bg="bg-red-100"
            />
            <HealthRow
              label="Overstock"
              count={overstock.length}
              color="text-blue-600"
              bg="bg-blue-100"
            />
            <div className="pt-2">
              <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                {products.length > 0 && (
                  <>
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${(Math.max(products.length - lowStock.length - outOfStock.length - overstock.length, 0) / products.length) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-amber-400 h-full"
                      style={{
                        width: `${(lowStock.length / products.length) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-red-500 h-full"
                      style={{
                        width: `${(outOfStock.length / products.length) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-blue-400 h-full"
                      style={{
                        width: `${(overstock.length / products.length) * 100}%`,
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-orange-500" />
            Orders
          </h3>
          <div className="space-y-3">
            <OrderRow
              icon={ShoppingCart}
              label="Purchase Orders"
              count={purchases.length}
              note={`${purchases.reduce((s, p) => s + p.totalItems, 0)} line items`}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <OrderRow
              icon={Receipt}
              label="Sales Orders"
              count={sales.length}
              note={`${sales.reduce((s, p) => s + p.totalItems, 0)} line items`}
              color="text-orange-600"
              bg="bg-orange-50"
            />
            <OrderRow
              icon={AlertTriangle}
              label="Return Movements"
              count={
                transactions.filter((t) => t.transactionType === 'return')
                  .length
              }
              note="restocked"
              color="text-purple-600"
              bg="bg-purple-50"
            />
            <OrderRow
              icon={ArrowUpRight}
              label="Average Sale Size"
              count={
                saleTxns.length > 0
                  ? `${(unitsSold / saleTxns.length).toFixed(1)}`
                  : '0'
              }
              note="base units per sale"
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <OrderRow
              icon={ArrowDownRight}
              label="Average Purchase Size"
              count={
                purchaseTxns.length > 0
                  ? `${(unitsPurchased / purchaseTxns.length).toFixed(1)}`
                  : '0'
              }
              note="base units per purchase"
              color="text-violet-600"
              bg="bg-violet-50"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function HealthRow({
  label,
  count,
  color,
  bg,
}: {
  label: string
  count: number
  color: string
  bg: string
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bg} ${color}`}
      >
        {count}
      </span>
    </div>
  )
}

function OrderRow({
  icon: Icon,
  label,
  count,
  note,
  color,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: string | number
  note: string
  color: string
  bg: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
      <div
        className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}
      >
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{note}</p>
      </div>
      <span className={`text-sm font-bold ${color}`}>{count}</span>
    </div>
  )
}
