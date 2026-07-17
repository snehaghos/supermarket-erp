"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, RefreshCw, Search } from "lucide-react"
import {
  productsApi, unitsApi,
  type ProductWithRelations, type CreateProductInput, type UpdateProductInput,
  type UnitRow, type DisplayStock,
} from "@/lib/api"
import { showSuccess, showApiError } from "@/lib/errors"
import { ProductForm } from "./product-form"
import { ProductTable } from "./product-table"
import { ProductDetailsPage } from "./product-details"

const emptyForm: CreateProductInput = {
  name: '', category: 'General', sku: '', barcode: '', brand: '', description: '',
  baseUnitId: '', purchaseUnitId: null, sellingUnitId: null,
  purchasePrice: 0, sellingPrice: 0, mrp: 0, taxClass: '',
  minStock: 0, maxStock: 0, reorderLevel: 0,
  trackBatch: false, trackExpiry: false, trackSerialNumber: false,
  status: 'active',
  additionalUnits: [],
  productConversions: [],
}

export function ProductsSection() {
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [displayStocks, setDisplayStocks] = useState<Record<string, DisplayStock>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateProductInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
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
      showApiError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false) }

  const openEdit = (product: ProductWithRelations) => {
    setForm({
      name: product.name,
      category: product.category,
      sku: product.sku,
      barcode: product.barcode,
      brand: product.brand,
      description: product.description,
      baseUnitId: product.baseUnitId,
      trackBatch: product.trackBatch,
      trackExpiry: product.trackExpiry,
      trackSerialNumber: product.trackSerial,
      purchaseUnitId: product.purchaseUnitId,
      sellingUnitId: product.sellingUnitId,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      mrp: product.mrp,
      taxClass: product.taxClass,
      minStock: product.minStock,
      maxStock: product.maxStock,
      reorderLevel: product.reorderLevel,
      status: product.status,
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
        if (form.baseUnitId) input.baseUnitId = form.baseUnitId
        input.purchaseUnitId = form.purchaseUnitId
        input.sellingUnitId = form.sellingUnitId
        if (form.purchasePrice !== undefined) input.purchasePrice = form.purchasePrice
        if (form.sellingPrice !== undefined) input.sellingPrice = form.sellingPrice
        if (form.mrp !== undefined) input.mrp = form.mrp
        if (form.taxClass !== undefined) input.taxClass = form.taxClass
        if (form.minStock >= 0) input.minStock = form.minStock
        if (form.maxStock !== undefined) input.maxStock = form.maxStock
        if (form.reorderLevel !== undefined) input.reorderLevel = form.reorderLevel
        if (form.trackBatch !== undefined) input.trackBatch = form.trackBatch
        if (form.trackExpiry !== undefined) input.trackExpiry = form.trackExpiry
        if (form.trackSerialNumber !== undefined) input.trackSerialNumber = form.trackSerialNumber
        if (form.status) input.status = form.status
        if (form.additionalUnits) input.additionalUnits = form.additionalUnits
        if (form.productConversions) input.productConversions = form.productConversions
        await productsApi.update(editingId, input)
        showSuccess('Product updated', 'The product has been saved successfully.')
      } else {
        await productsApi.create(form)
        showSuccess('Product created', 'The new product has been added to inventory.')
      }
      resetForm()
      await fetchData()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await productsApi.delete(id)
      showSuccess('Product deleted', 'The product has been removed from inventory.')
      await fetchData()
    } catch (err) {
      showApiError(err)
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

  // If a product is selected, show its details page
  if (selectedProductId) {
    const product = products.find(p => p.id === selectedProductId)
    if (product) {
      return (
        <ProductDetailsPage
          product={product}
          activeUnits={activeUnits}
          onBack={() => setSelectedProductId(null)}
        />
      )
    }
  }

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
        onViewDetails={(p) => { setSelectedProductId(p.id); setSearch('') }}
      />
    </div>
  )
}
