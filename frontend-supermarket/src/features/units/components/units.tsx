"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, RefreshCw, Search } from "lucide-react"
import { unitsApi, type UnitRow, type CreateUnitInput, type UpdateUnitInput } from "@/lib/api"
import { showSuccess, showApiError } from "@/lib/errors"
import { UnitForm } from "./unit-form"
import { UnitTable } from "./unit-table"

const emptyForm: CreateUnitInput = { name: '', symbol: '', type: 'Count' }

export function UnitsSection() {
  const [units, setUnits] = useState<UnitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateUnitInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchUnits = useCallback(async () => {
    setLoading(true)
    try {
      const data = await unitsApi.getAll()
      setUnits(data)
    } catch (err) {
      showApiError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUnits() }, [fetchUnits])

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
        showSuccess('Unit updated', 'The unit has been saved successfully.')
      } else {
        await unitsApi.create(form)
        showSuccess('Unit created', 'The new measurement unit has been added.')
      }
      resetForm()
      await fetchUnits()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await unitsApi.delete(id)
      showSuccess('Unit deleted', 'The unit has been removed.')
      await fetchUnits()
    } catch (err) {
      showApiError(err)
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
