"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, RefreshCw, Save, X, AlertTriangle, Search, Loader2 } from "lucide-react"
import {
  productsApi, unitsApi,
  type ProductWithRelations, type CreateProductInput, type UpdateProductInput,
  type UnitRow, type DisplayStock, type TransactionRow,
} from "@/lib/api"
import { ProductForm } from "./product-form"
import { ProductTable } from "./product-table"

const emptyForm: CreateProductInput = {
  name: '', category: 'General', sku: '', barcode: '', brand: '', description: '', imageUrl: '',
  baseUnitId: '', purchaseUnitId: null, sellingUnitId: null,
  purchasePrice: 0, sellingPrice: 0,
  minStock: 0, maxStock: 0, reorderLevel: 0, openingStock: 0,
  additionalUnits: [],
  productConversions: [],
}

export function ProductsSection() {
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [displayStocks, setDisplayStocks] = useState<Record<string, DisplayStock>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateProductInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showSellModal, setShowSellModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRelations | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prodData, unitsData] = await Promise.all([
        productsApi.getAll(),
        unitsApi.getAll(),
      ])
      setProducts(prodData)
      setUnits(unitsData)

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false) }

  const openEdit = (product: ProductWithRelations) => {
    setForm({
      name: product.name,
      category: product.category,
      sku: product.sku,
      barcode: product.barcode,
      brand: product.brand,
      description: product.description,
      imageUrl: product.imageUrl,
      baseUnitId: product.baseUnitId,
      purchaseUnitId: product.purchaseUnitId,
      sellingUnitId: product.sellingUnitId,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      minStock: product.minStock,
      maxStock: product.maxStock,
      reorderLevel: product.reorderLevel,
      openingStock: 0,
      additionalUnits: product.units
        .filter(u => u.unitId !== product.baseUnitId)
        .map(u => ({ unitId: u.unitId, isPurchaseUnit: u.isPurchaseUnit, isSellingUnit: u.isSellingUnit })),
      productConversions: product.productConversions.map(c => ({
        fromUnitId: c.fromUnitId,
        toUnitId: c.toUnitId,
        conversionFactor: c.conversionFactor,
      })),
    })
    setEditingId(product.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingId) {
        const input: UpdateProductInput = {}
        if (form.name) input.name = form.name
        if (form.category) input.category = form.category
        if (form.sku) input.sku = form.sku
        if (form.barcode !== undefined) input.barcode = form.barcode
        if (form.brand !== undefined) input.brand = form.brand
        if (form.description) input.description = form.description
        if (form.imageUrl !== undefined) input.imageUrl = form.imageUrl
        if (form.baseUnitId) input.baseUnitId = form.baseUnitId
        input.purchaseUnitId = form.purchaseUnitId
        input.sellingUnitId = form.sellingUnitId
        if (form.purchasePrice !== undefined) input.purchasePrice = form.purchasePrice
        if (form.sellingPrice !== undefined) input.sellingPrice = form.sellingPrice
        if (form.minStock >= 0) input.minStock = form.minStock
        if (form.maxStock !== undefined) input.maxStock = form.maxStock
        if (form.reorderLevel !== undefined) input.reorderLevel = form.reorderLevel
        await productsApi.update(editingId, input)
        showSuccess('Product updated successfully')
      } else {
        await productsApi.create(form)
        showSuccess('Product created successfully')
      }
      resetForm()
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await productsApi.delete(id)
      showSuccess('Product deleted')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  const activeUnits = units.filter(u => u.status === 'active')

  // Merge display stocks into products
  const productsWithStock = products.map(p => ({
    ...p,
    displayStock: displayStocks[p.id],
  }))

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Products</h2>
          <p className="text-sm text-muted-foreground">Manage products and inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <Save className="w-4 h-4 shrink-0" /> {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {showForm && (
        <ProductForm
          form={form}
          editingId={editingId}
          saving={saving}
          activeUnits={activeUnits}
          existingConversions={editingId ? products.find(p => p.id === editingId)?.productConversions : undefined}
          onFormChange={setForm}
          onSave={handleSave}
          onCancel={resetForm}
        />
      )}

      {/* Purchase/Sell Modals */}
      {showPurchaseModal && selectedProduct && (
        <PurchaseModal
          product={selectedProduct}
          onClose={() => { setShowPurchaseModal(false); setSelectedProduct(null) }}
          onSuccess={() => { setShowPurchaseModal(false); setSelectedProduct(null); fetchData() }}
          showSuccess={showSuccess}
          setError={setError}
        />
      )}
      {showSellModal && selectedProduct && (
        <SellModal
          product={selectedProduct}
          onClose={() => { setShowSellModal(false); setSelectedProduct(null) }}
          onSuccess={() => { setShowSellModal(false); setSelectedProduct(null); fetchData() }}
          showSuccess={showSuccess}
          setError={setError}
        />
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
        />
      </div>

      <ProductTable
        products={productsWithStock}
        loading={loading}
        search={search}
        deletingId={deletingId}
        onEdit={openEdit}
        onDelete={handleDelete}
        onPurchase={(p) => { setSelectedProduct(p); setShowPurchaseModal(true) }}
        onSell={(p) => { setSelectedProduct(p); setShowSellModal(true) }}
        onViewStock={(p) => {
          setSelectedProduct(p)
          setShowPurchaseModal(false)
          setShowSellModal(false)
        }}
      />

      {/* Stock Detail Modal */}
      {selectedProduct && !showPurchaseModal && !showSellModal && (
        <StockDetailModal
          product={selectedProduct}
          displayStock={displayStocks[selectedProduct.id]}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  )
}

// ── Purchase Modal ──────────────────────────────────────────────

function PurchaseModal({
  product, onClose, onSuccess, showSuccess, setError,
}: {
  product: ProductWithRelations
  onClose: () => void
  onSuccess: () => void
  showSuccess: (msg: string) => void
  setError: (err: string | null) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [unitId, setUnitId] = useState(product.purchaseUnitId || product.baseUnitId)
  const [unitPrice, setUnitPrice] = useState(product.purchasePrice || 0)
  const [supplierName, setSupplierName] = useState('')
  const [saving, setSaving] = useState(false)

  const availableUnits = product.units.filter(u => u.isPurchaseUnit)

  const handlePurchase = async () => {
    setSaving(true)
    try {
      await productsApi.purchase({ productId: product.id, unitId, quantity, unitPrice, supplierName, notes: '' })
      showSuccess(`Purchased ${quantity} successfully`)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed')
    } finally {
      setSaving(false)
    }
  }

  const selectedUnit = product.units.find(u => u.unitId === unitId)
  const totalPrice = unitPrice * quantity
  const totalInBase = selectedUnit ? quantity * selectedUnit.factorToBase : quantity

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">P</span>
            Purchase Stock
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm font-medium text-foreground">{product.name}</p>
          <p className="text-xs text-muted-foreground">{product.sku} · {product.baseUnitName} (base) · {product.brand && `${product.brand} · `} ₹{product.purchasePrice}/{product.purchaseUnitSymbol || product.baseUnitSymbol}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity</label>
            <input type="number" min="0.001" step="any" value={quantity}
              onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Unit</label>
            <select value={unitId} onChange={e => setUnitId(e.target.value)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring">
              {availableUnits.map(u => (
                <option key={u.unitId} value={u.unitId}>{u.unitName} ({u.unitSymbol})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Unit Price (₹)</label>
            <input type="number" min="0" step="0.01" value={unitPrice}
              onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Supplier</label>
            <input value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="Supplier name"
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {selectedUnit && (
          <div className="bg-emerald-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs text-emerald-700">
              <span>Conversion: 1 {selectedUnit.unitSymbol}</span>
              <span>= {selectedUnit.factorToBase} {product.baseUnitSymbol}</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-emerald-800">
              <span>Total: {quantity} {selectedUnit.unitSymbol} → {totalInBase} {product.baseUnitSymbol}</span>
              <span>₹{totalPrice.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={handlePurchase} disabled={saving || quantity <= 0}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 shadow-sm">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Purchase
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sell Modal ──────────────────────────────────────────────────

function SellModal({
  product, onClose, onSuccess, showSuccess, setError,
}: {
  product: ProductWithRelations
  onClose: () => void
  onSuccess: () => void
  showSuccess: (msg: string) => void
  setError: (err: string | null) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [unitId, setUnitId] = useState(product.sellingUnitId || product.baseUnitId)
  const [unitPrice, setUnitPrice] = useState(product.sellingPrice || 0)
  const [customerName, setCustomerName] = useState('')
  const [saving, setSaving] = useState(false)

  const availableUnits = product.units.filter(u => u.isSellingUnit)

  const handleSell = async () => {
    setSaving(true)
    try {
      await productsApi.sell({ productId: product.id, unitId, quantity, unitPrice, customerName, notes: '' })
      showSuccess(`Sold ${quantity} successfully`)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale failed')
    } finally {
      setSaving(false)
    }
  }

  const selectedUnit = product.units.find(u => u.unitId === unitId)
  const totalPrice = unitPrice * quantity
  const totalInBase = selectedUnit ? quantity * selectedUnit.factorToBase : quantity

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">S</span>
            Sell Stock
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm font-medium text-foreground">{product.name}</p>
          <p className="text-xs text-muted-foreground">Available: {product.currentStock} {product.baseUnitSymbol} · ₹{product.sellingPrice}/{product.sellingUnitSymbol || product.baseUnitSymbol}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity</label>
            <input type="number" min="0.001" step="any" value={quantity}
              onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Unit</label>
            <select value={unitId} onChange={e => setUnitId(e.target.value)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring">
              {availableUnits.map(u => (
                <option key={u.unitId} value={u.unitId}>{u.unitName} ({u.unitSymbol})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Unit Price (₹)</label>
            <input type="number" min="0" step="0.01" value={unitPrice}
              onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Customer</label>
            <input value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Customer name"
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {selectedUnit && (
          <div className="bg-orange-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs text-orange-700">
              <span>Conversion: 1 {selectedUnit.unitSymbol}</span>
              <span>= {selectedUnit.factorToBase} {product.baseUnitSymbol}</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-orange-800">
              <span>Total: {quantity} {selectedUnit.unitSymbol} → {totalInBase} {product.baseUnitSymbol}</span>
              <span>₹{totalPrice.toFixed(2)}</span>
            </div>
            {product.currentStock < totalInBase && (
              <p className="text-red-600 font-medium text-xs mt-1">⚠ Insufficient stock! Available: {product.currentStock} {product.baseUnitSymbol}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={handleSell} disabled={saving || quantity <= 0}
            className="flex items-center gap-2 bg-orange-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 shadow-sm">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Sell
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stock Detail Modal ──────────────────────────────────────────

function StockDetailModal({
  product, displayStock, onClose,
}: {
  product: ProductWithRelations
  displayStock?: DisplayStock
  onClose: () => void
}) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loadingTx, setLoadingTx] = useState(true)

  useEffect(() => {
    if (!product) return
    setLoadingTx(true)
    productsApi.getTransactions(product.id)
      .then(setTransactions)
      .catch(() => {})
      .finally(() => setLoadingTx(false))
  }, [product])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-xl max-h-[80vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">I</span>
            Stock Detail
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
              {product.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground">{product.name}</p>
              <p className="text-xs text-muted-foreground">{product.sku} · {product.category}{product.brand ? ` · ${product.brand}` : ''}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-card rounded-lg p-2 border border-border">
              <p className="text-xs text-muted-foreground">Base Unit</p>
              <p className="text-sm font-semibold text-foreground">{product.baseUnitSymbol}</p>
            </div>
            <div className="bg-card rounded-lg p-2 border border-border">
              <p className="text-xs text-muted-foreground">Current Stock</p>
              <p className="text-sm font-semibold text-foreground">{product.currentStock}</p>
            </div>
            <div className="bg-card rounded-lg p-2 border border-border">
              <p className="text-xs text-muted-foreground">Min Stock</p>
              <p className="text-sm font-semibold text-foreground">{product.minStock}</p>
            </div>
            <div className="bg-card rounded-lg p-2 border border-border">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm font-semibold text-foreground capitalize">{product.status}</p>
            </div>
          </div>

          {/* Pricing */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="bg-card rounded-lg p-2 border border-border">
              <p className="text-xs text-muted-foreground">Purchase Price</p>
              <p className="text-sm font-semibold text-foreground">₹{product.purchasePrice}/{product.purchaseUnitSymbol || product.baseUnitSymbol}</p>
            </div>
            <div className="bg-card rounded-lg p-2 border border-border">
              <p className="text-xs text-muted-foreground">Selling Price</p>
              <p className="text-sm font-semibold text-foreground">₹{product.sellingPrice}/{product.sellingUnitSymbol || product.baseUnitSymbol}</p>
            </div>
          </div>

          {/* Stock Levels */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="bg-card rounded-lg p-2 border border-border">
              <p className="text-xs text-muted-foreground">Max Stock</p>
              <p className="text-sm font-semibold text-foreground">{product.maxStock} {product.baseUnitSymbol}</p>
            </div>
            <div className="bg-card rounded-lg p-2 border border-border">
              <p className="text-xs text-muted-foreground">Reorder Level</p>
              <p className="text-sm font-semibold text-foreground">{product.reorderLevel} {product.baseUnitSymbol}</p>
            </div>
          </div>

          {displayStock && displayStock.display.length > 0 && (
            <div className="mt-3 bg-card rounded-lg p-3 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Display Breakdown</p>
              <div className="flex flex-wrap gap-2">
                {displayStock.display.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-medium">
                    {d.quantity} {d.unitSymbol}
                    <span className="text-emerald-500 font-normal">{d.unitName}</span>
                  </span>
                ))}
                {displayStock.isLowStock && (
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-medium">
                    <AlertTriangle className="w-3 h-3" /> Low Stock
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Available Units */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Available Units</p>
          <div className="grid grid-cols-2 gap-2">
            {product.units.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-2 border border-border">
                <div>
                  <span className="text-sm font-medium text-foreground">{u.unitName}</span>
                  <code className="ml-1 text-[10px] text-muted-foreground font-mono">({u.unitSymbol})</code>
                </div>
                <div className="flex gap-1">
                  {u.isPurchaseUnit && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Buy</span>}
                  {u.isSellingUnit && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">Sell</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product-specific Conversions */}
        {product.productConversions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Custom Conversions</p>
            <div className="space-y-1">
              {product.productConversions.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-purple-50 rounded-lg p-2 border border-purple-200 text-xs">
                  <span className="font-medium text-purple-700">1 {c.fromUnitSymbol} = {c.conversionFactor} {c.toUnitSymbol}</span>
                  <span className="text-purple-500">{c.fromUnitName} → {c.toUnitName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Recent Transactions</p>
          {loadingTx ? (
            <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-emerald-600" /></div>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No transactions yet</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {transactions.slice(0, 10).map((tx: TransactionRow) => (
                <div key={tx.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      tx.transactionType === 'purchase' ? 'bg-emerald-500' :
                      tx.transactionType === 'sale' ? 'bg-red-500' :
                      tx.transactionType === 'opening_stock' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    <span className="font-medium text-foreground capitalize">{tx.transactionType.replace('_', ' ')}</span>
                    <span className="text-muted-foreground">{tx.baseQuantity > 0 ? '+' : ''}{tx.baseQuantity} {tx.unitSymbol}</span>
                  </div>
                  <span className="text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Close</button>
        </div>
      </div>
    </div>
  )
}
