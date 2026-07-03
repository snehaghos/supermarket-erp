"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Edit2, Trash2, RefreshCw, Loader2, Save, X, AlertTriangle,
  ArrowRight, Beaker, Search,
} from "lucide-react"
import {
  conversionsApi, unitsApi,
  type ConversionRow, type CreateConversionInput, type UpdateConversionInput,
  type UnitRow, type ConversionStep,
} from "@/lib/api"

const emptyForm: CreateConversionInput = { parentUnitId: '', childUnitId: '', factor: 1 }

export function ConversionsSection() {
  const [conversions, setConversions] = useState<ConversionRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateConversionInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Preview state
  const [showPreview, setShowPreview] = useState(false)
  const [previewUnitId, setPreviewUnitId] = useState('')
  const [previewQuantity, setPreviewQuantity] = useState(1)
  const [previewSteps, setPreviewSteps] = useState<ConversionStep[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [convData, unitsData] = await Promise.all([
        conversionsApi.getAll(),
        unitsApi.getAll(),
      ])
      setConversions(convData)
      setUnits(unitsData)
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

  const openEdit = (conv: ConversionRow) => {
    setForm({ parentUnitId: conv.parentUnitId, childUnitId: conv.childUnitId, factor: conv.factor })
    setEditingId(conv.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingId) {
        const input: UpdateConversionInput = {}
        if (form.parentUnitId) input.parentUnitId = form.parentUnitId
        if (form.childUnitId) input.childUnitId = form.childUnitId
        if (form.factor) input.factor = form.factor
        await conversionsApi.update(editingId, input)
        showSuccess('Conversion updated successfully')
      } else {
        await conversionsApi.create(form)
        showSuccess('Conversion created successfully')
      }
      resetForm()
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save conversion')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await conversionsApi.delete(id)
      showSuccess('Conversion deleted')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversion')
    } finally {
      setDeletingId(null)
    }
  }

  const handlePreview = async () => {
    if (!previewUnitId || previewQuantity <= 0) return
    setPreviewLoading(true)
    setError(null)
    try {
      const result = await conversionsApi.preview(previewQuantity, previewUnitId)
      setPreviewSteps(result.steps)
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  const activeUnits = units.filter(u => u.status === 'active')

  const filtered = conversions.filter(c =>
    c.parentUnitName.toLowerCase().includes(search.toLowerCase()) ||
    c.childUnitName.toLowerCase().includes(search.toLowerCase()) ||
    String(c.factor).includes(search)
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Conversions</h2>
          <p className="text-sm text-muted-foreground">Define relationships between measurement units</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Conversion
          </button>
        </div>
      </div>

      {/* Alert */}
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

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">{editingId ? 'Edit Conversion' : 'New Conversion'}</h3>
            <button onClick={resetForm} className="p-1 rounded hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Parent Unit</label>
              <select
                value={form.parentUnitId}
                onChange={e => setForm(f => ({ ...f, parentUnitId: e.target.value }))}
                className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
              >
                <option value="">Select parent...</option>
                {activeUnits.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Child Unit</label>
              <select
                value={form.childUnitId}
                onChange={e => setForm(f => ({ ...f, childUnitId: e.target.value }))}
                className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
              >
                <option value="">Select child...</option>
                {activeUnits.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Factor</label>
              <input
                type="number" step="0.000001" min="0.000001"
                value={form.factor}
                onChange={e => setForm(f => ({ ...f, factor: parseFloat(e.target.value) || 0 }))}
                placeholder="e.g. 1000"
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={resetForm} className="px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !form.parentUnitId || !form.childUnitId || form.factor <= 0}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Preview Tool */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Beaker className="w-4 h-4 text-violet-500" />
          Conversion Preview
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Starting Unit</label>
            <select
              value={previewUnitId}
              onChange={e => setPreviewUnitId(e.target.value)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
            >
              <option value="">Select unit...</option>
              {activeUnits.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Quantity</label>
            <input
              type="number" step="any" min="0.000001"
              value={previewQuantity}
              onChange={e => setPreviewQuantity(parseFloat(e.target.value) || 0)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handlePreview}
              disabled={previewLoading || !previewUnitId || previewQuantity <= 0}
              className="flex items-center gap-2 bg-violet-600 text-white px-5 h-9 rounded-md text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm w-full justify-center"
            >
              {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Beaker className="w-4 h-4" />}
              Preview
            </button>
          </div>
        </div>

        {/* Preview Results */}
        {showPreview && (
          <div className="mt-4 pt-4 border-t border-border">
            {previewSteps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No conversion chain found for this unit.</p>
            ) : (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Conversion Chain</p>
                <div className="space-y-1.5">
                  {previewSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-1.5">
                      <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-foreground">{step.quantity}</span>
                      <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">{step.unitSymbol}</code>
                      <span className="text-muted-foreground text-xs">{step.unitName}</span>
                      {i < previewSteps.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground text-xs">Final result: </span>
                    <strong>{previewSteps[previewSteps.length - 1]!.quantity}</strong>{' '}
                    <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{previewSteps[previewSteps.length - 1]!.unitSymbol}</code>
                    {' '}<span className="text-xs text-muted-foreground">({previewSteps[previewSteps.length - 1]!.unitName})</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversions..."
          className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
        />
      </div>

      {/* Table */}
      {loading && !conversions.length ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">{search ? 'No matching conversions' : 'No conversions found. Add one to get started.'}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table>
            <thead>
              <tr>
                <th>Parent Unit</th>
                <th>Child Unit</th>
                <th>Factor</th>
                <th>Equation</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(conv => (
                <tr key={conv.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{conv.parentUnitName}</span>
                      <code className="text-[10px] text-muted-foreground font-mono">({conv.parentUnitSymbol})</code>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{conv.childUnitName}</span>
                      <code className="text-[10px] text-muted-foreground font-mono">({conv.childUnitSymbol})</code>
                    </div>
                  </td>
                  <td>
                    <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono font-semibold text-foreground">{conv.factor}</code>
                  </td>
                  <td>
                    <span className="text-xs text-muted-foreground">
                      1 {conv.parentUnitSymbol} = {conv.factor} {conv.childUnitSymbol}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(conv)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(conv.id)}
                        disabled={deletingId === conv.id}
                        className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === conv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
