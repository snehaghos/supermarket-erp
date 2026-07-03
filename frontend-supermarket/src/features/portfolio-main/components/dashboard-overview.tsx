"use client"

import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  Ruler, GitCompare, Package, ArrowRightLeft, ChevronRight,
  Boxes, Weight, Droplets, Ruler as RulerIcon,
} from "lucide-react"
import { unitsApi, conversionsApi } from "@/lib/api"
import type { UnitRow, ConversionRow } from "@/lib/api"

export default function DashboardOverview() {
  const navigate = useNavigate()
  const [units, setUnits] = useState<UnitRow[]>([])
  const [conversions, setConversions] = useState<ConversionRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [u, c] = await Promise.allSettled([
        unitsApi.getAll(),
        conversionsApi.getAll(),
      ])
      if (u.status === 'fulfilled') setUnits(u.value)
      if (c.status === 'fulfilled') setConversions(c.value)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const activeUnits = units.filter(u => u.status === 'active')
  const typeCounts = {
    Packaging: units.filter(u => u.type === 'Packaging').length,
    Quantity: units.filter(u => u.type === 'Quantity').length,
    Weight: units.filter(u => u.type === 'Weight').length,
    Volume: units.filter(u => u.type === 'Volume').length,
    Length: units.filter(u => u.type === 'Length').length,
  }

  const statCards = [
    {
      label: 'Total Units',
      value: units.length,
      sub: `${activeUnits.length} active`,
      icon: Ruler,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Conversions',
      value: conversions.length,
      sub: 'defined relationships',
      icon: ArrowRightLeft,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Max Chain Depth',
      value: activeUnits.length > 0 ? Math.min(activeUnits.length - 1, 3) : 0,
      sub: 'longest conversion chain',
      icon: GitCompare,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Unit Types',
      value: Object.values(typeCounts).filter(c => c > 0).length,
      sub: ['Packaging', 'Quantity', 'Weight', 'Volume', 'Length'].slice(0, Object.values(typeCounts).filter(c => c > 0).length).join(', '),
      icon: Boxes,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ]

  const typeIcons: Record<string, any> = {
    Packaging: Package,
    Quantity: Boxes,
    Weight: Weight,
    Volume: Droplets,
    Length: RulerIcon,
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Supermarket inventory units &amp; conversion management</p>
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
              {(['Packaging', 'Quantity', 'Weight', 'Volume', 'Length'] as const).map(type => {
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

        {/* Recent Conversions */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-violet-500" />
            Recent Conversions
          </h3>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
            </div>
          ) : conversions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No conversions defined yet</p>
          ) : (
            <div className="space-y-2">
              {conversions.slice(0, 5).map(conv => (
                <div key={conv.id} className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium text-foreground">{conv.parentUnitName}</span>
                  <span className="text-xs text-muted-foreground">({conv.parentUnitSymbol})</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-sm font-semibold text-emerald-600">×{conv.factor}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{conv.childUnitName}</span>
                  <span className="text-xs text-muted-foreground">({conv.childUnitSymbol})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            onClick={() => navigate({ to: '/', search: { tab: 'CONVERSIONS' } })}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-blue-200 hover:bg-blue-50/50 transition-all group text-left"
          >
            <ArrowRightLeft className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Preview Chain</p>
              <p className="text-xs text-muted-foreground">Trace conversion chain down units</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
