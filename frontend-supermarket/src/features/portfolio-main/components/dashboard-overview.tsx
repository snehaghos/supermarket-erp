"use client"

import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  Ruler, GitCompare, Package, ArrowRightLeft,
  Boxes, Weight, Droplets, Ruler as RulerIcon, LayoutGrid,
  ShoppingBag, TrendingUp, AlertTriangle, BarChart3,
} from "lucide-react"
import { unitsApi, conversionsApi, productsApi } from "@/lib/api"
import type { UnitRow, ConversionRow, ProductWithRelations } from "@/lib/api"

export default function DashboardOverview() {
  const navigate = useNavigate()
  const [units, setUnits] = useState<UnitRow[]>([])
  const [conversions, setConversions] = useState<ConversionRow[]>([])
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [u, c, p] = await Promise.allSettled([
        unitsApi.getAll(),
        conversionsApi.getAll(),
        productsApi.getAll(),
      ])
      if (u.status === 'fulfilled') setUnits(u.value)
      if (c.status === 'fulfilled') setConversions(c.value)
      if (p.status === 'fulfilled') setProducts(p.value)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const activeProducts = products.filter(p => p.status === 'active')
  const lowStockProducts = products.filter(p => p.currentStock <= p.minStock && p.currentStock > 0)
  const outOfStockProducts = products.filter(p => p.currentStock === 0)
  const totalStockValue = products.reduce((sum, p) => sum + p.currentStock, 0)

  const typeCounts = {
    Count: units.filter(u => u.type === 'Count').length,
    Weight: units.filter(u => u.type === 'Weight').length,
    Volume: units.filter(u => u.type === 'Volume').length,
    Length: units.filter(u => u.type === 'Length').length,
    Area: units.filter(u => u.type === 'Area').length,
    Packaging: units.filter(u => u.type === 'Packaging').length,
  }

  const statCards = [
    {
      label: 'Products',
      value: activeProducts.length,
      sub: `${products.length} total`,
      icon: Package,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Total Stock',
      value: totalStockValue.toLocaleString(),
      sub: 'in base units',
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Low Stock',
      value: lowStockProducts.length,
      sub: `${outOfStockProducts.length} out of stock`,
      icon: AlertTriangle,
      color: lowStockProducts.length > 0 ? 'text-amber-600' : 'text-emerald-600',
      bg: lowStockProducts.length > 0 ? 'bg-amber-50' : 'bg-emerald-50',
    },
    {
      label: 'Conversions',
      value: conversions.length,
      sub: 'defined relationships',
      icon: ArrowRightLeft,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ]

  const typeIcons: Record<string, any> = {
    Count: Boxes,
    Weight: Weight,
    Volume: Droplets,
    Length: RulerIcon,
    Area: LayoutGrid,
    Packaging: Package,
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Supermarket inventory management system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loading ? (
                <span className="inline-block w-8 h-6 bg-muted rounded animate-pulse" />
              ) : (
                card.value
              )}
            </p>
            <p className="text-sm font-medium text-muted-foreground mt-0.5">{card.label}</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unit Types Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-emerald-500" />
            Units by Type
          </h3>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : units.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No units defined yet</p>
          ) : (
            <div className="space-y-2">
              {(['Count', 'Weight', 'Volume', 'Length', 'Area', 'Packaging'] as const).map(type => {
                const count = typeCounts[type]
                const Icon = typeIcons[type]
                const maxCount = Math.max(...Object.values(typeCounts), 1)
                return (
                  <div key={type} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="w-4 h-4 text-muted-foreground" />
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

        {/* Low Stock Alerts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Stock Alerts
          </h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No products yet</p>
          ) : lowStockProducts.length === 0 && outOfStockProducts.length === 0 ? (
            <p className="text-sm text-emerald-600 text-center py-8 flex items-center justify-center gap-2">
              <BarChart3 className="w-4 h-4" /> All products have sufficient stock
            </p>
          ) : (
            <div className="space-y-1">
              {[...outOfStockProducts, ...lowStockProducts].slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${p.currentStock === 0 ? 'bg-red-500' : 'bg-amber-400'}`} />
                    <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold ${p.currentStock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {p.currentStock} {p.baseUnitSymbol}
                    </span>
                    {p.currentStock === 0 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Out</span>}
                    {p.currentStock > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Low</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <button
            onClick={() => navigate({ to: '/', search: { tab: 'PRODUCTS' } })}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-emerald-200 hover:bg-emerald-50/50 transition-all group text-left"
          >
            <Package className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Manage Products</p>
              <p className="text-xs text-muted-foreground">Create and manage inventory</p>
            </div>
          </button>
          <button
            onClick={() => navigate({ to: '/', search: { tab: 'UNITS' } })}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-emerald-200 hover:bg-emerald-50/50 transition-all group text-left"
          >
            <Ruler className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Manage Units</p>
              <p className="text-xs text-muted-foreground">Create and edit measurement units</p>
            </div>
          </button>
          <button
            onClick={() => navigate({ to: '/', search: { tab: 'CONVERSIONS' } })}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-violet-200 hover:bg-violet-50/50 transition-all group text-left"
          >
            <GitCompare className="w-5 h-5 text-violet-500 group-hover:scale-110 transition-transform shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Define Conversions</p>
              <p className="text-xs text-muted-foreground">Link units with conversion factors</p>
            </div>
          </button>
          <button
            onClick={() => navigate({ to: '/', search: { tab: 'PRODUCTS' } })}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-blue-200 hover:bg-blue-50/50 transition-all group text-left"
          >
            <ShoppingBag className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Purchase / Sell</p>
              <p className="text-xs text-muted-foreground">Buy stock or process sales</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
