import { X, Loader2 } from "lucide-react"
import type { CreateUnitInput, UnitRow } from "@/lib/api"

const UNIT_TYPES = ['Count', 'Weight', 'Volume', 'Length', 'Area', 'Packaging'] as const

interface UnitFormProps {
  form: CreateUnitInput
  editingId: string | null
  saving: boolean
  onFormChange: (form: CreateUnitInput) => void
  onSave: () => void
  onCancel: () => void
}

export function UnitForm({ form, editingId, saving, onFormChange, onSave, onCancel }: UnitFormProps) {
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
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
          <select
            value={form.type}
            onChange={e => onFormChange({ ...form, type: e.target.value as UnitRow['type'] })}
            className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
          >
            {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        <button
          onClick={onSave}
          disabled={saving || !form.name || !form.symbol}
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {editingId ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  )
}
