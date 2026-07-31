import { X, Loader2 } from "lucide-react"
import type { CreateConversionInput, UnitRow } from "@/lib/api"

interface ConversionFormProps {
  form: CreateConversionInput
  editingId: string | null
  saving: boolean
  activeUnits: UnitRow[]
  onFormChange: (form: CreateConversionInput) => void
  onSave: () => void
  onCancel: () => void
}

export function ConversionForm({ form, editingId, saving, activeUnits, onFormChange, onSave, onCancel }: ConversionFormProps) {
  // Filter out packaging units - they require product-specific conversions, not global ones
  const standardUnits = activeUnits.filter(u => !u.isPackaging)

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">{editingId ? 'Edit Conversion' : 'New Conversion'}</h3>
        <button onClick={onCancel} className="p-1 rounded hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
      </div>
      {standardUnits.length === 0 ? (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          No standard units available. Packaging units require product-specific conversions.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Parent Unit</label>
              <select
                value={form.parentUnitId}
                onChange={e => onFormChange({ ...form, parentUnitId: e.target.value })}
                className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
              >
                <option value="">Select parent...</option>
                {standardUnits.map(u => <option key={u.id} value={u.id} title={`${u.name} — ${u.measurementTypeName ?? u.type}`}>{u.name} ({u.symbol}) — {u.measurementTypeName ?? u.type}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Child Unit</label>
              <select
                value={form.childUnitId}
                onChange={e => onFormChange({ ...form, childUnitId: e.target.value })}
                className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
              >
                <option value="">Select child...</option>
                {standardUnits.map(u => <option key={u.id} value={u.id} title={`${u.name} — ${u.measurementTypeName ?? u.type}`}>{u.name} ({u.symbol}) — {u.measurementTypeName ?? u.type}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Factor</label>
              <input
                type="number" step="0.000001" min="0.000001"
                value={form.factor}
                onChange={e => onFormChange({ ...form, factor: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 1000"
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onCancel} className="px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={onSave}
              disabled={saving || !form.parentUnitId || !form.childUnitId || form.factor <= 0}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
