'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  DollarSign,
  Eye,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import type {
  CustomerRow,
  ProductWithRelations,
  SaleItemRow,
  SaleRow,
} from '@/lib/api'
import { customersApi, productsApi } from '@/lib/api'
import { showApiError, showSuccess } from '@/lib/errors'
import { DetailMeta, StatCard } from '@/features/common/components/stat-card'

export function SalesSection() {
  const [sales, setSales] = useState<Array<SaleRow & { totalPrice?: number }>>(
    [],
  )
  const [products, setProducts] = useState<Array<ProductWithRelations>>([])
  const [customers, setCustomers] = useState<Array<CustomerRow>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<SaleRow | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [list, prodData, custData] = await Promise.all([
        productsApi.getSales(),
        productsApi.getAll(),
        customersApi.getAll(),
      ])
      setProducts(prodData)
      setCustomers(custData)
      setSales(list)

      // Enrich headers with line-item totals in the background.
      void Promise.all(
        list.map(async (s) => {
          try {
            const detail = await productsApi.getSaleById(s.id)
            const total = (detail.items ?? []).reduce(
              (sum, it) => sum + (Number(it.totalPrice) || 0),
              0,
            )
            return { ...s, items: detail.items, totalPrice: total }
          } catch {
            return s
          }
        }),
      ).then((enriched) => setSales(enriched))
    } catch (err) {
      showApiError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = sales.filter(
    (s) =>
      s.saleNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName.toLowerCase().includes(search.toLowerCase()),
  )

  const totalRevenue = sales.reduce((s, x) => s + (x.totalPrice ?? 0), 0)
  const distinctCustomers = new Set(
    sales.map((s) => s.customerId).filter(Boolean),
  ).size
  const unitsSold = sales.reduce(
    (s, x) =>
      s + (x.items ?? []).reduce((a, it) => a + Number(it.baseQuantity), 0),
    0,
  )

  const openDetail = async (sale: SaleRow) => {
    setSelected(sale)
    if (!sale.items) {
      setLoadingDetail(true)
      try {
        setSelected(await productsApi.getSaleById(sale.id))
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
          <h2 className="text-xl font-bold text-foreground">Sales</h2>
          <p className="text-sm text-muted-foreground">
            Sales orders and receipts
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
            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Record Sale
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Sales Orders"
          value={sales.length}
          sub={`${sales.reduce((s, x) => s + x.totalItems, 0)} line items`}
          icon={Receipt}
          color="text-orange-600"
          bg="bg-orange-50"
        />
        <StatCard
          label="Total Revenue"
          value={`₹${totalRevenue.toLocaleString()}`}
          sub="All time"
          icon={DollarSign}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          label="Units Sold"
          value={unitsSold.toLocaleString()}
          sub="In base units"
          icon={TrendingUp}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          label="Customers"
          value={distinctCustomers}
          sub={`of ${customers.length} total`}
          icon={Users}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order or customer..."
          className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Receipt className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search
              ? 'No matching sales'
              : 'No sales yet. Record your first sale to start tracking revenue.'}
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
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => openDetail(s)}
                  >
                    <td>
                      <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">
                        {s.saleNumber}
                      </code>
                    </td>
                    <td>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        {s.customerName || 'Walk-in'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-muted-foreground">
                        {s.totalItems}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-semibold text-emerald-600">
                        ₹{(s.totalPrice ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openDetail(s)
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

      {/* Record Sale Modal */}
      {showForm && (
        <SaleForm
          products={products}
          customers={customers}
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
                <Receipt className="w-4 h-4 text-orange-500" />
                Sale Detail
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DetailMeta label="Order" value={selected.saleNumber} mono />
              <DetailMeta
                label="Customer"
                value={selected.customerName || 'Walk-in'}
              />
              <DetailMeta
                label="Date"
                value={new Date(selected.createdAt).toLocaleDateString()}
              />
              <DetailMeta label="Items" value={String(selected.totalItems)} />
            </div>

            {loadingDetail ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
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
                    {selected.items.map((it: SaleItemRow) => (
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

function SaleForm({
  products,
  customers,
  onClose,
  onSuccess,
}: {
  products: Array<ProductWithRelations>
  customers: Array<CustomerRow>
  onClose: () => void
  onSuccess: () => void
}) {
  const [productId, setProductId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const product = products.find((p) => p.id === productId)
  const availableUnits = product?.units ?? []
  const selectedUnit = availableUnits.find((u) => u.unitId === unitId)
  const totalInBase = selectedUnit
    ? quantity * selectedUnit.factorToBase
    : quantity
  const totalPrice = unitPrice * quantity
  const insufficient =
    product !== undefined && totalInBase > product.currentStock

  const selectProduct = (id: string) => {
    setProductId(id)
    const p = products.find((x) => x.id === id)
    if (p) {
      setUnitId(p.sellingUnitId || p.baseUnitId)
      setUnitPrice(p.sellingPrice || 0)
    } else {
      setUnitId('')
    }
  }

  const handleSave = async () => {
    if (!productId || !unitId || quantity <= 0 || insufficient) return
    setSaving(true)
    try {
      const matched = customers.find(
        (c) => c.name.toLowerCase() === customerName.trim().toLowerCase(),
      )
      await productsApi.sell({
        productId,
        unitId,
        quantity,
        unitPrice,
        customerId: matched?.id,
        customerName,
        notes,
      })
      showSuccess(
        'Sale recorded',
        `${quantity} ${selectedUnit?.unitSymbol ?? 'units'} sold.`,
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
            <span className="w-6 h-6 rounded bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">
              S
            </span>
            Record Sale
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
                Customer
              </label>
              <input
                list="sale-customers"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Type or pick a customer"
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <datalist id="sale-customers">
                {customers.map((c) => (
                  <option
                    key={c.id}
                    value={c.name}
                    label={c.phone ? `${c.name} — ${c.phone}` : c.name}
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
          <div className="bg-orange-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs text-orange-700">
              <span>
                1 {selectedUnit.unitSymbol} = {selectedUnit.factorToBase}{' '}
                {product?.baseUnitSymbol}
              </span>
              <span>
                Sells {totalInBase} {product?.baseUnitSymbol}
              </span>
            </div>
            <div className="flex justify-between text-xs font-medium text-orange-800">
              <span>
                {quantity} {selectedUnit.unitSymbol}
              </span>
              <span>₹{totalPrice.toFixed(2)}</span>
            </div>
            {insufficient && (
              <p className="flex items-center gap-1 text-red-600 font-medium text-xs mt-1">
                <AlertTriangle className="w-3 h-3" />
                Insufficient stock! Available: {product?.currentStock}{' '}
                {product?.baseUnitSymbol}
              </p>
            )}
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
            disabled={
              saving || !productId || !unitId || quantity <= 0 || insufficient
            }
            className="flex items-center gap-2 bg-orange-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 shadow-sm"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Record Sale
          </button>
        </div>
      </div>
    </div>
  )
}
