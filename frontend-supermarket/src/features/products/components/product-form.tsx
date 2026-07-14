import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { X, Loader2, Plus, Trash2, AlertTriangle, CheckCircle, HelpCircle, Image, GripVertical } from "lucide-react"
import type { CreateProductInput, UnitRow, ProductConversionRow } from "@/lib/api"
import { productsApi } from "@/lib/api"

interface ProductFormProps {
  form: CreateProductInput
  editingId: string | null
  saving: boolean
  activeUnits: UnitRow[]
  existingConversions?: ProductConversionRow[]
  onFormChange: (form: CreateProductInput) => void
  onSave: () => void
  onCancel: () => void
}

interface UnitValidity {
  unitId: string
  unitName: string
  unitSymbol: string
  valid: boolean | null
  checking: boolean
  factor: number | null
  error: string | null
}



export function ProductForm({
  form, editingId, saving, activeUnits, existingConversions,
  onFormChange, onSave, onCancel,
}: ProductFormProps) {
  // Track conversion path validity for all units
  const [unitValidities, setUnitValidities] = useState<Record<string, UnitValidity>>({})
  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getUnitValidity = (unitId: string): UnitValidity | undefined => unitValidities[unitId]

  const validateConversionPaths = useCallback(async (baseUnitId: string, unitIdsToCheck: string[]) => {
    if (!baseUnitId || unitIdsToCheck.length === 0) return

    setUnitValidities(prev => {
      const next = { ...prev }
      for (const uid of unitIdsToCheck) {
        next[uid] = { ...next[uid], checking: true, valid: null }
      }
      return next
    })

    try {
      const results = await productsApi.checkConversions(baseUnitId, unitIdsToCheck)
      setUnitValidities(prev => {
        const next = { ...prev }
        for (const r of results) {
          next[r.unitId] = {
            unitId: r.unitId,
            unitName: r.unitName,
            unitSymbol: r.unitSymbol,
            valid: r.valid,
            checking: false,
            factor: r.factor,
            error: r.error,
          }
        }
        return next
      })
    } catch {
      setUnitValidities(prev => {
        const next = { ...prev }
        for (const uid of unitIdsToCheck) {
          next[uid] = { ...next[uid], checking: false, valid: null }
        }
        return next
      })
    }
  }, [])

  // Build list of convertible options for dropdowns
  const convertibleOptions = useMemo((): { convertible: UnitRow[] } => {
    if (!form.baseUnitId) return { convertible: [] }

    const baseUnit = activeUnits.find((u: UnitRow) => u.id === form.baseUnitId)
    if (!baseUnit) return { convertible: [] }

    const sameTypeUnits = activeUnits.filter((u: UnitRow) =>
      u.type === baseUnit.type && u.id !== form.baseUnitId && u.status === 'active'
    )

    // Also consider product-specific conversions — if user defined a custom conversion,
    // that unit should appear as convertible regardless of global chain
    const customConvertibleIds = new Set(
        (form.productConversions ?? []).flatMap(c => [c.fromUnitId, c.toUnitId])
      )

    const convertible: UnitRow[] = []
    for (const u of sameTypeUnits) {
      const v = getUnitValidity(u.id)
      if (v?.valid === true || customConvertibleIds.has(u.id)) {
        convertible.push(u)
      }
    }

    return { convertible }
  }, [form.baseUnitId, form.productConversions, activeUnits, unitValidities])

  // When base unit changes, check ALL same-type units for conversion validity
  useEffect(() => {
    if (!form.baseUnitId) return

    const baseUnit = activeUnits.find(u => u.id === form.baseUnitId)
    if (!baseUnit) return

    const sameTypeUnitIds = activeUnits
      .filter(u => u.type === baseUnit.type && u.id !== form.baseUnitId && u.status === 'active')
      .map(u => u.id)

    if (sameTypeUnitIds.length > 0) {
      if (validationTimer.current) clearTimeout(validationTimer.current)
      validationTimer.current = setTimeout(() => {
        validateConversionPaths(form.baseUnitId, sameTypeUnitIds)
      }, 300)
    }

    return () => {
      if (validationTimer.current) clearTimeout(validationTimer.current)
    }
  }, [form.baseUnitId])

  const addUnit = () => {
    onFormChange({
      ...form,
      additionalUnits: [...form.additionalUnits, { unitId: '', isPurchaseUnit: false, isSellingUnit: false }],
    })
  }

  const removeUnit = (index: number) => {
    const removed = form.additionalUnits[index]
    onFormChange({
      ...form,
      additionalUnits: form.additionalUnits.filter((_, i) => i !== index),
    })
    if (removed?.unitId) {
      setUnitValidities(prev => {
        const next = { ...prev }
        delete next[removed.unitId]
        return next
      })
    }
  }

  const updateUnit = (index: number, field: string, value: unknown) => {
    const updated = form.additionalUnits.map((u, i) =>
      i === index ? { ...u, [field]: value } : u
    )
    onFormChange({ ...form, additionalUnits: updated })
  }

  // ── Product-specific Conversions ──────────────────────────────

  const addProductConversion = () => {
    onFormChange({
      ...form,
      productConversions: [
        ...(form.productConversions ?? []),
        { fromUnitId: '', toUnitId: '', conversionFactor: 1 },
      ],
    })
  }

  const removeProductConversion = (index: number) => {
    onFormChange({
      ...form,
      productConversions: (form.productConversions ?? []).filter((_, i) => i !== index),
    })
  }

  const updateProductConversion = (index: number, field: string, value: unknown) => {
    const updated = (form.productConversions ?? []).map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    )
    onFormChange({ ...form, productConversions: updated })
  }

  // ── Hooks ─────────────────────────────────────────────────────

  const hasInvalidConversion = () => {
    const checkUnit = (unitId: string | null | undefined) => {
      if (!unitId || unitId === form.baseUnitId) return false
      const v = getUnitValidity(unitId)
      return v?.valid === false
    }
    if (checkUnit(form.purchaseUnitId)) return true
    if (checkUnit(form.sellingUnitId)) return true
    for (const au of form.additionalUnits) {
      if (checkUnit(au.unitId)) return true
    }
    return false
  }

  const isCheckingConversions = () => {
    const checkUnit = (unitId: string | null | undefined) => {
      if (!unitId || unitId === form.baseUnitId) return false
      const v = getUnitValidity(unitId)
      return v?.checking === true
    }
    if (checkUnit(form.purchaseUnitId)) return true
    if (checkUnit(form.sellingUnitId)) return true
    for (const au of form.additionalUnits) {
      if (checkUnit(au.unitId)) return true
    }
    return false
  }

  const invalidFound = hasInvalidConversion()
  const checkingConversions = isCheckingConversions()
  const isCreateDisabled = saving || !form.name || !form.sku || !form.baseUnitId || invalidFound || checkingConversions

  const selectedBaseUnit = activeUnits.find(u => u.id === form.baseUnitId)
  const selectedPurchaseUnit = activeUnits.find(u => u.id === form.purchaseUnitId)
  const selectedSellingUnit = activeUnits.find(u => u.id === form.sellingUnitId)

  // Helper: look up a unit by ID from the active units list
  const getUnitName = (id: string): string => activeUnits.find(u => u.id === id)?.name ?? '?'
  const getUnitSymbol = (id: string): string => activeUnits.find(u => u.id === id)?.symbol ?? '?'

  // ── Render helpers ────────────────────────────────────────────

  const renderUnitDropdown = (
    label: string,
    value: string | null | undefined,
    onChange: (val: string | null) => void,
    options: UnitRow[],
    placeholder: string,
    isRequired: boolean,
    validity: UnitValidity | undefined
  ) => {
    const borderColor =
      validity?.checking ? 'border-blue-300' :
      validity?.valid === true ? 'border-emerald-400' :
      validity?.valid === false ? 'border-red-400' :
      'border-input'

    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          {label} {isRequired && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <select
            value={value ?? ''}
            onChange={e => onChange(e.target.value || null)}
            className={`w-full h-9 px-3 border ${borderColor} rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors pr-8`}
          >
            <option value="">{placeholder}</option>
            {options.map(u => (
              <option key={u.id} value={u.id} title={`${u.name} (${u.symbol}) — ${u.type}`}>
                {u.name} ({u.symbol}) — {u.type}
              </option>
            ))}
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {validity?.checking && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
            {!validity?.checking && validity?.valid === true && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
            {!validity?.checking && validity?.valid === false && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
          </div>
        </div>
        {!validity?.checking && validity?.valid === true && validity.factor !== null && (
          <p className="text-[10px] text-emerald-600 mt-1">
            1 {validity.unitSymbol} = {validity.factor} {selectedBaseUnit?.symbol ?? ''} ✓
          </p>
        )}
        {!validity?.checking && validity?.valid === false && validity.error && (
          <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {validity.error}
          </p>
        )}
      </div>
    )
  }

  const renderInput = (
    label: string,
    value: string,
    onChange: (val: string) => void,
    placeholder: string,
    required: boolean,
    opts?: { type?: string; hint?: string; icon?: React.ReactNode }
  ) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {opts?.icon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {opts.icon}
          </div>
        )}
        <input
          type={opts?.type ?? 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${opts?.icon ? 'pl-8' : ''}`}
        />
      </div>
      {opts?.hint && <p className="text-[10px] text-muted-foreground mt-1">{opts.hint}</p>}
    </div>
  )

  const renderNumberInput = (
    label: string,
    value: number,
    onChange: (val: number) => void,
    opts?: { min?: number; step?: string; hint?: string; symbol?: string }
  ) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <div className="relative">
        {opts?.symbol && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
            {opts.symbol}
          </div>
        )}
        <input
          type="number"
          min={opts?.min ?? 0}
          step={opts?.step ?? 'any'}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${opts?.symbol ? 'pl-8' : ''}`}
        />
      </div>
      {opts?.hint && <p className="text-[10px] text-muted-foreground mt-1">{opts.hint}</p>}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm ${
            editingId
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
          }`}>
            {editingId ? 'E' : 'N'}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {editingId ? 'Edit Product' : 'New Product'}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {editingId ? 'Update product details' : 'Create a new product in inventory'}
            </p>
          </div>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-6">

        {/* ═══════════════════════════════════════════════════════
            SECTION 1: BASIC INFORMATION
           ═══════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-4 rounded-full bg-emerald-500" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Basic Information</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderInput('Product Name', form.name, (v) => onFormChange({ ...form, name: v }), 'e.g. Paracetamol 500mg', true)}
            {renderInput('SKU', form.sku, (v) => onFormChange({ ...form, sku: v }), 'e.g. MED-PARA-001', true, { hint: 'Must be unique' })}
            {renderInput('Barcode', form.barcode ?? '', (v) => onFormChange({ ...form, barcode: v }), 'e.g. 8901234567890', false)}
            {renderInput('Category', form.category, (v) => onFormChange({ ...form, category: v }), 'e.g. Medicines', false)}
            {renderInput('Brand', form.brand ?? '', (v) => onFormChange({ ...form, brand: v }), 'e.g. Cipla', false)}
            {renderInput('Description', form.description, (v) => onFormChange({ ...form, description: v }), 'Product description', false)}              {renderInput('Image URL', form.imageUrl ?? '', (v) => onFormChange({ ...form, imageUrl: v }), 'https://example.com/image.jpg', false, {
              hint: 'Optional product image link',
              icon: <Image className="w-3.5 h-3.5" />,
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            SECTION 2: INVENTORY UNITS
           ═══════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-4 rounded-full bg-blue-500" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Inventory Units</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Base Unit <span className="text-red-500">*</span>
                <span className="ml-1 text-[10px] text-emerald-600 font-medium">(Storage Unit)</span>
              </label>
              <select
                value={form.baseUnitId}
                onChange={e => {
                  onFormChange({
                    ...form,
                    baseUnitId: e.target.value,
                    // Reset purchase/selling if they conflict with new base
                    purchaseUnitId: form.purchaseUnitId === e.target.value ? null : form.purchaseUnitId,
                    sellingUnitId: form.sellingUnitId === e.target.value ? null : form.sellingUnitId,
                  })
                }}
                className="w-full h-9 px-3 border border-emerald-300 rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              >
                <option value="">Select base unit...</option>
                {activeUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.symbol}) — {u.type}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 shrink-0" />
                Inventory is ALWAYS stored in this unit
              </p>
            </div>

            {renderUnitDropdown(
              'Purchase Unit',
              form.purchaseUnitId,
              (val) => onFormChange({ ...form, purchaseUnitId: val }),
              convertibleOptions?.convertible ?? [],
              convertibleOptions && convertibleOptions.convertible.length > 0
                ? 'Same as base unit'
                : 'No convertible units (define a conversion first)',
              false,
              form.purchaseUnitId && form.purchaseUnitId !== form.baseUnitId
                ? getUnitValidity(form.purchaseUnitId)
                : undefined
            )}

            {renderUnitDropdown(
              'Selling Unit',
              form.sellingUnitId,
              (val) => onFormChange({ ...form, sellingUnitId: val }),
              convertibleOptions?.convertible ?? [],
              convertibleOptions && convertibleOptions.convertible.length > 0
                ? 'Same as base unit'
                : 'No convertible units (define a conversion first)',
              false,
              form.sellingUnitId && form.sellingUnitId !== form.baseUnitId
                ? getUnitValidity(form.sellingUnitId)
                : undefined
            )}
          </div>

          {/* Additional Units */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Additional Units</label>
              <button
                onClick={addUnit}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Unit
              </button>
            </div>
            <div className="space-y-2">
              {form.additionalUnits.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-lg border border-dashed border-border">
                  No additional units. Click "Add Unit" to define more purchase/selling units.
                </p>
              )}
              {form.additionalUnits.map((au, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border hover:border-muted-foreground/30 transition-colors group">
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                  <select
                    value={au.unitId}
                    onChange={e => updateUnit(i, 'unitId', e.target.value)}
                    className="flex-1 h-8 px-2 border border-input rounded text-xs bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  >
                    <option value="">Select unit...</option>
                    {(convertibleOptions?.convertible ?? [])
                      .filter(u => !form.additionalUnits.some((au2, j) => au2.unitId === u.id && j !== i))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.symbol}) — {u.type}</option>
                      ))}
                    {convertibleOptions && convertibleOptions.convertible.length === 0 && (
                      <option value="" disabled>No convertible units available</option>
                    )}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none hover:text-emerald-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={au.isPurchaseUnit}
                      onChange={e => updateUnit(i, 'isPurchaseUnit', e.target.checked)}
                      className="rounded border-input text-emerald-600 focus:ring-emerald-500"
                    />
                    Buy
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none hover:text-orange-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={au.isSellingUnit}
                      onChange={e => updateUnit(i, 'isSellingUnit', e.target.checked)}
                      className="rounded border-input text-orange-600 focus:ring-orange-500"
                    />
                    Sell
                  </label>
                  <button onClick={() => removeUnit(i)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            SECTION 3: UNIT CONVERSIONS
           ═══════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-4 rounded-full bg-purple-500" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Unit Conversions</h4>
            <span className="text-[10px] text-muted-foreground">
              (Product-specific — overrides global conversions)
            </span>
          </div>

          {existingConversions && existingConversions.length > 0 && !form.productConversions?.length && (
            <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <p className="font-medium">Existing product conversions will be loaded on save.</p>
              <p className="text-blue-600 mt-0.5">Add new conversions below or edit existing ones.</p>
            </div>
          )}

          <div className="space-y-2">
            {(form.productConversions ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-lg border border-dashed border-border">
                No custom conversions defined. Global conversions will be used as defaults, or add product-specific rules below.
              </p>
            )}
            {(form.productConversions ?? []).map((conv, i) => {
              const fromName = getUnitName(conv.fromUnitId)
              const fromSym = getUnitSymbol(conv.fromUnitId)
              const toName = getUnitName(conv.toUnitId)
              const toSym = getUnitSymbol(conv.toUnitId)
              const hasBothUnits = conv.fromUnitId && conv.toUnitId
              const isValid = hasBothUnits && conv.conversionFactor > 0

              return (
                <div key={i} className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                  {/* Input Row */}
                  <div className="flex items-center gap-2 p-3">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">From (smaller)</label>
                        <select
                          value={conv.fromUnitId}
                          onChange={e => updateProductConversion(i, 'fromUnitId', e.target.value)}
                          className="w-full h-8 px-2 border border-input rounded text-xs bg-card focus:outline-none focus:ring-2 focus:ring-purple-300 transition-colors"
                        >
                          <option value="">Select unit...</option>
                          {activeUnits.filter(u => u.status === 'active').map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.symbol}) — {u.type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">To (larger)</label>
                        <select
                          value={conv.toUnitId}
                          onChange={e => updateProductConversion(i, 'toUnitId', e.target.value)}
                          className="w-full h-8 px-2 border border-input rounded text-xs bg-card focus:outline-none focus:ring-2 focus:ring-purple-300 transition-colors"
                        >
                          <option value="">Select unit...</option>
                          {activeUnits.filter(u => u.status === 'active').map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.symbol}) — {u.type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Factor</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number" step="0.000001" min="0.000001"
                            value={conv.conversionFactor}
                            onChange={e => updateProductConversion(i, 'conversionFactor', parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 24"
                            className="flex-1 h-8 px-2 border border-input rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-300 transition-colors"
                          />
                          <button onClick={() => removeProductConversion(i)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Relationship Preview */}
                  {isValid && (
                    <div className="mx-3 mb-3 bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-purple-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        Relationship Preview
                      </p>
                      <div className="mt-2 flex items-center justify-center gap-3 text-sm">
                        <span className="font-bold text-purple-800 bg-white px-3 py-1.5 rounded-md border border-purple-200 shadow-sm">
                          1 {toSym}
                        </span>
                        <span className="text-purple-500 font-bold text-lg">=</span>
                        <span className="font-bold text-purple-800 bg-white px-3 py-1.5 rounded-md border border-purple-200 shadow-sm">
                          {conv.conversionFactor} {fromSym}
                        </span>
                      </div>
                      <p className="text-[10px] text-purple-600 text-center mt-1.5">
                        1 {toName} = {conv.conversionFactor} × {fromName}
                      </p>
                      {selectedBaseUnit && (
                        <p className="text-[10px] text-purple-600 text-center mt-0.5">
                          Inventory stored in <strong>{selectedBaseUnit.name}</strong> — will convert via this rule
                        </p>
                      )}
                    </div>
                  )}

                  {/* Incomplete state hint */}
                  {hasBothUnits && !isValid && (
                    <div className="mx-3 mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-center text-[10px] text-amber-700">
                      ⚠ Enter a conversion factor greater than 0
                    </div>
                  )}
                </div>
              )
            })}
            <button
              onClick={addProductConversion}
              className="w-full py-2.5 border-2 border-dashed border-purple-300 rounded-lg text-xs text-purple-600 hover:text-purple-700 hover:border-purple-400 hover:bg-purple-50/50 transition-all font-medium flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add Custom Conversion Rule
            </button>
          </div>

          {/* Conversion chain visualization */}
          {(form.productConversions ?? []).length > 1 && (
            <div className="mt-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3">
              <p className="text-[10px] font-medium text-indigo-600 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Conversion Chain
              </p>
              <div className="flex items-center flex-wrap gap-1.5">
                {(form.productConversions ?? []).map((conv, i) => {
                  const toSym = getUnitSymbol(conv.toUnitId)
                  const fromSym = getUnitSymbol(conv.fromUnitId)
                  if (!conv.fromUnitId || !conv.toUnitId) return null
                  return (
                    <span key={i} className="inline-flex items-center gap-1 text-xs">
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-medium">{toSym}</span>
                      <span className="text-indigo-400">→</span>
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">{fromSym}</span>
                      {i < (form.productConversions ?? []).length - 1 && (
                        <span className="text-indigo-400 mx-0.5">→</span>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            SECTION 4: PRICING
           ═══════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-4 rounded-full bg-amber-500" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Pricing</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderNumberInput(
              `Purchase Price${selectedPurchaseUnit ? ` (per ${selectedPurchaseUnit.symbol})` : ''}`,
              form.purchasePrice ?? 0,
              (v) => onFormChange({ ...form, purchasePrice: v }),
              { symbol: '₹', hint: selectedPurchaseUnit ? `Price per ${selectedPurchaseUnit.name} (${selectedPurchaseUnit.symbol})` : 'Select a purchase unit to see the unit' }
            )}
            {renderNumberInput(
              `Selling Price${selectedSellingUnit ? ` (per ${selectedSellingUnit.symbol})` : ''}`,
              form.sellingPrice ?? 0,
              (v) => onFormChange({ ...form, sellingPrice: v }),
              { symbol: '₹', hint: selectedSellingUnit ? `Price per ${selectedSellingUnit.name} (${selectedSellingUnit.symbol})` : 'Select a selling unit to see the unit' }
            )}
          </div>
          {selectedBaseUnit && (
            <div className="mt-3 bg-amber-50/50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <p className="font-medium mb-1">💡 Pricing Logic</p>
              <p>Purchase price is per {selectedPurchaseUnit ? `${selectedPurchaseUnit.symbol}` : 'purchase unit'} and selling price is per {selectedSellingUnit ? `${selectedSellingUnit.symbol}` : 'selling unit'}.</p>
              <p className="mt-0.5">The system stores prices in these units and converts to base unit ({selectedBaseUnit.symbol}) for inventory valuation.</p>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            SECTION 5: STOCK SETTINGS
           ═══════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-4 rounded-full bg-cyan-500" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Stock Settings</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Opening Stock
                {selectedPurchaseUnit
                  ? ` (in ${selectedPurchaseUnit.symbol})`
                  : selectedBaseUnit
                  ? ` (in ${selectedBaseUnit.symbol})`
                  : ''}
              </label>
              <input
                type="number" min="0" step="any"
                value={form.openingStock}
                onChange={e => onFormChange({ ...form, openingStock: parseFloat(e.target.value) || 0 })}
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
              {form.openingStock > 0 && selectedPurchaseUnit && selectedBaseUnit && (
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-[10px] text-emerald-600 font-medium">
                    ✓ {form.openingStock} {selectedPurchaseUnit.symbol} → converted to {selectedBaseUnit.symbol} via conversion → stored as <strong>{selectedBaseUnit.symbol}</strong>
                  </p>
                  <p className="text-[10px] text-amber-600">
                    ⓘ Database stores ONLY {selectedBaseUnit.symbol}
                  </p>
                </div>
              )}
              {form.openingStock > 0 && !selectedPurchaseUnit && selectedBaseUnit && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Opening stock is already in {selectedBaseUnit.symbol} (same as base unit)
                </p>
              )}
            </div>

            {renderNumberInput(
              `Minimum Stock (in ${selectedBaseUnit?.symbol ?? 'base unit'})`,
              form.minStock,
              (v) => onFormChange({ ...form, minStock: v }),
              { hint: selectedBaseUnit ? `Alert when stock drops below this many ${selectedBaseUnit.symbol}` : '' }
            )}
            {renderNumberInput(
              `Maximum Stock (in ${selectedBaseUnit?.symbol ?? 'base unit'})`,
              form.maxStock ?? 0,
              (v) => onFormChange({ ...form, maxStock: v }),
              { hint: 'Overstock warning threshold' }
            )}
            {renderNumberInput(
              `Reorder Level (in ${selectedBaseUnit?.symbol ?? 'base unit'})`,
              form.reorderLevel ?? 0,
              (v) => onFormChange({ ...form, reorderLevel: v }),
              { hint: 'When stock falls below this, trigger reorder' }
            )}
          </div>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════
          FOOTER / ACTIONS
         ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2">
          {invalidFound && (
            <p className="text-[10px] text-red-600 flex items-center gap-1 bg-red-50 px-2 py-1 rounded">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Fix conversion path errors above before creating
            </p>
          )}
          {checkingConversions && (
            <p className="text-[10px] text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              Checking conversion paths...
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isCreateDisabled}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:from-emerald-700 hover:to-emerald-600 transition-all disabled:opacity-50 shadow-sm"
            title={invalidFound ? 'Some units have no conversion path to the base unit' : ''}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingId ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  )
}
