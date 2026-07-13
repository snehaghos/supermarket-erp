"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, RefreshCw, Save, X, AlertTriangle, Search } from "lucide-react"
import { unitsApi, type UnitRow, type CreateUnitInput, type UpdateUnitInput } from "@/lib/api"
import { UnitForm } from "./unit-form"
import { UnitTable } from "./unit-table"

const emptyForm: CreateUnitInput = { name: '', symbol: '', type: 'Count' }

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Units</h2>
          <p className="text-sm text-muted-foreground">Manage measurement units for inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUnits} disabled={loading} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Unit
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
        <UnitForm
          form={form}
          editingId={editingId}
          saving={saving}
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
          placeholder="Search units..."
          className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
        />
      </div>

      <UnitTable
        units={units}
        loading={loading}
        search={search}
        deletingId={deletingId}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
