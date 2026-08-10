'use client'

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  DollarSign,
  Eye,
  Package,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react'
import type { DisplayStock, ProductWithRelations } from '@/lib/api'
import { productsApi } from '@/lib/api'

export function StockOverviewSection() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Array<ProductWithRelations>>([])
  const [displayStocks, setDisplayStocks] = useState<
    Record<string, DisplayStock>
  >({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out' | 'overstock'>(
    'all',
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const prodData = await productsApi.getAll()
      setProducts(prodData)

      const stockPromises = prodData.map(async (p) => {
        try {
          const stock = await productsApi.getDisplayStock(p.id)
          return { id: p.id, stock }
        } catch {
          return { id: p.id, stock: null }
        }
      })
      const stockResults = await Promise.all(stockPromises)
      const stockMap: Record<string, DisplayStock> = {}
      for (const r of stockResults) {
        if (r.stock) stockMap[r.id] = r.stock
      }
      setDisplayStocks(stockMap)
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false
    if (filter === 'low')
      return p.currentStock <= p.minStock && p.currentStock > 0
    if (filter === 'out') return p.currentStock === 0
    if (filter === 'overstock')
      return p.maxStock > 0 && p.currentStock >= p.maxStock
    return true
  })

  const totalStockValue = products.reduce(
    (s, p) => s + p.currentStock * p.purchasePrice,
    0,
  )
  const lowStockCount = products.filter(
    (p) => p.currentStock <= p.minStock && p.currentStock > 0,
  ).length
  const outOfStockCount = products.filter((p) => p.currentStock === 0).length

  const FILTERS: Array<{ value: typeof filter; label: string; count: number }> =
    [
      { value: 'all', label: 'All Items', count: products.length },
      { value: 'low', label: 'Low Stock', count: lowStockCount },
      { value: 'out', label: 'Out of Stock', count: outOfStockCount },
    ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Stock Overview</h2>
          <p className="text-sm text-muted-foreground">
            {products.length} products · ₹{totalStockValue.toLocaleString()}{' '}
            total value
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Products"
          value={products.length}
          sub={`${products.filter((p) => p.status === 'active').length} active`}
          icon={Package}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <SummaryCard
          label="Stock Value"
          value={`₹${totalStockValue.toLocaleString()}`}
          sub="At purchase price"
          icon={DollarSign}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <SummaryCard
          label="Low Stock"
          value={lowStockCount}
          sub={`${outOfStockCount} out of stock`}
          icon={AlertTriangle}
          color={lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
          bg={lowStockCount > 0 ? 'bg-amber-50' : 'bg-emerald-50'}
        />
        <SummaryCard
          label="Total Units"
          value={products
            .reduce((s, p) => s + p.currentStock, 0)
            .toLocaleString()}
          sub="Across all products"
          icon={TrendingUp}
          color="text-violet-600"
          bg="bg-violet-50"
        />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f.value
                  ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                    filter === f.value
                      ? 'bg-emerald-200 text-emerald-800'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? 'No matching products' : 'No products available yet'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Current Stock</th>
                  <th>Stock Level</th>
                  <th>Status</th>
                  <th>Value</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const stock = displayStocks[product.id]
                  const stockPercent =
                    product.maxStock > 0
                      ? (product.currentStock / product.maxStock) * 100
                      : 0
                  const isLow =
                    product.currentStock <= product.minStock &&
                    product.currentStock > 0
                  const isOut = product.currentStock === 0
                  const isOver =
                    product.maxStock > 0 &&
                    product.currentStock >= product.maxStock

                  return (
                    <tr
                      key={product.id}
                      className={
                        isOut
                          ? 'bg-red-50/50'
                          : isLow
                            ? 'bg-amber-50/50'
                            : isOver
                              ? 'bg-blue-50/30'
                              : ''
                      }
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              {product.name}
                            </p>
                            {product.category && (
                              <p className="text-[10px] text-muted-foreground">
                                {product.category}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">
                          {product.sku}
                        </code>
                      </td>
                      <td>
                        <span
                          className={`text-sm font-semibold ${
                            isOut
                              ? 'text-red-600'
                              : isLow
                                ? 'text-amber-600'
                                : 'text-foreground'
                          }`}
                        >
                          {stock?.displayText ??
                            `${product.currentStock} ${product.baseUnitSymbol}`}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isOut
                                  ? 'bg-red-500'
                                  : isLow
                                    ? 'bg-amber-400'
                                    : isOver
                                      ? 'bg-blue-400'
                                      : 'bg-emerald-400'
                              }`}
                              style={{
                                width: `${Math.min(stockPercent, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-8 text-right">
                            {Math.round(stockPercent)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            product.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : product.status === 'inactive'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              product.status === 'active'
                                ? 'bg-emerald-500'
                                : product.status === 'inactive'
                                  ? 'bg-gray-400'
                                  : 'bg-red-400'
                            }`}
                          />
                          {product.status}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-medium text-foreground">
                          ₹
                          {(
                            product.currentStock * product.purchasePrice
                          ).toLocaleString()}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() =>
                            navigate({ to: '/', search: { tab: 'PRODUCTS' } })
                          }
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
                          title="View Product Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  bg,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
}) {
  return (
    <div className={`${bg} border border-border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}
