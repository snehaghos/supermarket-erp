'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeftRight,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
  X,
} from 'lucide-react'
import type { ProductWithRelations, TransactionRow } from '@/lib/api'
import { productsApi } from '@/lib/api'
import { showApiError, showSuccess } from '@/lib/errors'
import { StatCard } from '@/features/common/components/stat-card'

export function ReturnsSection() {
  const [returns, setReturns] = useState<Array<TransactionRow>>([])
  const [products, setProducts] = useState<Array<ProductWithRelations>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [txns, prodData] = await Promise.all([
        productsApi.getTransactions(),
        productsApi.getAll(),
      ])
      setReturns(txns.filter((t) => t.transactionType === 'return'))
      setProducts(prodData)
    } catch (err) {
      showApiError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = returns.filter(
    (r) =>
      r.productName.toLowerCase().includes(search.toLowerCase()) ||
      (r.notes ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const unitsReturned = returns.reduce((s, r) => s + r.baseQuantity, 0)
  const distinctProducts = new Set(returns.map((r) => r.productId)).size

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Returns</h2>
          <p className="text-sm text-muted-foreground">
            Customer and supplier returns — restocked with a full audit trail
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Record Return
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Returns"
          value={returns.length}
          sub="All time"
          icon={RotateCcw}
          color="text-purple-600"
          bg="bg-purple-50"
        />
        <StatCard
          label="Units Restocked"
          value={unitsReturned.toLocaleString()}
          sub="In base units"
          icon={Package}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          label="Products"
          value={distinctProducts}
          sub="with returns"
          icon={Users}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          label="Catalog Size"
          value={products.length}
          sub="available products"
          icon={Package}
          color="text-slate-600"
          bg="bg-slate-50"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search returns..."
          className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <ArrowLeftRight className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search
              ? 'No matching returns'
              : 'No returns yet. Record a return to restock inventory with an audit trail.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Base Qty</th>
                  <th>Stock After</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-medium text-foreground">
                        {r.productName || r.productId.slice(0, 8)}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-semibold text-emerald-600">
                        +{r.unitQuantity}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-muted-foreground">
                        {r.unitSymbol}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-muted-foreground">
                        {r.baseQuantity}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-medium">
                        {r.remainingStock}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {r.notes || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Return Modal */}
      {showForm && (
        <ReturnForm
          products={products}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

function ReturnForm({
  products,
  onClose,
  onSuccess,
}: {
  products: Array<ProductWithRelations>
  onClose: () => void
  onSuccess: () => void
}) {
  const [productId, setProductId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('Customer return')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const product = products.find((p) => p.id === productId)
  const selectedUnit = product?.units.find((u) => u.unitId === unitId)
  const totalInBase = selectedUnit
    ? quantity * selectedUnit.factorToBase
    : quantity

  const selectProduct = (id: string) => {
    setProductId(id)
    const p = products.find((x) => x.id === id)
    setUnitId(p?.baseUnitId ?? '')
  }

  const handleSave = async () => {
    if (!productId || !unitId || quantity <= 0) return
    setSaving(true)
    try {
      await productsApi.returnStock({
        productId,
        unitId,
        quantity,
        customerName,
        reason,
        notes,
      })
      showSuccess(
        'Return recorded',
        `${quantity} ${selectedUnit?.unitSymbol ?? 'units'} restocked.`,
      )
      onSuccess()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
              R
            </span>
            Record Return
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Product
          </label>
          <select
            value={productId}
            onChange={(e) => selectProduct(e.target.value)}
            className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a product...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>

        {product && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Unit
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {product.units.map((u) => (
                  <option key={u.unitId} value={u.unitId}>
                    {u.unitName} ({u.unitSymbol})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="0.001"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {product && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option>Customer return</option>
              <option>Damaged goods</option>
              <option>Wrong item delivered</option>
              <option>Expired / near expiry</option>
              <option>Supplier return</option>
              <option>Other</option>
            </select>
          </div>
        )}

        {product && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Customer
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name (optional)"
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Notes
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note"
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {selectedUnit && (
          <div className="bg-purple-50 rounded-lg p-3 flex justify-between text-xs text-purple-800">
            <span>
              Restocks: {totalInBase} {product?.baseUnitSymbol}
            </span>
            <span className="font-medium">
              {quantity} {selectedUnit.unitSymbol}
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !productId || !unitId || quantity <= 0}
            className="flex items-center gap-2 bg-purple-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 shadow-sm"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Record Return
          </button>
        </div>
      </div>
    </div>
  )
}
