"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  ArrowLeft, Package, ShoppingCart, TrendingDown, Loader2,
  X, AlertTriangle, CheckCircle, Upload, Trash2, Edit2,
  Image as ImageIcon, DollarSign, Settings, Clock,
  RefreshCw, FileImage, Save,
} from "lucide-react"
import { productsApi } from "@/lib/api"
import type {
  ProductWithRelations, UnitRow, TransactionRow,
} from "@/lib/api"
import { showSuccess, showApiError } from "@/lib/errors"

// ── Props ──────────────────────────────────────────────────────

interface ProductDetailsPageProps {
  product: ProductWithRelations
  activeUnits: UnitRow[]
  onBack: () => void
}

// ── Tab Configuration ──────────────────────────────────────────

type TabId = 'overview' | 'inventory' | 'images' | 'pricing' | 'purchases' | 'sales' | 'movements' | 'settings'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: ShoppingCart },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'purchases', label: 'Purchase History', icon: TrendingDown },
  { id: 'sales', label: 'Sales History', icon: TrendingDown },
  { id: 'movements', label: 'Stock Movements', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
]

// ── Main Component ─────────────────────────────────────────────

export function ProductDetailsPage({ product: initialProduct, activeUnits, onBack }: ProductDetailsPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [product, setProduct] = useState<ProductWithRelations>(initialProduct)
  const [loading, setLoading] = useState(false)

  const refreshProduct = useCallback(async () => {
    setLoading(true)
    try {
      const updated = await productsApi.getById(product.id)
      setProduct(updated)
    } catch (err) {
      showApiError(err)
    } finally {
      setLoading(false)
    }
  }, [product.id])

  useEffect(() => {
    void refreshProduct()
  }, [refreshProduct])

  // Detect tab scroll state
  const tabsRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = tabsRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  return (
    <div className="space-y-5">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
          title="Back to products"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {product.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{product.name}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                product.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                product.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  product.status === 'active' ? 'bg-emerald-500' :
                  product.status === 'inactive' ? 'bg-gray-400' : 'bg-red-400'
                }`} />
                {product.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {product.sku} · {product.category}{product.brand ? ` · ${product.brand}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={refreshProduct}
          disabled={loading}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="relative">
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        )}
        <div
          ref={tabsRef}
          className="flex gap-1 overflow-x-auto scrollbar-thin pb-px"
          onScroll={checkScroll}
        >
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        )}
      </div>

      {/* Tab Content */}
      <div className="min-h-[60vh]">
        {activeTab === 'overview' && <OverviewTab product={product} />}
        {activeTab === 'inventory' && <InventoryTab product={product} onRefresh={refreshProduct} />}
        {activeTab === 'images' && <ImagesTab product={product} onRefresh={refreshProduct} />}
        {activeTab === 'pricing' && <PricingTab product={product} onRefresh={refreshProduct} />}
        {activeTab === 'purchases' && <PurchaseHistoryTab productId={product.id} />}
        {activeTab === 'sales' && <SalesHistoryTab productId={product.id} />}
        {activeTab === 'movements' && <StockMovementsTab productId={product.id} />}
        {activeTab === 'settings' && <SettingsTab product={product} onRefresh={refreshProduct} />}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════

function OverviewTab({ product }: { product: ProductWithRelations }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product Info Card */}
      <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-6">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-emerald-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Product Information</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoField label="Product Name" value={product.name} />
          <InfoField label="SKU" value={product.sku} mono />
          <InfoField label="Barcode" value={product.barcode || '-'} mono />
          <InfoField label="Category" value={product.category} />
          <InfoField label="Brand" value={product.brand || '-'} />
          <InfoField label="Status" value={product.status.charAt(0).toUpperCase() + product.status.slice(1)} />
          <div className="col-span-2">
            <InfoField label="Description" value={product.description || 'No description'} />
          </div>
        </div>
      </div>

      {/* Quick Stats Card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-blue-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Quick Stats</h3>
        </div>
        <div className="space-y-3">
          <StatRow label="Current Stock" value={`${product.currentStock} ${product.baseUnitSymbol}`} />
          <StatRow label="Base Unit" value={`${product.baseUnitName} (${product.baseUnitSymbol})`} />
          <StatRow label="Purchase Unit" value={product.purchaseUnitName ? `${product.purchaseUnitName} (${product.purchaseUnitSymbol})` : 'Same as base'} />
          <StatRow label="Selling Unit" value={product.sellingUnitName ? `${product.sellingUnitName} (${product.sellingUnitSymbol})` : 'Same as base'} />
          <StatRow label="Available Units" value={`${product.units.length}`} />
          <StatRow label="Images" value={`${product.productImages.length}`} />
        </div>
      </div>

      {/* Timestamps */}
      <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 rounded-full bg-gray-400" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Timestamps</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoField label="Created" value={new Date(product.createdAt).toLocaleString()} />
          <InfoField label="Last Updated" value={new Date(product.updatedAt).toLocaleString()} />
        </div>
      </div>
    </div>
  )
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// INVENTORY TAB
// ══════════════════════════════════════════════════════════════════

function InventoryTab({ product, onRefresh }: { product: ProductWithRelations; onRefresh: () => void }) {
  const [showPurchase, setShowPurchase] = useState(false)
  const [showSale, setShowSale] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)

  const stockValue = product.currentStock * product.purchasePrice
  const sellingValue = product.currentStock * product.sellingPrice
  const isLowStock = product.currentStock <= product.minStock && product.currentStock > 0
  const isOverstock = product.maxStock > 0 && product.currentStock >= product.maxStock

  return (
    <div className="space-y-5">
      {/* Stock Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StockCard
          label="Current Stock"
          value={`${product.currentStock} ${product.baseUnitSymbol}`}
          color={isLowStock ? 'text-amber-600' : 'text-emerald-600'}
          bg="bg-emerald-50"
        />
        <StockCard
          label="Stock Value (Cost)"
          value={`₹${stockValue.toLocaleString()}`}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StockCard
          label="Stock Value (Selling)"
          value={`₹${sellingValue.toLocaleString()}`}
          color="text-violet-600"
          bg="bg-violet-50"
        />
        <StockCard
          label="Min / Max"
          value={`${product.minStock} / ${product.maxStock} ${product.baseUnitSymbol}`}
          color={isOverstock ? 'text-amber-600' : 'text-foreground'}
          bg="bg-slate-50"
        />
      </div>

      {/* Stock Level Bar */}
      {product.maxStock > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Stock Level</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> 0</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Min ({product.minStock})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Current</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Max ({product.maxStock})</span>
            </div>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden relative">
            {/* Min stock marker */}
            {product.minStock > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                style={{ left: `${Math.min((product.minStock / product.maxStock) * 100, 100)}%` }}
              />
            )}
            {/* Current stock bar */}
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                product.currentStock === 0 ? 'bg-red-400' :
                isLowStock ? 'bg-amber-400' :
                isOverstock ? 'bg-blue-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min((product.currentStock / product.maxStock) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0</span>
            <span>{product.maxStock} {product.baseUnitSymbol}</span>
          </div>
        </div>
      )}

      {/* Stock Alert */}
      {isLowStock && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Low Stock Alert</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Current stock ({product.currentStock} {product.baseUnitSymbol}) is below minimum level ({product.minStock} {product.baseUnitSymbol}).
              Consider purchasing more stock.
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ActionButton
          icon={ShoppingCart}
          label="Purchase Stock"
          desc="Add inventory to this product"
          color="text-emerald-600"
          bg="bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
          onClick={() => setShowPurchase(true)}
        />
        <ActionButton
          icon={TrendingDown}
          label="Sell Stock"
          desc="Record a sale"
          color="text-orange-600"
          bg="bg-orange-50 hover:bg-orange-100 border-orange-200"
          onClick={() => setShowSale(true)}
        />
        <ActionButton
          icon={Edit2}
          label="Adjust Stock"
          desc="Set exact quantity or add opening stock"
          color="text-blue-600"
          bg="bg-blue-50 hover:bg-blue-100 border-blue-200"
          onClick={() => setShowAdjust(true)}
        />
      </div>

      {/* Modals */}
      {showPurchase && (
        <PurchaseStockModal
          product={product}
          onClose={() => setShowPurchase(false)}
          onSuccess={() => { setShowPurchase(false); onRefresh() }}
        />
      )}
      {showSale && (
        <SellStockModal
          product={product}
          onClose={() => setShowSale(false)}
          onSuccess={() => { setShowSale(false); onRefresh() }}
        />
      )}
      {showAdjust && (
        <AdjustStockModal
          product={product}
          onClose={() => setShowAdjust(false)}
          onSuccess={() => { setShowAdjust(false); onRefresh() }}
        />
      )}
    </div>
  )
}

function StockCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`${bg} border border-border rounded-xl p-4`}>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

function ActionButton({ icon: Icon, label, desc, color, bg, onClick }: {
  icon: React.ComponentType<{ className?: string }>
  label: string; desc: string; color: string; bg: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${bg}`}>
      <div className="w-10 h-10 rounded-lg bg-white border border-border/50 flex items-center justify-center shrink-0">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════
// PURCHASE STOCK MODAL
// ══════════════════════════════════════════════════════════════════

function PurchaseStockModal({ product, onClose, onSuccess }: {
  product: ProductWithRelations; onClose: () => void; onSuccess: () => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [unitId, setUnitId] = useState(product.purchaseUnitId || product.baseUnitId)
  const [unitPrice, setUnitPrice] = useState(product.purchasePrice || 0)
  const [supplierName, setSupplierName] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [manufacturingDate, setManufacturingDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [serialNumbers, setSerialNumbers] = useState('')
  const [saving, setSaving] = useState(false)

  const availableUnits = product.units.filter(u => u.isPurchaseUnit)
  const selectedUnit = product.units.find(u => u.unitId === unitId)
  const totalPrice = unitPrice * quantity
  const totalInBase = selectedUnit ? quantity * selectedUnit.factorToBase : quantity

  const handlePurchase = async () => {
    setSaving(true)
    try {
      await productsApi.purchase({
        productId: product.id, unitId, quantity, unitPrice,
        supplierName, notes: batchNumber ? `Batch: ${batchNumber}` : '',
      })
      showSuccess('Stock purchased', `${quantity} ${selectedUnit?.unitSymbol || 'units'} added to inventory.`)
      onSuccess()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

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
          <p className="text-xs text-muted-foreground">{product.sku} · {product.baseUnitName} (base) · ₹{product.purchasePrice}/{product.purchaseUnitSymbol || product.baseUnitSymbol}</p>
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

        {/* Batch/Expiry/Serial fields (shown only if enabled) */}
        {product.trackBatch && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Batch Number</label>
            <input value={batchNumber}
              onChange={e => setBatchNumber(e.target.value)}
              placeholder={product.batchNumberFormat || 'e.g. BATCH-001'}
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        )}
        {product.trackExpiry && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{product.manufacturingDateField || 'Mfg Date'}</label>
              <input type="date" value={manufacturingDate}
                onChange={e => setManufacturingDate(e.target.value)}
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{product.expiryDateField || 'Exp Date'}</label>
              <input type="date" value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        )}
        {product.trackSerial && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Serial Numbers</label>
            <textarea
              value={serialNumbers}
              onChange={e => setSerialNumbers(e.target.value)}
              placeholder="Enter serial numbers (one per line)"
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Enter one serial number per line</p>
          </div>
        )}

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

// ══════════════════════════════════════════════════════════════════
// SELL STOCK MODAL
// ══════════════════════════════════════════════════════════════════

function SellStockModal({ product, onClose, onSuccess }: {
  product: ProductWithRelations; onClose: () => void; onSuccess: () => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [unitId, setUnitId] = useState(product.sellingUnitId || product.baseUnitId)
  const [unitPrice, setUnitPrice] = useState(product.sellingPrice || 0)
  const [customerName, setCustomerName] = useState('')
  const [saving, setSaving] = useState(false)

  const availableUnits = product.units.filter(u => u.isSellingUnit)
  const selectedUnit = product.units.find(u => u.unitId === unitId)
  const totalPrice = unitPrice * quantity
  const totalInBase = selectedUnit ? quantity * selectedUnit.factorToBase : quantity

  const handleSell = async () => {
    setSaving(true)
    try {
      await productsApi.sell({ productId: product.id, unitId, quantity, unitPrice, customerName, notes: '' })
      showSuccess('Sale completed', `${quantity} ${selectedUnit?.unitSymbol || 'units'} sold successfully.`)
      onSuccess()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

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

// ══════════════════════════════════════════════════════════════════
// ADJUST STOCK MODAL
// ══════════════════════════════════════════════════════════════════

function AdjustStockModal({ product, onClose, onSuccess }: {
  product: ProductWithRelations; onClose: () => void; onSuccess: () => void
}) {
  const [newQuantity, setNewQuantity] = useState(product.currentStock)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [adjustType, setAdjustType] = useState<'opening' | 'adjustment'>('adjustment')

  const handleAdjust = async () => {
    setSaving(true)
    try {
      await productsApi.adjust({
        productId: product.id,
        newQuantity,
        notes: notes || (adjustType === 'opening' ? 'Opening stock initialization' : 'Stock adjustment'),
      })
      showSuccess('Stock adjusted', `Stock set to ${newQuantity} ${product.baseUnitSymbol}.`)
      onSuccess()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const difference = newQuantity - product.currentStock

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">A</span>
            Adjust Stock
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm font-medium text-foreground">{product.name}</p>
          <p className="text-xs text-muted-foreground">Current: {product.currentStock} {product.baseUnitSymbol}</p>
        </div>

        {/* Adjustment Type */}
        <div className="flex gap-2">
          <button
            onClick={() => setAdjustType('adjustment')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
              adjustType === 'adjustment'
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
            }`}
          >
            Stock Adjustment
          </button>
          <button
            onClick={() => setAdjustType('opening')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
              adjustType === 'opening'
                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
            }`}
          >
            Opening Stock
          </button>
        </div>

        {adjustType === 'opening' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
            <p className="font-medium">Opening Stock Initialization</p>
            <p className="mt-0.5">Set the initial stock quantity for this product. This will create an opening stock transaction.</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            New Quantity (in {product.baseUnitSymbol})
          </label>
          <input
            type="number" min="0" step="any"
            value={newQuantity}
            onChange={e => setNewQuantity(parseFloat(e.target.value) || 0)}
            className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {difference !== 0 && (
            <p className={`text-xs mt-1 ${difference > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {difference > 0 ? '+' : ''}{difference} {product.baseUnitSymbol} difference
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={adjustType === 'opening' ? 'Opening stock initialization' : 'Reason for adjustment'}
            className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={handleAdjust} disabled={saving || newQuantity < 0}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {adjustType === 'opening' ? 'Set Opening Stock' : 'Adjust Stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// IMAGES TAB
// ══════════════════════════════════════════════════════════════════

function ImagesTab({ product, onRefresh }: {
  product: ProductWithRelations; onRefresh: () => void
}) {
  const [images] = useState<ProductWithRelations['productImages']>(product.productImages)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = async (files: FileList) => {
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('image', file)
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) continue
        const data = await res.json()

        // Add image to product via update
        const currentPaths = images.map(i => i.imagePath)
        currentPaths.push(data.path)
        await productsApi.update(product.id, { productImages: currentPaths })
      }
      onRefresh()
    } catch (err) {
      showApiError(err)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  const handleDeleteImage = async (imageId: string) => {
    try {
      const remaining = images.filter(i => i.id !== imageId)
      await productsApi.update(product.id, { productImages: remaining.map(i => i.imagePath) })
      onRefresh()
    } catch (err) {
      showApiError(err)
    }
  }

  const handleSetPrimary = async (imageId: string) => {
    const reordered = [...images]
    const idx = reordered.findIndex(i => i.id === imageId)
    if (idx < 0) return
    const [item] = reordered.splice(idx, 1)
    reordered.unshift(item)
    await productsApi.update(product.id, { productImages: reordered.map(i => i.imagePath) })
    onRefresh()
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-5 rounded-full bg-sky-500" />
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Product Images</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{images.length} image{images.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-emerald-400 bg-emerald-50/50 scale-[1.02]'
            : 'border-muted-foreground/30 hover:border-emerald-300 hover:bg-emerald-50/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-emerald-500" />
        ) : (
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        )}
        <p className="text-sm font-medium text-foreground">
          {uploading ? 'Uploading...' : isDragging ? 'Drop images here' : 'Drag & drop images or click to browse'}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG, WEBP up to 5 MB</p>
      </div>

      {/* Existing Images */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <div
              key={img.id}
              className={`relative group rounded-lg border overflow-hidden aspect-square ${
                i === 0 ? 'ring-2 ring-emerald-400 border-emerald-400' : 'border-border'
              }`}
            >
              <img
                src={img.imagePath}
                alt={img.originalName || `Image ${i + 1}`}
                className="w-full h-full object-cover"
              />
              {i === 0 && (
                <span className="absolute top-1 left-1 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                  PRIMARY
                </span>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                {i > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSetPrimary(img.id) }}
                    className="p-1.5 rounded-md bg-white/90 hover:bg-white text-emerald-600 transition-colors shadow-xs"
                    title="Set as primary"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id) }}
                  className="p-1.5 rounded-md bg-white/90 hover:bg-white text-red-600 transition-colors shadow-xs"
                  title="Delete image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <FileImage className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No images uploaded yet</p>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// PRICING TAB
// ══════════════════════════════════════════════════════════════════

function PricingTab({ product, onRefresh }: {
  product: ProductWithRelations; onRefresh: () => void
}) {
  const [purchasePrice, setPurchasePrice] = useState(product.purchasePrice)
  const [sellingPrice, setSellingPrice] = useState(product.sellingPrice)
  const [mrp, setMrp] = useState(product.mrp)
  const [taxClass, setTaxClass] = useState(product.taxClass)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await productsApi.update(product.id, { purchasePrice, sellingPrice, mrp, taxClass })
      showSuccess('Pricing updated', 'Product prices have been saved.')
      onRefresh()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const potentialProfit = sellingPrice - purchasePrice
  const profitMargin = purchasePrice > 0 ? ((potentialProfit / purchasePrice) * 100).toFixed(1) : '0'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-amber-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Price Management</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Purchase Price (per {product.purchaseUnitSymbol || product.baseUnitSymbol})</label>
            <input
              type="number" min="0" step="0.01"
              value={purchasePrice}
              onChange={e => setPurchasePrice(parseFloat(e.target.value) || 0)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Selling Price (per {product.sellingUnitSymbol || product.baseUnitSymbol})</label>
            <input
              type="number" min="0" step="0.01"
              value={sellingPrice}
              onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">MRP (Max Retail Price)</label>
            <input
              type="number" min="0" step="0.01"
              value={mrp}
              onChange={e => setMrp(parseFloat(e.target.value) || 0)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tax Class</label>
            <select
              value={taxClass}
              onChange={e => setTaxClass(e.target.value)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">No Tax</option>
              <option value="gst-0">GST 0%</option>
              <option value="gst-5">GST 5%</option>
              <option value="gst-12">GST 12%</option>
              <option value="gst-18">GST 18%</option>
              <option value="gst-28">GST 28%</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-amber-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50 shadow-sm">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <Save className="w-4 h-4" /> Save Prices
          </button>
        </div>
      </div>

      {/* Profit Summary */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-emerald-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Profit Summary</h3>
        </div>
        <div className="space-y-3">
          <StatRow label="Purchase Price" value={`₹${purchasePrice.toFixed(2)}`} />
          <StatRow label="Selling Price" value={`₹${sellingPrice.toFixed(2)}`} />
          <StatRow label="MRP" value={mrp > 0 ? `₹${mrp.toFixed(2)}` : 'Not set'} />
          <div className="pt-2 border-t border-border">
            <StatRow label="Profit per Unit" value={`₹${potentialProfit.toFixed(2)}`} />
            <StatRow label="Margin" value={`${profitMargin}%`} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// PURCHASE HISTORY TAB
// ══════════════════════════════════════════════════════════════════

function PurchaseHistoryTab({ productId }: { productId: string }) {
  const [purchases, setPurchases] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    productsApi.getTransactions(productId)
      .then((txns: TransactionRow[]) => {
        setPurchases(txns.filter((t: TransactionRow) => t.transactionType === 'purchase'))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [productId])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1 h-5 rounded-full bg-emerald-500" />
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Purchase History</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{purchases.length} records</span>
      </div>
      {purchases.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No purchase records yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Base Qty</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {purchases.slice(0, 50).map((tx: TransactionRow) => (
                <tr key={tx.id}>
                  <td><span className="text-xs">{new Date(tx.createdAt).toLocaleDateString()}</span></td>
                  <td><span className="text-xs font-mono text-muted-foreground">{tx.referenceId?.slice(0, 8) ?? '-'}</span></td>
                  <td><span className="text-xs font-semibold text-emerald-600">+{tx.unitQuantity}</span></td>
                  <td><span className="text-xs">{tx.unitSymbol}</span></td>
                  <td><span className="text-xs text-muted-foreground">{tx.baseQuantity}</span></td>
                  <td><span className="text-xs text-muted-foreground truncate max-w-[120px]">{tx.notes || '-'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// SALES HISTORY TAB
// ══════════════════════════════════════════════════════════════════

function SalesHistoryTab({ productId }: { productId: string }) {
  const [sales, setSales] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    productsApi.getTransactions(productId)
      .then((txns: TransactionRow[]) => {
        setSales(txns.filter((t: TransactionRow) => t.transactionType === 'sale'))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [productId])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1 h-5 rounded-full bg-orange-500" />
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Sales History</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{sales.length} records</span>
      </div>
      {sales.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No sales records yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Base Qty</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 50).map((tx: TransactionRow) => (
                <tr key={tx.id}>
                  <td><span className="text-xs">{new Date(tx.createdAt).toLocaleDateString()}</span></td>
                  <td><span className="text-xs font-mono text-muted-foreground">{tx.referenceId?.slice(0, 8) ?? '-'}</span></td>
                  <td><span className="text-xs font-semibold text-red-600">-{tx.unitQuantity}</span></td>
                  <td><span className="text-xs">{tx.unitSymbol}</span></td>
                  <td><span className="text-xs text-muted-foreground">{tx.baseQuantity}</span></td>
                  <td><span className="text-xs text-muted-foreground truncate max-w-[120px]">{tx.notes || '-'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// STOCK MOVEMENTS TAB
// ══════════════════════════════════════════════════════════════════

function StockMovementsTab({ productId }: { productId: string }) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    productsApi.getTransactions(productId)
      .then(setTransactions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [productId])

  const typeColors: Record<string, { bg: string; dot: string; label: string }> = {
    purchase: { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Purchase' },
    sale: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'Sale' },
    adjustment: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'Adjustment' },
    opening_stock: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'Opening Stock' },
    return: { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', label: 'Return' },
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1 h-5 rounded-full bg-blue-500" />
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Stock Movements</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{transactions.length} records</span>
      </div>
      {transactions.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No stock movements yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Previous</th>
                <th>Remaining</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 100).map((tx: TransactionRow) => {
                const meta = typeColors[tx.transactionType] ?? { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500', label: tx.transactionType }
                return (
                  <tr key={tx.id}>
                    <td><span className="text-xs">{new Date(tx.createdAt).toLocaleDateString()}</span></td>
                    <td><span className="text-xs font-mono text-muted-foreground">{tx.referenceId?.slice(0, 8) ?? '-'}</span></td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${meta.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td>
                      <span className={`text-xs font-semibold ${
                        tx.transactionType === 'purchase' || tx.transactionType === 'opening_stock'
                          ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {tx.transactionType === 'purchase' || tx.transactionType === 'opening_stock' ? '+' : ''}{tx.baseQuantity}
                      </span>
                    </td>
                    <td><span className="text-xs">{tx.unitSymbol}</span></td>
                    <td><span className="text-xs text-muted-foreground">{tx.previousStock}</span></td>
                    <td><span className="text-xs font-medium">{tx.remainingStock}</span></td>
                    <td><span className="text-xs text-muted-foreground truncate max-w-[150px]">{tx.notes || '-'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ══════════════════════════════════════════════════════════════════

function SettingsTab({ product, onRefresh }: { product: ProductWithRelations; onRefresh: () => void }) {
  const [trackBatch, setTrackBatch] = useState(product.trackBatch)
  const [trackExpiry, setTrackExpiry] = useState(product.trackExpiry)
  const [trackSerial, setTrackSerial] = useState(product.trackSerial)
  const [status, setStatus] = useState(product.status)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await productsApi.update(product.id, {
        trackBatch,
        trackExpiry,
        trackSerialNumber: trackSerial,
        status,
      })
      showSuccess('Settings updated', 'Product settings have been saved.')
      onRefresh()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Tracking Settings */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-rose-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Tracking Settings</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Enable or disable tracking features. These affect which fields appear in purchase forms.
        </p>
        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-rose-200 hover:bg-rose-50/20 transition-all cursor-pointer group">
            <input
              type="checkbox"
              checked={trackBatch}
              onChange={e => setTrackBatch(e.target.checked)}
              className="mt-0.5 rounded border-input text-rose-600 focus:ring-rose-500"
            />
            <div>
              <p className="text-xs font-medium text-foreground group-hover:text-rose-700 transition-colors">Track Batch</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Track batch numbers for recalls and traceability</p>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-rose-200 hover:bg-rose-50/20 transition-all cursor-pointer group">
            <input
              type="checkbox"
              checked={trackExpiry}
              onChange={e => setTrackExpiry(e.target.checked)}
              className="mt-0.5 rounded border-input text-rose-600 focus:ring-rose-500"
            />
            <div>
              <p className="text-xs font-medium text-foreground group-hover:text-rose-700 transition-colors">Track Expiry</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Track manufacturing and expiry dates</p>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-rose-200 hover:bg-rose-50/20 transition-all cursor-pointer group">
            <input
              type="checkbox"
              checked={trackSerial}
              onChange={e => setTrackSerial(e.target.checked)}
              className="mt-0.5 rounded border-input text-rose-600 focus:ring-rose-500"
            />
            <div>
              <p className="text-xs font-medium text-foreground group-hover:text-rose-700 transition-colors">Track Serial Numbers</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Track individual serial numbers</p>
            </div>
          </label>
        </div>
      </div>

      {/* Status & Additional Settings */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-gray-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Product Status</h3>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as 'active' | 'inactive' | 'discontinued')}
            className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
        <div className="pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-rose-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-rose-700 disabled:opacity-50 shadow-sm">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>

        {/* Current settings summary */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-1 mt-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Current Configuration</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {trackBatch && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-medium">Batch Tracking</span>}
            {trackExpiry && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-medium">Expiry Tracking</span>}
            {trackSerial && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-medium">Serial Tracking</span>}
            {!trackBatch && !trackExpiry && !trackSerial && <span className="text-xs text-muted-foreground">No tracking enabled</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
