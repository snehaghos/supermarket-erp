'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Edit2,
  Loader2,
  PackagePlus,
  Receipt,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  ShoppingCart,
} from 'lucide-react'
import type { TransactionRow } from '@/lib/api'
import { productsApi } from '@/lib/api'
import { showApiError } from '@/lib/errors'

type TypeFilter = 'all' | TransactionRow['transactionType']

const TYPE_META: Record<
  TransactionRow['transactionType'],
  {
    label: string
    bg: string
    dot: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  purchase: {
    label: 'Purchase',
    bg: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    icon: ShoppingCart,
  },
  sale: {
    label: 'Sale',
    bg: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
    icon: Receipt,
  },
  adjustment: {
    label: 'Adjustment',
    bg: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
    icon: Edit2,
  },
  opening_stock: {
    label: 'Opening Stock',
    bg: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
    icon: PackagePlus,
  },
  return: {
    label: 'Return',
    bg: 'bg-purple-100 text-purple-700',
    dot: 'bg-purple-500',
    icon: RotateCcw,
  },
}

export function ActivityLogsSection() {
  const [transactions, setTransactions] = useState<Array<TransactionRow>>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      setTransactions(await productsApi.getTransactions())
    } catch (err) {
      showApiError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const counts = transactions.reduce<Record<TypeFilter, number>>(
    (acc, t) => {
      acc.all++
      acc[t.transactionType]++
      return acc
    },
    {
      all: 0,
      purchase: 0,
      sale: 0,
      adjustment: 0,
      opening_stock: 0,
      return: 0,
    },
  )

  const filtered = transactions.filter(
    (t) =>
      (filter === 'all' || t.transactionType === filter) &&
      (search === '' ||
        t.productName.toLowerCase().includes(search.toLowerCase()) ||
        (t.notes ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.referenceId ?? '').toLowerCase().includes(search.toLowerCase())),
  )

  const FILTERS: Array<{ value: TypeFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'purchase', label: 'Purchases' },
    { value: 'sale', label: 'Sales' },
    { value: 'return', label: 'Returns' },
    { value: 'adjustment', label: 'Adjustments' },
    { value: 'opening_stock', label: 'Opening' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Activity Logs</h2>
          <p className="text-sm text-muted-foreground">
            Audit trail of every stock movement
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 flex-wrap">
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
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                  filter === f.value
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {counts[f.value]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product, note, reference..."
            className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <ScrollText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search || filter !== 'all'
              ? 'No matching activity'
              : 'No activity yet. Stock movements will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Previous</th>
                  <th>Remaining</th>
                  <th>Reference</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const meta = TYPE_META[tx.transactionType]
                  const Icon = meta.icon
                  const isInbound =
                    tx.transactionType === 'purchase' ||
                    tx.transactionType === 'return' ||
                    tx.transactionType === 'opening_stock'
                  const isAdjustment = tx.transactionType === 'adjustment'
                  return (
                    <tr key={tx.id}>
                      <td>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${meta.bg}`}
                        >
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-medium text-foreground">
                          {tx.productName || tx.productId.slice(0, 8)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`text-xs font-semibold ${
                            isInbound
                              ? 'text-emerald-600'
                              : isAdjustment
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {isInbound ? '+' : ''}
                          {tx.baseQuantity}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-muted-foreground">
                          {tx.unitSymbol}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-muted-foreground">
                          {tx.previousStock}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-medium">
                          {tx.remainingStock}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-mono text-muted-foreground">
                          {tx.referenceId ? tx.referenceId.slice(0, 8) : '-'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {tx.notes || '-'}
                        </span>
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
