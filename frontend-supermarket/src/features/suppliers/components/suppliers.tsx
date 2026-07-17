"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, RefreshCw, Search, X, Loader2,
  Edit2, Trash2, Truck, Phone, Mail, MapPin,
  Building2, CreditCard, Calendar, User,
} from "lucide-react"
import { FormInput } from "@/components/ui/form-input"
import {
  suppliersApi,
  type SupplierRow, type CreateSupplierInput, type UpdateSupplierInput,
} from "@/lib/api"
import { showSuccess, showApiError } from "@/lib/errors"

const emptyForm: CreateSupplierInput = {
  name: '', gst: '', contactPerson: '', email: '', phone: '',
  address: '', city: '', state: '', pincode: '',
  creditLimit: 0, paymentTerms: '',
}

export function SuppliersSection() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateSupplierInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRow | null>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await suppliersApi.getAll()
      setSuppliers(data)
    } catch (err) {
      setSuppliers([])
      // Silently handle missing backend - will display empty table
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false) }

  const openEdit = (supplier: SupplierRow) => {
    setForm({
      name: supplier.name,
      gst: supplier.gst,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      city: supplier.city,
      state: supplier.state,
      pincode: supplier.pincode,
      creditLimit: supplier.creditLimit,
      paymentTerms: supplier.paymentTerms,
    })
    setEditingId(supplier.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingId) {
        const input: UpdateSupplierInput = {}
        if (form.name) input.name = form.name
        if (form.gst) input.gst = form.gst
        if (form.contactPerson) input.contactPerson = form.contactPerson
        if (form.email) input.email = form.email
        if (form.phone) input.phone = form.phone
        if (form.address) input.address = form.address
        if (form.city) input.city = form.city
        if (form.state) input.state = form.state
        if (form.pincode) input.pincode = form.pincode
        if (form.creditLimit) input.creditLimit = form.creditLimit
        if (form.paymentTerms) input.paymentTerms = form.paymentTerms
        await suppliersApi.update(editingId, input)
        showSuccess('Supplier updated', 'Supplier details saved.')
      } else {
        await suppliersApi.create(form)
        showSuccess('Supplier created', 'New vendor has been added.')
      }
      resetForm()
      await fetchSuppliers()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await suppliersApi.delete(id)
      showSuccess('Supplier deleted', 'The supplier has been removed.')
      await fetchSuppliers()
    } catch (err) {
      showApiError(err)
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search) ||
    s.gst.includes(search)
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Suppliers</h2>
          <p className="text-sm text-muted-foreground">Manage vendors with GST, contact information, and purchase history</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchSuppliers} disabled={loading} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm ${
                editingId ? 'bg-blue-100 text-blue-700' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
              }`}>
                {editingId ? 'E' : 'N'}
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">{editingId ? 'Edit Supplier' : 'New Supplier'}</h3>
                <p className="text-[11px] text-muted-foreground">{editingId ? 'Update supplier details' : 'Add a new vendor'}</p>
              </div>
            </div>
            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Basic Info */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-4 rounded-full bg-emerald-500" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Basic Information</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormInput label="Supplier Name" value={form.name} onChange={v => setForm({...form, name: v})} placeholder="e.g. ABC Distributors" required icon={<Building2 className="w-3.5 h-3.5" />} />
                <FormInput label="GST Number" value={form.gst ?? ''} onChange={v => setForm({...form, gst: v})} placeholder="e.g. 27ABCDE1234F1Z5" hint="15-character GSTIN" />
                <FormInput label="Contact Person" value={form.contactPerson ?? ''} onChange={v => setForm({...form, contactPerson: v})} placeholder="e.g. Rajesh Kumar" icon={<User className="w-3.5 h-3.5" />} />
                <FormInput label="Email" value={form.email ?? ''} onChange={v => setForm({...form, email: v})} placeholder="supplier@example.com" type="email" icon={<Mail className="w-3.5 h-3.5" />} />
                <FormInput label="Phone" value={form.phone ?? ''} onChange={v => setForm({...form, phone: v})} placeholder="e.g. +91 98765 43210" icon={<Phone className="w-3.5 h-3.5" />} />
              </div>
            </div>

            {/* Address */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-4 rounded-full bg-blue-500" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Address</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <FormInput label="Address" value={form.address ?? ''} onChange={v => setForm({...form, address: v})} placeholder="Street, area, landmark" icon={<MapPin className="w-3.5 h-3.5" />} />
                </div>
                <FormInput label="City" value={form.city ?? ''} onChange={v => setForm({...form, city: v})} placeholder="e.g. Mumbai" />
                <FormInput label="State" value={form.state ?? ''} onChange={v => setForm({...form, state: v})} placeholder="e.g. Maharashtra" />
                <FormInput label="Pincode" value={form.pincode ?? ''} onChange={v => setForm({...form, pincode: v})} placeholder="e.g. 400001" />
              </div>
            </div>

            {/* Financial */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-4 rounded-full bg-amber-500" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Financial Details</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="Credit Limit (₹)" value={String(form.creditLimit ?? 0)} onChange={v => setForm({...form, creditLimit: parseFloat(v) || 0})} type="number" icon={<CreditCard className="w-3.5 h-3.5" />} hint="Maximum credit allowed" />
                <FormInput label="Payment Terms" value={form.paymentTerms ?? ''} onChange={v => setForm({...form, paymentTerms: v})} placeholder="e.g. Net 30, Due on receipt" icon={<Calendar className="w-3.5 h-3.5" />} hint="Payment due terms" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/30">
            <div />
            <div className="flex items-center gap-2">
              <button onClick={resetForm} className="px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name} className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:from-emerald-700 hover:to-emerald-600 transition-all disabled:opacity-50 shadow-sm">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Update Supplier' : 'Create Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors" />
      </div>

      {/* Table */}
      {loading && !suppliers.length ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Truck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{search ? 'No matching suppliers' : 'No suppliers yet. Add one to get started.'}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact</th>
                  <th>GST</th>
                  <th>Credit Limit</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedSupplier(supplier)}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {supplier.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{supplier.name}</p>
                          {supplier.city && <p className="text-[11px] text-muted-foreground">{supplier.city}{supplier.state ? `, ${supplier.state}` : ''}</p>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-0.5">
                        <p className="text-xs text-foreground flex items-center gap-1">
                          <User className="w-3 h-3 text-muted-foreground" />
                          {supplier.contactPerson || '-'}
                        </p>
                        {supplier.phone && <p className="text-[11px] text-muted-foreground">{supplier.phone}</p>}
                      </div>
                    </td>
                    <td>
                      {supplier.gst ? (
                        <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">{supplier.gst}</code>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td>
                      <span className="text-xs font-medium text-foreground">₹{supplier.creditLimit.toLocaleString()}</span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        supplier.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${supplier.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {supplier.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(supplier)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(supplier.id)} disabled={deletingId === supplier.id} className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50" title="Delete">
                          {deletingId === supplier.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedSupplier && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedSupplier(null)}>
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-500" />
                Supplier Detail
              </h3>
              <button onClick={() => setSelectedSupplier(null)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-bold text-sm">
                  {selectedSupplier.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedSupplier.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedSupplier.contactPerson || 'No contact person'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Email</p>
                  <p className="text-xs font-medium text-foreground">{selectedSupplier.email || '-'}</p>
                </div>
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Phone</p>
                  <p className="text-xs font-medium text-foreground">{selectedSupplier.phone || '-'}</p>
                </div>
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">GST</p>
                  <p className="text-xs font-medium text-foreground">{selectedSupplier.gst || '-'}</p>
                </div>
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Payment Terms</p>
                  <p className="text-xs font-medium text-foreground">{selectedSupplier.paymentTerms || '-'}</p>
                </div>
              </div>

              <div className="bg-card rounded-lg p-2.5 border border-border">
                <p className="text-[10px] text-muted-foreground mb-0.5">Address</p>
                <p className="text-xs font-medium text-foreground">
                  {[selectedSupplier.address, selectedSupplier.city, selectedSupplier.state, selectedSupplier.pincode].filter(Boolean).join(', ') || '-'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Credit Limit</p>
                  <p className="text-sm font-bold text-foreground">₹{selectedSupplier.creditLimit.toLocaleString()}</p>
                </div>
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Outstanding</p>
                  <p className={`text-sm font-bold ${selectedSupplier.outstandingBalance > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                    ₹{selectedSupplier.outstandingBalance.toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedSupplier.lastPurchaseDate && (
                <div className="text-[10px] text-muted-foreground">
                  Last purchase: {new Date(selectedSupplier.lastPurchaseDate).toLocaleDateString()} · Total purchases: {selectedSupplier.totalPurchases}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => { setSelectedSupplier(null); openEdit(selectedSupplier) }} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors">
                Edit Supplier
              </button>
              <button onClick={() => setSelectedSupplier(null)} className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
