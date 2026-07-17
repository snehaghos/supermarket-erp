"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, RefreshCw, Search } from "lucide-react"
import {
  conversionsApi, unitsApi,
  type ConversionRow, type CreateConversionInput, type UpdateConversionInput,
  type UnitRow,
} from "@/lib/api"
import { showSuccess, showApiError } from "@/lib/errors"
import { ConversionForm } from "./conversion-form"
import { ConversionPreview } from "./conversion-preview"
import { ConversionTable } from "./conversion-table"

const emptyForm: CreateConversionInput = { parentUnitId: '', childUnitId: '', factor: 1 }

export function ConversionsSection() {
  const [conversions, setConversions] = useState<ConversionRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateConversionInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [convData, unitsData] = await Promise.all([
        conversionsApi.getAll(),
        unitsApi.getAll(),
      ])
      setConversions(convData)
      setUnits(unitsData)
    } catch (err) {
      showApiError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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
        showSuccess('Conversion updated', 'The unit relationship has been saved.')
      } else {
        await conversionsApi.create(form)
        showSuccess('Conversion created', 'A new unit relationship has been defined.')
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
      await conversionsApi.delete(id)
      showSuccess('Conversion deleted', 'The unit relationship has been removed.')
      await fetchData()
    } catch (err) {
      showApiError(err)
    } finally {
      setDeletingId(null)
    }
  }

  const activeUnits = units.filter(u => u.status === 'active')

  return (
    <div className="space-y-5">
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

      {showForm && (
        <ConversionForm
          form={form}
          editingId={editingId}
          saving={saving}
          activeUnits={activeUnits}
          onFormChange={setForm}
          onSave={handleSave}
          onCancel={resetForm}
        />
      )}

      <ConversionPreview activeUnits={activeUnits} />

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversions..."
          className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
        />
      </div>

      <ConversionTable
        conversions={conversions}
        loading={loading}
        search={search}
        deletingId={deletingId}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
