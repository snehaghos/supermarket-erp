import { useState, useEffect } from "react"
import { X, Loader2 } from "lucide-react"
import type { CreateUnitInput, MeasurementTypeRow } from "@/lib/api"
import { measurementTypesApi } from "@/lib/api"

interface UnitFormProps {
  form: CreateUnitInput
  editingId: string | null
  saving: boolean
  onFormChange: (form: CreateUnitInput) => void
  onSave: () => void
  onCancel: () => void
}

export function UnitForm({ form, editingId, saving, onFormChange, onSave, onCancel }: UnitFormProps) {
  const [measurementTypes, setMeasurementTypes] = useState<MeasurementTypeRow[]>([])

  useEffect(() => {
    measurementTypesApi.getAll().then(setMeasurementTypes).catch(() => {})
  }, [])

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">{editingId ? 'Edit Unit' : 'New Unit'}</h3>
        <button onClick={onCancel} className="p-1 rounded hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
          <input
            value={form.name}
            onChange={e => onFormChange({ ...form, name: e.target.value })}
            placeholder="e.g. Kilogram"
            className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Symbol</label>
          <input
            value={form.symbol}
            onChange={e => onFormChange({ ...form, symbol: e.target.value })}
            placeholder="e.g. kg"
            className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Measurement Type</label>
          <select
            value={form.measurementTypeId}
            onChange={e => onFormChange({ ...form, measurementTypeId: e.target.value })}
            className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
          >
            <option value="">Select type...</option>
            {measurementTypes.map(mt => (
              <option key={mt.id} value={mt.id}>{mt.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPackaging ?? false}
            onChange={e => onFormChange({ ...form, isPackaging: e.target.checked })}
            className="rounded border-input"
          />
          Packaging unit (requires product-specific conversions)
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        <button
          onClick={onSave}
          disabled={saving || !form.name || !form.symbol || !form.measurementTypeId}
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {editingId ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  )
}
