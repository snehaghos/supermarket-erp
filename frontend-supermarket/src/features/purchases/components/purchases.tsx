'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DollarSign,
  Eye,
  FileText,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react'
import type {
  ProductWithRelations,
  PurchaseItemRow,
  PurchaseRow,
  SupplierRow,
} from '@/lib/api'
import { productsApi, suppliersApi } from '@/lib/api'
import { showApiError, showSuccess } from '@/lib/errors'
import { DetailMeta, StatCard } from '@/features/common/components/stat-card'

export function PurchasesSection() {
  const [purchases, setPurchases] = useState<
    Array<PurchaseRow & { totalPrice?: number }>
  >([])
  const [products, setProducts] = useState<Array<ProductWithRelations>>([])
  const [suppliers, setSuppliers] = useState<Array<SupplierRow>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<PurchaseRow | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [list, prodData, supData] = await Promise.all([
        productsApi.getPurchases(),
        productsApi.getAll(),
        suppliersApi.getAll(),
      ])
      setProducts(prodData)
      setSuppliers(supData)
      setPurchases(list)

      // Enrich headers with line-item totals in the background so the table
      // renders instantly and totals fill in as they arrive.
      void Promise.all(
        list.map(async (p) => {
          try {
            const detail = await productsApi.getPurchaseById(p.id)
            const total = (detail.items ?? []).reduce(
              (s, it) => s + (Number(it.totalPrice) || 0),
              0,
            )
            return { ...p, items: detail.items, totalPrice: total }
          } catch {
            return p
          }
        }),
      ).then((enriched) => setPurchases(enriched))
    } catch (err) {
      showApiError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = purchases.filter(
    (p) =>
      p.purchaseNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(search.toLowerCase()),
  )

  const totalSpent = purchases.reduce((s, p) => s + (p.totalPrice ?? 0), 0)
  const distinctSuppliers = new Set(
    purchases.map((p) => p.supplierId).filter(Boolean),
  ).size

  const openDetail = async (purchase: PurchaseRow) => {
    setSelected(purchase)
    if (!purchase.items) {
      setLoadingDetail(true)
      try {
        const detail = await productsApi.getPurchaseById(purchase.id)
        setSelected(detail)
      } catch (err) {
        showApiError(err)
      } finally {
        setLoadingDetail(false)
      }
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Purchases</h2>
          <p className="text-sm text-muted-foreground">
            Purchase orders and goods receipts
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
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Record Purchase
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Purchase Orders"
          value={purchases.length}
          sub={`${purchases.reduce((s, p) => s + p.totalItems, 0)} line items`}
          icon={FileText}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          label="Total Spent"
          value={`₹${totalSpent.toLocaleString()}`}
          sub="All time"
          icon={DollarSign}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          label="Suppliers"
          value={distinctSuppliers}
          sub={`of ${suppliers.length} total`}
          icon={Truck}
          color="text-sky-600"
          bg="bg-sky-50"
        />
        <StatCard
          label="Products"
          value={products.length}
          sub="in catalog"
          icon={Package}
          color="text-violet-600"
          bg="bg-violet-50"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order or supplier..."
          className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <ShoppingCart className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search
              ? 'No matching purchases'
              : 'No purchases yet. Record your first purchase to stock inventory.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => openDetail(p)}
                  >
                    <td>
                      <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">
                        {p.purchaseNumber}
                      </code>
                    </td>
                    <td>
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                        {p.supplierName || 'Walk-in'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-muted-foreground">
                        {p.totalItems}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-semibold text-emerald-600">
                        ₹{(p.totalPrice ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openDetail(p)
                        }}
                        className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Purchase Modal */}
      {showForm && (
        <PurchaseForm
          products={products}
          suppliers={suppliers}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            fetchData()
          }}
        />
      )}

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                Purchase Detail
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DetailMeta label="Order" value={selected.purchaseNumber} mono />
              <DetailMeta
                label="Supplier"
                value={selected.supplierName || 'Walk-in'}
              />
              <DetailMeta
                label="Date"
                value={new Date(selected.createdAt).toLocaleDateString()}
              />
              <DetailMeta label="Items" value={String(selected.totalItems)} />
            </div>

            {loadingDetail ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              </div>
            ) : selected.items && selected.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Base Qty</th>
                      <th>Unit Price</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((it: PurchaseItemRow) => (
                      <tr key={it.id}>
                        <td>
                          <span className="text-xs font-medium text-foreground">
                            {it.productName || it.productId.slice(0, 8)}
                          </span>
                          {it.productSku && (
                            <span className="text-[10px] text-muted-foreground block">
                              {it.productSku}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="text-xs font-semibold">
                            {it.quantity}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-muted-foreground">
                            {it.unitSymbol}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-muted-foreground">
                            {it.baseQuantity}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs">
                            ₹{it.unitPrice.toLocaleString()}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="text-xs font-semibold text-emerald-600">
                            ₹{it.totalPrice.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No line items
              </p>
            )}

            {selected.notes && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5">
                  Notes
                </p>
                <p className="text-xs text-foreground">{selected.notes}</p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PurchaseForm({
  products,
  suppliers,
  onClose,
  onSuccess,
}: {
  products: Array<ProductWithRelations>
  suppliers: Array<SupplierRow>
  onClose: () => void
  onSuccess: () => void
}) {
  const [productId, setProductId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [supplierName, setSupplierName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const product = products.find((p) => p.id === productId)
  const availableUnits = product?.units ?? []
  const selectedUnit = availableUnits.find((u) => u.unitId === unitId)
  const totalInBase = selectedUnit
    ? quantity * selectedUnit.factorToBase
    : quantity
  const totalPrice = unitPrice * quantity

  const selectProduct = (id: string) => {
    setProductId(id)
    const p = products.find((x) => x.id === id)
    if (p) {
      setUnitId(p.purchaseUnitId || p.baseUnitId)
      setUnitPrice(p.purchasePrice || 0)
    } else {
      setUnitId('')
    }
  }

  const handleSave = async () => {
    if (!productId || !unitId || quantity <= 0) return
    setSaving(true)
    try {
      const matched = suppliers.find(
        (s) => s.name.toLowerCase() === supplierName.trim().toLowerCase(),
      )
      await productsApi.purchase({
        productId,
        unitId,
        quantity,
        unitPrice,
        supplierId: matched?.id,
        supplierName,
        notes,
      })
      showSuccess(
        'Purchase recorded',
        `${quantity} ${selectedUnit?.unitSymbol ?? 'units'} added to inventory.`,
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
            <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
              P
            </span>
            Record Purchase
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
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              In stock:{' '}
              <span className="font-semibold text-foreground">
                {product.currentStock} {product.baseUnitSymbol}
              </span>
              {' · '}Base: {product.baseUnitName}
            </p>
          </div>
        )}

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
                {availableUnits.map((u) => (
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Unit Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Supplier
              </label>
              <input
                list="purchase-suppliers"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Type or pick a supplier"
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <datalist id="purchase-suppliers">
                {suppliers.map((s) => (
                  <option
                    key={s.id}
                    value={s.name}
                    label={s.city ? `${s.name} — ${s.city}` : s.name}
                  />
                ))}
              </datalist>
            </div>
          </div>
        )}

        {product && (
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
        )}

        {selectedUnit && (
          <div className="bg-emerald-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs text-emerald-700">
              <span>
                1 {selectedUnit.unitSymbol} = {selectedUnit.factorToBase}{' '}
                {product?.baseUnitSymbol}
              </span>
              <span>
                Adds {totalInBase} {product?.baseUnitSymbol}
              </span>
            </div>
            <div className="flex justify-between text-xs font-medium text-emerald-800">
              <span>
                {quantity} {selectedUnit.unitSymbol}
              </span>
              <span>₹{totalPrice.toFixed(2)}</span>
            </div>
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
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Record Purchase
          </button>
        </div>
      </div>
    </div>
  )
}
