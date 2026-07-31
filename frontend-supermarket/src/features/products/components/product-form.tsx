import { useState, useMemo } from "react"
import { X, Loader2, Plus, Trash2, AlertTriangle, HelpCircle, ChevronDown, ChevronRight, GripVertical } from "lucide-react"
import type { CreateProductInput, UnitRow, ProductConversionRow } from "@/lib/api"

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

// ── Collapsible Section Component ───────────────────────────────

function CollapsibleSection({
  title, icon, color, defaultOpen, children,
}: {
  title: string
  icon: React.ReactNode
  color: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden transition-all duration-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`w-1 h-5 rounded-full ${color}`} />
          {icon}
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h4>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      <div className={`transition-all duration-200 overflow-hidden ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────

export function ProductForm({
  form, editingId, saving, activeUnits, existingConversions,
  onFormChange, onSave, onCancel,
}: ProductFormProps) {
  const isAddMode = !editingId

  // Filter units by same measurement type as base unit (for dropdowns)
  const sameTypeUnits = useMemo((): UnitRow[] => {
    if (!form.baseUnitId) return []
    const baseUnit = activeUnits.find(u => u.id === form.baseUnitId)
    if (!baseUnit) return []
    return activeUnits.filter(u =>
      (u.measurementTypeId === baseUnit.measurementTypeId || u.isPackaging) &&
      u.id !== form.baseUnitId && u.status === 'active'
    )
  }, [form.baseUnitId, activeUnits])

  // ── Conversion Validation Helpers ─────────────────────────────

  const conversionErrors = useMemo((): string[] => {
    const errors: string[] = []
    const conversions = form.productConversions ?? []
    const seenPairs = new Set<string>()

    for (let i = 0; i < conversions.length; i++) {
      const c = conversions[i]
      if (!c.fromUnitId || !c.toUnitId) continue

      if (c.fromUnitId === c.toUnitId) {
        errors.push(`Row ${i + 1}: Larger and smaller unit must be different`)
      }

      const pair = `${c.fromUnitId}-${c.toUnitId}`
      if (seenPairs.has(pair)) {
        errors.push(`Row ${i + 1}: Duplicate relationship`)
      }
      seenPairs.add(pair)

      const fromUnit = activeUnits.find(u => u.id === c.fromUnitId)
      const toUnit = activeUnits.find(u => u.id === c.toUnitId)
      if (fromUnit && toUnit && fromUnit.measurementTypeId !== toUnit.measurementTypeId) {
        if (!fromUnit.isPackaging && !toUnit.isPackaging) {
          errors.push(`Row ${i + 1}: Units must be same measurement type`)
        }
      }
    }

    return errors
  }, [form.productConversions, activeUnits])

  // ── Additional Units ──────────────────────────────────────────

  const addUnit = () => {
    onFormChange({
      ...form,
      additionalUnits: [...form.additionalUnits, { unitId: '', isPurchaseUnit: false, isSellingUnit: false }],
    })
  }

  const removeUnit = (index: number) => {
    onFormChange({
      ...form,
      additionalUnits: form.additionalUnits.filter((_, i) => i !== index),
    })
  }

  const updateUnit = (index: number, unitId: string) => {
    const updated = form.additionalUnits.map((u, i) =>
      i === index ? { ...u, unitId } : u
    )
    onFormChange({ ...form, additionalUnits: updated })
  }

  // Get units already selected (for filtering out duplicates)
  const selectedAdditionalUnitIds = form.additionalUnits.map(u => u.unitId).filter(Boolean)

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

  // ── Validation ────────────────────────────────────────────────

  const invalidFound = conversionErrors.length > 0
  const isCreateDisabled = saving || !form.name || !form.sku || !form.baseUnitId || invalidFound

  const selectedBaseUnit = activeUnits.find(u => u.id === form.baseUnitId)
  const selectedPurchaseUnit = activeUnits.find(u => u.id === form.purchaseUnitId)
  const selectedSellingUnit = activeUnits.find(u => u.id === form.sellingUnitId)

  // Helper: look up a unit by ID from the active units list
  const getUnitName = (id: string): string => activeUnits.find(u => u.id === id)?.name ?? '?'
  const getUnitSymbol = (id: string): string => activeUnits.find(u => u.id === id)?.symbol ?? '?'

  // ── Render helpers ────────────────────────────────────────────

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

  const renderSwitch = (
    label: string,
    description: string,
    checked: boolean,
    onChange: (val: boolean) => void,
    accentColor: string
  ) => (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-zinc-300 hover:bg-zinc-50/30 transition-all cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className={`mt-0.5 rounded border-input ${accentColor} focus:ring-2 focus:ring-offset-1`}
      />
      <div>
        <p className="text-xs font-medium text-foreground group-hover:text-zinc-800 transition-colors">{label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
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
              {editingId ? 'Update product details' : 'Define a new product in inventory'}
            </p>
          </div>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">

        {/* ═══════════════════════════════════════════════════════
            SECTION 1: BASIC INFORMATION
           ═══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          title="Basic Information"
          icon={<span className="w-1 h-4 rounded-full bg-emerald-500" />}
          color="bg-emerald-500"
          defaultOpen={true}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderInput('Product Name', form.name, (v) => onFormChange({ ...form, name: v }), 'e.g. Paracetamol 500mg', true)}
            {renderInput('SKU', form.sku, (v) => onFormChange({ ...form, sku: v }), 'e.g. MED-PARA-001', true, { hint: 'Must be unique' })}
            {renderInput('Barcode', form.barcode ?? '', (v) => onFormChange({ ...form, barcode: v }), 'e.g. 8901234567890', false)}
            {renderInput('Category', form.category, (v) => onFormChange({ ...form, category: v }), 'e.g. Medicines', false)}
            {renderInput('Brand', form.brand ?? '', (v) => onFormChange({ ...form, brand: v }), 'e.g. Cipla', false)}
            {renderInput('Description', form.description, (v) => onFormChange({ ...form, description: v }), 'Product description', false)}
            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={form.status ?? 'active'}
                onChange={e => onFormChange({ ...form, status: e.target.value as 'active' | 'inactive' | 'discontinued' })}
                className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          </div>
        </CollapsibleSection>

        {/* ═══════════════════════════════════════════════════════
            SECTION 2: INVENTORY UNITS
           ═══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          title="Inventory Units"
          icon={<span className="w-1 h-4 rounded-full bg-blue-500" />}
          color="bg-blue-500"
          defaultOpen={true}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {/* Base Unit */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Base Unit <span className="text-red-500">*</span>
                <span className="ml-1 text-[10px] text-emerald-600 font-medium">(Storage)</span>
              </label>
              <select
                value={form.baseUnitId}
                onChange={e => {
                  onFormChange({
                    ...form,
                    baseUnitId: e.target.value,
                    purchaseUnitId: form.purchaseUnitId === e.target.value ? null : form.purchaseUnitId,
                    purchaseUnitFactor: undefined,
                    sellingUnitId: form.sellingUnitId === e.target.value ? null : form.sellingUnitId,
                    sellingUnitFactor: undefined,
                  })
                }}
                className="w-full h-9 px-3 border border-emerald-300 rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
              >
                <option value="">Select base unit...</option>
                {activeUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.symbol}) — {u.measurementTypeName ?? u.type}{u.isPackaging ? ' 📦' : ''}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 shrink-0" />
                Inventory stored in this unit
              </p>
            </div>

            {/* Purchase Unit */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Purchase Unit</label>
                <select
                  value={form.purchaseUnitId ?? ''}
                  onChange={e => onFormChange({ ...form, purchaseUnitId: e.target.value || null, purchaseUnitFactor: undefined })}
                  className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                >
                  <option value="">Same as base unit</option>
                  {sameTypeUnits.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.symbol}) — {u.measurementTypeName ?? u.type}{u.isPackaging ? ' 📦' : ''}</option>
                  ))}
                  {sameTypeUnits.length === 0 && <option value="" disabled>No units available</option>}
                </select>
              </div>
              {/* Show factor input when purchase unit differs from base */}
              {form.purchaseUnitId && form.purchaseUnitId !== form.baseUnitId && selectedBaseUnit && selectedPurchaseUnit && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="block text-[11px] font-medium text-blue-700 mb-1">
                    1 {selectedPurchaseUnit.symbol} = ? {selectedBaseUnit.symbol}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-600 font-medium shrink-0">1 {selectedPurchaseUnit.symbol} =</span>
                    <input
                      type="number" step="0.000001" min="0.000001"
                      value={form.purchaseUnitFactor ?? ''}
                      onChange={e => onFormChange({ ...form, purchaseUnitFactor: parseFloat(e.target.value) || undefined })}
                      placeholder="Factor"
                      className="w-24 h-7 px-2 border border-blue-300 rounded text-xs text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <span className="text-xs text-blue-600 font-medium">{selectedBaseUnit.symbol}</span>
                  </div>
                  {!form.purchaseUnitFactor && (
                    <p className="text-[10px] text-blue-500 mt-1">Enter how many {selectedBaseUnit.symbol} equals 1 {selectedPurchaseUnit.symbol}</p>
                  )}
                  {form.purchaseUnitFactor && form.purchaseUnitFactor > 0 && (
                    <p className="text-[10px] text-emerald-600 mt-1 font-medium">
                      ✓ 1 {selectedPurchaseUnit.symbol} = {form.purchaseUnitFactor} {selectedBaseUnit.symbol}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Selling Unit */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Selling Unit</label>
                <select
                  value={form.sellingUnitId ?? ''}
                  onChange={e => onFormChange({ ...form, sellingUnitId: e.target.value || null, sellingUnitFactor: undefined })}
                  className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                >
                  <option value="">Same as base unit</option>
                  {sameTypeUnits.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.symbol}) — {u.measurementTypeName ?? u.type}{u.isPackaging ? ' 📦' : ''}</option>
                  ))}
                  {sameTypeUnits.length === 0 && <option value="" disabled>No units available</option>}
                </select>
              </div>
              {/* Show factor input when selling unit differs from base */}
              {form.sellingUnitId && form.sellingUnitId !== form.baseUnitId && selectedBaseUnit && selectedSellingUnit && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="block text-[11px] font-medium text-blue-700 mb-1">
                    1 {selectedSellingUnit.symbol} = ? {selectedBaseUnit.symbol}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-600 font-medium shrink-0">1 {selectedSellingUnit.symbol} =</span>
                    <input
                      type="number" step="0.000001" min="0.000001"
                      value={form.sellingUnitFactor ?? ''}
                      onChange={e => onFormChange({ ...form, sellingUnitFactor: parseFloat(e.target.value) || undefined })}
                      placeholder="Factor"
                      className="w-24 h-7 px-2 border border-blue-300 rounded text-xs text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <span className="text-xs text-blue-600 font-medium">{selectedBaseUnit.symbol}</span>
                  </div>
                  {!form.sellingUnitFactor && (
                    <p className="text-[10px] text-blue-500 mt-1">Enter how many {selectedBaseUnit.symbol} equals 1 {selectedSellingUnit.symbol}</p>
                  )}
                  {form.sellingUnitFactor && form.sellingUnitFactor > 0 && (
                    <p className="text-[10px] text-emerald-600 mt-1 font-medium">
                      ✓ 1 {selectedSellingUnit.symbol} = {form.sellingUnitFactor} {selectedBaseUnit.symbol}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Additional Units */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                Additional Units
              </label>
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
                  No additional units. Add more units that can be used for this product.
                </p>
              )}
              {form.additionalUnits.map((au, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border hover:border-muted-foreground/30 transition-colors group">
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                  <select
                    value={au.unitId}
                    onChange={e => updateUnit(i, e.target.value)}
                    className="flex-1 h-8 px-2 border border-input rounded text-xs bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  >
                    <option value="">Select unit...</option>
                    {sameTypeUnits
                      .filter(u => !selectedAdditionalUnitIds.includes(u.id) || u.id === au.unitId)
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.symbol}) — {u.measurementTypeName ?? u.type}{u.isPackaging ? ' 📦' : ''}</option>
                      ))}
                    {sameTypeUnits.length === 0 && (
                      <option value="" disabled>No units available</option>
                    )}
                  </select>
                  <button onClick={() => removeUnit(i)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* ═══════════════════════════════════════════════════════
            SECTION 3: PACKAGING & UNIT CONVERSIONS
           ═══════════════════════════════════════════════════════ */}
        <CollapsibleSection
          title="Packaging & Unit Conversions"
          icon={<span className="w-1 h-4 rounded-full bg-purple-500" />}
          color="bg-purple-500"
          defaultOpen={true}
        >
          <div className="mb-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <HelpCircle className="w-3 h-3 shrink-0" />
              Define direct relationships only &mdash; indirect ones are automatically calculated.
            </p>
          </div>

          {existingConversions && existingConversions.length > 0 && !form.productConversions?.length && (
            <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <p className="font-medium">Existing product conversions will be loaded on save.</p>
              <p className="text-blue-600 mt-0.5">Add new conversions below or edit existing ones.</p>
            </div>
          )}

          {/* Conversion errors */}
          {conversionErrors.length > 0 && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-medium text-red-700 mb-1">Please fix the following:</p>
              <ul className="space-y-0.5">
                {conversionErrors.map((err, i) => (
                  <li key={i} className="text-[10px] text-red-600 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            {(form.productConversions ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-lg border border-dashed border-border">
                No conversions defined. Add direct relationships below (e.g., 1 Box = 12 Strips).
              </p>
            )}
            {(form.productConversions ?? []).map((conv, i) => {
              const fromName = getUnitName(conv.fromUnitId)
              const fromSym = getUnitSymbol(conv.fromUnitId)
              const toName = getUnitName(conv.toUnitId)
              const toSym = getUnitSymbol(conv.toUnitId)
              const hasBothUnits = conv.fromUnitId && conv.toUnitId
              const isValid = hasBothUnits && conv.conversionFactor > 0

              const fromUnit = activeUnits.find(u => u.id === conv.fromUnitId)
              const toUnit = activeUnits.find(u => u.id === conv.toUnitId)
              const typeMismatch = fromUnit && toUnit && fromUnit.type !== toUnit.type

              return (
                <div key={i} className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                  {/* Input Row: Larger Unit | Quantity | Smaller Unit */}
                  <div className="flex items-center gap-2 p-3">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      {/* Larger Unit (toUnitId) */}
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                          Larger Unit
                        </label>
                        <select
                          value={conv.toUnitId}
                          onChange={e => updateProductConversion(i, 'toUnitId', e.target.value)}
                          className={`w-full h-8 px-2 border rounded text-xs bg-card focus:outline-none focus:ring-2 focus:ring-purple-300 transition-colors ${
                            typeMismatch ? 'border-red-300' : 'border-input'
                          }`}
                        >
                          <option value="">Select...</option>
                          {(() => {
                            const baseUnit = activeUnits.find(u => u.id === form.baseUnitId)
                            const baseTypeId = baseUnit?.measurementTypeId
                            return activeUnits.filter(u =>
                              u.status === 'active' &&
                              (u.measurementTypeId === baseTypeId || u.isPackaging || !baseTypeId)
                            ).map(u => (
                              <option key={u.id} value={u.id} title={`${u.name} — ${u.measurementTypeName ?? u.type}`}>
                                {u.name} ({u.symbol}){u.isPackaging ? ' 📦' : ''}
                              </option>
                            ))
                          })()}
                        </select>
                      </div>

                      {/* Quantity (conversionFactor) */}
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                          Quantity
                        </label>
                        <input
                          type="number" step="0.000001" min="0.000001"
                          value={conv.conversionFactor}
                          onChange={e => updateProductConversion(i, 'conversionFactor', parseFloat(e.target.value) || 0)}
                          placeholder="e.g. 12"
                          className="w-full h-8 px-2 border border-input rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-300 transition-colors text-center font-medium"
                        />
                      </div>

                      {/* Smaller Unit (fromUnitId) */}
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                          Smaller Unit
                        </label>
                        <div className="flex items-center gap-1">
                          <select
                            value={conv.fromUnitId}
                            onChange={e => updateProductConversion(i, 'fromUnitId', e.target.value)}
                            className={`flex-1 h-8 px-2 border rounded text-xs bg-card focus:outline-none focus:ring-2 focus:ring-purple-300 transition-colors ${
                              typeMismatch ? 'border-red-300' : 'border-input'
                            }`}
                          >
                            <option value="">Select...</option>
                            {(() => {
                              // Get base unit's measurement type for filtering
                              const baseUnit = activeUnits.find(u => u.id === form.baseUnitId)
                              const baseTypeId = baseUnit?.measurementTypeId
                              // Show units of same measurement type OR packaging units
                              return activeUnits.filter(u =>
                                u.status === 'active' &&
                                (u.measurementTypeId === baseTypeId || u.isPackaging || !baseTypeId)
                              ).map(u => (
                                <option key={u.id} value={u.id} title={`${u.name} — ${u.measurementTypeName ?? u.type}`}>
                                  {u.name} ({u.symbol}){u.isPackaging ? ' 📦' : ''}
                                </option>
                              ))
                            })()}
                          </select>
                          <button onClick={() => removeProductConversion(i)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Relationship Preview */}
                  {isValid && !typeMismatch && (
                    <div className="mx-3 mb-3 bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-center justify-center gap-3 text-sm">
                        <span className="font-bold text-purple-800 bg-card px-3 py-1.5 rounded-md border border-purple-200 shadow-sm">
                          1 {toSym}
                        </span>
                        <span className="text-purple-500 font-bold text-lg">=</span>
                        <span className="font-bold text-purple-800 bg-card px-3 py-1.5 rounded-md border border-purple-200 shadow-sm">
                          {conv.conversionFactor} {fromSym}
                        </span>
                      </div>
                      <p className="text-[10px] text-purple-600 text-center mt-1.5">
                        1 {toName} = {conv.conversionFactor} × {fromName}
                      </p>
                    </div>
                  )}

                  {typeMismatch && (
                    <div className="mx-3 mb-3 bg-red-50 border border-red-200 rounded-lg p-2 text-center text-[10px] text-red-700">
                      ⚠ Units must be compatible ({fromUnit?.measurementTypeName ?? fromUnit?.type ?? '?'} ≠ {toUnit?.measurementTypeName ?? toUnit?.type ?? '?'})
                    </div>
                  )}

                  {hasBothUnits && !isValid && !typeMismatch && (
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
              <Plus className="w-4 h-4" /> Add Conversion Row
            </button>
          </div>

          {/* Conversion chain visualization */}
          {(form.productConversions ?? []).length > 1 && (
            <div className="mt-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3">
              <p className="text-[10px] font-medium text-indigo-600 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Auto-calculated Conversion Chain
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
              <p className="text-[9px] text-indigo-500 mt-1.5">
                Indirect conversions (e.g., Box → Tablet) are automatically calculated from direct relationships.
              </p>
            </div>
          )}
        </CollapsibleSection>

        {/* ═══════════════════════════════════════════════════════
            SECTION 4: PRICING (edit only)
           ═══════════════════════════════════════════════════════ */}
        {!isAddMode && (
          <CollapsibleSection
            title="Pricing"
            icon={<span className="w-1 h-4 rounded-full bg-amber-500" />}
            color="bg-amber-500"
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {renderNumberInput(
                `Purchase Price${selectedPurchaseUnit ? ` (per ${selectedPurchaseUnit.symbol})` : ''}`,
                form.purchasePrice ?? 0,
                (v) => onFormChange({ ...form, purchasePrice: v }),
                { symbol: '₹', hint: selectedPurchaseUnit ? `Price per ${selectedPurchaseUnit.name} (${selectedPurchaseUnit.symbol})` : 'Select a purchase unit' }
              )}
              {renderNumberInput(
                `Selling Price${selectedSellingUnit ? ` (per ${selectedSellingUnit.symbol})` : ''}`,
                form.sellingPrice ?? 0,
                (v) => onFormChange({ ...form, sellingPrice: v }),
                { symbol: '₹', hint: selectedSellingUnit ? `Price per ${selectedSellingUnit.name} (${selectedSellingUnit.symbol})` : 'Select a selling unit' }
              )}
              {renderNumberInput('MRP (Optional)', form.mrp ?? 0, (v) => onFormChange({ ...form, mrp: v }), { symbol: '₹', hint: 'Maximum Retail Price' })}
              {/* Tax Class */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tax Class (Optional)</label>
                <select
                  value={form.taxClass ?? ''}
                  onChange={e => onFormChange({ ...form, taxClass: e.target.value || '' })}
                  className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
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
            {selectedBaseUnit && (
              <div className="mt-3 bg-amber-50/50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <p className="font-medium mb-1">💡 Pricing Logic</p>
                <p>Purchase price is per {selectedPurchaseUnit ? `${selectedPurchaseUnit.symbol}` : 'purchase unit'} and selling price is per {selectedSellingUnit ? `${selectedSellingUnit.symbol}` : 'selling unit'}.</p>
                <p className="mt-0.5">The system stores prices in these units and converts to base unit ({selectedBaseUnit.symbol}) for inventory valuation.</p>
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* ═══════════════════════════════════════════════════════
            SECTION 5: INVENTORY SETTINGS (edit only)
           ═══════════════════════════════════════════════════════ */}
        {!isAddMode && (
          <CollapsibleSection
            title="Inventory Settings"
            icon={<span className="w-1 h-4 rounded-full bg-cyan-500" />}
            color="bg-cyan-500"
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </CollapsibleSection>
        )}

        {/* ═══════════════════════════════════════════════════════
            SECTION 6: PRODUCT SETTINGS (edit only)
           ═══════════════════════════════════════════════════════ */}
        {!isAddMode && (
          <CollapsibleSection
            title="Product Settings"
            icon={<span className="w-1 h-4 rounded-full bg-rose-500" />}
            color="bg-rose-500"
            defaultOpen={false}
          >
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <HelpCircle className="w-3 h-3 shrink-0" />
                Enable tracking features for this product. When disabled, purchase forms will hide those fields.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {renderSwitch('Track Batch', 'Track batch numbers for recalls and traceability', form.trackBatch ?? false, (v) => onFormChange({ ...form, trackBatch: v }), 'text-rose-600 focus:ring-rose-500')}
                {renderSwitch('Track Expiry', 'Track manufacturing and expiry dates', form.trackExpiry ?? false, (v) => onFormChange({ ...form, trackExpiry: v }), 'text-rose-600 focus:ring-rose-500')}
                {renderSwitch('Track Serial Numbers', 'Track individual serial numbers', form.trackSerialNumber ?? false, (v) => onFormChange({ ...form, trackSerialNumber: v }), 'text-rose-600 focus:ring-rose-500')}
              </div>
            </div>
          </CollapsibleSection>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════════
          FOOTER / ACTIONS
         ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2">
          {invalidFound && (
            <p className="text-[10px] text-red-600 flex items-center gap-1 bg-red-50 px-2 py-1 rounded">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Fix conversion errors above
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
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingId ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  )
}
