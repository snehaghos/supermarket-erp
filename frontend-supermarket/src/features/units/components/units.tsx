"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Edit2, Trash2, RefreshCw, Loader2, Save, X, AlertTriangle,
  Search,
} from "lucide-react"
import { unitsApi, type UnitRow, type CreateUnitInput, type UpdateUnitInput } from "@/lib/api"

const UNIT_TYPES = ['Packaging', 'Quantity', 'Weight', 'Volume', 'Length'] as const

const emptyForm: CreateUnitInput = { name: '', symbol: '', type: 'Quantity' }

const typeMeta: Record<string, { color: string; label: string }> = {
  Packaging: { color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Pkg' },
  Quantity:  { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Qty' },
  Weight:    { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Wt' },
  Volume:    { color: 'bg-cyan-100 text-cyan-700 border-cyan-200', label: 'Vol' },
  Length:    { color: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Len' },
}

export function UnitsSection() {
  const [units, setUnits] = useState<UnitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateUnitInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchUnits = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await unitsApi.getAll()
      setUnits(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch units')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUnits() }, [fetchUnits])

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false) }

  const openEdit = (unit: UnitRow) => {
    setForm({ name: unit.name, symbol: unit.symbol, type: unit.type })
    setEditingId(unit.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingId) {
        const input: UpdateUnitInput = {}
        if (form.name) input.name = form.name
        if (form.symbol) input.symbol = form.symbol
        if (form.type) input.type = form.type
        await unitsApi.update(editingId, input)
        showSuccess('Unit updated successfully')
      } else {
        await unitsApi.create(form)
        showSuccess('Unit created successfully')
      }
      resetForm()
      await fetchUnits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save unit')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await unitsApi.delete(id)
      showSuccess('Unit deleted')
      await fetchUnits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete unit')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = units.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.symbol.toLowerCase().includes(search.toLowerCase()) ||
    u.type.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Units</h2>
          <p className="text-sm text-muted-foreground">Manage measurement units for inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUnits}
            disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Unit
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
            <h3 className="font-semibold text-sm text-foreground">{editingId ? 'Edit Unit' : 'New Unit'}</h3>
            <button onClick={resetForm} className="p-1 rounded hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kilogram"
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Symbol</label>
              <input
                value={form.symbol}
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))}
                placeholder="e.g. kg"
                className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as UnitRow['type'] }))}
                className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
              >
                {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={resetForm} className="px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name || !form.symbol}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search units..."
          className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
        />
      </div>

      {/* Table */}
      {loading && !units.length ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">{search ? 'No matching units' : 'No units found. Add one to get started.'}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(unit => (
                <tr key={unit.id}>
                  <td className="font-medium text-foreground">{unit.name}</td>
                  <td>
                    <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">{unit.symbol}</code>
                  </td>
                  <td>
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${typeMeta[unit.type]?.color ?? 'bg-muted text-muted-foreground'}`}>
                      {typeMeta[unit.type]?.label ?? unit.type}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      unit.status === 'active' ? 'text-emerald-600' : 'text-muted-foreground'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        unit.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'
                      }`} />
                      {unit.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(unit)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(unit.id)}
                        disabled={deletingId === unit.id}
                        className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === unit.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
