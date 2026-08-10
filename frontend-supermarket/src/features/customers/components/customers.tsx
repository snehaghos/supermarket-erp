'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CreditCard,
  Edit2,
  Gift,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react'
import type {
  CreateCustomerInput,
  CustomerRow,
  UpdateCustomerInput,
} from '@/lib/api'
import { FormInput } from '@/components/ui/form-input'
import { customersApi } from '@/lib/api'
import { showApiError, showSuccess } from '@/lib/errors'
import { SlideInPanel, useLayoutMode } from '@/features/layout-mode'

const emptyForm: CreateCustomerInput = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  creditLimit: 0,
}

export function CustomersSection() {
  const { mode } = useLayoutMode()
  const [customers, setCustomers] = useState<Array<CustomerRow>>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateCustomerInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(
    null,
  )

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await customersApi.getAll()
      setCustomers(data)
    } catch {
      setCustomers([])
      // Silently handle missing backend - will display empty table
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const openEdit = (customer: CustomerRow) => {
    setForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      creditLimit: customer.creditLimit,
    })
    setEditingId(customer.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingId) {
        const input: UpdateCustomerInput = {}
        if (form.name) input.name = form.name
        if (form.email) input.email = form.email
        if (form.phone) input.phone = form.phone
        if (form.address) input.address = form.address
        if (form.city) input.city = form.city
        if (form.state) input.state = form.state
        if (form.pincode) input.pincode = form.pincode
        if (form.creditLimit) input.creditLimit = form.creditLimit
        await customersApi.update(editingId, input)
        showSuccess('Customer updated', 'Customer details saved.')
      } else {
        await customersApi.create(form)
        showSuccess('Customer created', 'New customer has been added.')
      }
      resetForm()
      await fetchCustomers()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await customersApi.delete(id)
      showSuccess('Customer deleted', 'The customer has been removed.')
      await fetchCustomers()
    } catch (err) {
      showApiError(err)
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Customers</h2>
          <p className="text-sm text-muted-foreground">
            Manage customers with loyalty points, credit tracking, and purchase
            history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Form Body (shared across all layout modes) */}
      {showForm &&
        (() => {
          const formBody = (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm ${
                      editingId
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
                    }`}
                  >
                    {editingId ? 'E' : 'N'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">
                      {editingId ? 'Edit Customer' : 'New Customer'}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {editingId
                        ? 'Update customer details'
                        : 'Add a new customer'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-6">
                {/* Basic Info */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1 h-4 rounded-full bg-emerald-500" />
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Basic Information
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormInput
                      label="Customer Name"
                      value={form.name}
                      onChange={(v) => setForm({ ...form, name: v })}
                      placeholder="e.g. Priya Sharma"
                      required
                      icon={<User className="w-3.5 h-3.5" />}
                    />
                    <FormInput
                      label="Email"
                      value={form.email ?? ''}
                      onChange={(v) => setForm({ ...form, email: v })}
                      placeholder="customer@example.com"
                      type="email"
                      icon={<Mail className="w-3.5 h-3.5" />}
                    />
                    <FormInput
                      label="Phone"
                      value={form.phone ?? ''}
                      onChange={(v) => setForm({ ...form, phone: v })}
                      placeholder="e.g. +91 98765 43210"
                      icon={<Phone className="w-3.5 h-3.5" />}
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1 h-4 rounded-full bg-blue-500" />
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Address
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <FormInput
                        label="Address"
                        value={form.address ?? ''}
                        onChange={(v) => setForm({ ...form, address: v })}
                        placeholder="Street, area, landmark"
                        icon={<MapPin className="w-3.5 h-3.5" />}
                      />
                    </div>
                    <FormInput
                      label="City"
                      value={form.city ?? ''}
                      onChange={(v) => setForm({ ...form, city: v })}
                      placeholder="e.g. Mumbai"
                    />
                    <FormInput
                      label="State"
                      value={form.state ?? ''}
                      onChange={(v) => setForm({ ...form, state: v })}
                      placeholder="e.g. Maharashtra"
                    />
                    <FormInput
                      label="Pincode"
                      value={form.pincode ?? ''}
                      onChange={(v) => setForm({ ...form, pincode: v })}
                      placeholder="e.g. 400001"
                    />
                  </div>
                </div>

                {/* Financial */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1 h-4 rounded-full bg-amber-500" />
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Financial Details
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormInput
                      label="Credit Limit (₹)"
                      value={String(form.creditLimit ?? 0)}
                      onChange={(v) =>
                        setForm({ ...form, creditLimit: parseFloat(v) || 0 })
                      }
                      type="number"
                      icon={<CreditCard className="w-3.5 h-3.5" />}
                      hint="Maximum credit allowed for this customer"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/30">
                <div />
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetForm}
                    className="px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.name}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-5 py-1.5 rounded-md text-sm font-medium hover:from-emerald-700 hover:to-emerald-600 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingId ? 'Update Customer' : 'Create Customer'}
                  </button>
                </div>
              </div>
            </>
          )

          return mode === 'inline' ? (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {formBody}
            </div>
          ) : mode === 'modal' ? (
            <div
              className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto"
              onClick={resetForm}
            >
              <div
                className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {formBody}
              </div>
            </div>
          ) : (
            <SlideInPanel
              open={showForm}
              onClose={resetForm}
              title={editingId ? 'Edit Customer' : 'New Customer'}
              width="max-w-2xl"
              showHeader={false}
            >
              <div className="bg-card border-b border-border rounded-none">
                {formBody}
              </div>
            </SlideInPanel>
          )
        })()}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="w-full h-9 pl-9 pr-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
        />
      </div>

      {/* Table */}
      {loading && !customers.length ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search
              ? 'No matching customers'
              : 'No customers yet. Add one to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Loyalty</th>
                  <th>Credit Limit</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {customer.name}
                          </p>
                          {customer.city && (
                            <p className="text-[11px] text-muted-foreground">
                              {customer.city}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-0.5">
                        {customer.email && (
                          <p className="text-xs text-muted-foreground">
                            {customer.email}
                          </p>
                        )}
                        {customer.phone && (
                          <p className="text-[11px] text-muted-foreground">
                            {customer.phone}
                          </p>
                        )}
                        {!customer.email && !customer.phone && (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Star
                          className={`w-3.5 h-3.5 ${customer.loyaltyPoints > 0 ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`}
                        />
                        <span className="text-xs font-medium">
                          {customer.loyaltyPoints}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs font-medium text-foreground">
                        ₹{customer.creditLimit.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`text-xs font-medium ${customer.outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
                      >
                        {customer.outstandingBalance > 0
                          ? `₹${customer.outstandingBalance.toLocaleString()}`
                          : 'Nil'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          customer.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${customer.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}
                        />
                        {customer.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openEdit(customer)}
                          className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          disabled={deletingId === customer.id}
                          className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === customer.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
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
      {selectedCustomer && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                Customer Detail
              </h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCustomer.email || 'No email'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Phone
                  </p>
                  <p className="text-xs font-medium text-foreground">
                    {selectedCustomer.phone || '-'}
                  </p>
                </div>
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Loyalty Points
                  </p>
                  <p className="text-xs font-medium text-foreground flex items-center gap-1">
                    <Gift className="w-3 h-3 text-amber-500" />
                    {selectedCustomer.loyaltyPoints}
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-lg p-2.5 border border-border">
                <p className="text-[10px] text-muted-foreground mb-0.5">
                  Address
                </p>
                <p className="text-xs font-medium text-foreground">
                  {[
                    selectedCustomer.address,
                    selectedCustomer.city,
                    selectedCustomer.state,
                    selectedCustomer.pincode,
                  ]
                    .filter(Boolean)
                    .join(', ') || '-'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Credit Limit
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    ₹{selectedCustomer.creditLimit.toLocaleString()}
                  </p>
                </div>
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Outstanding
                  </p>
                  <p
                    className={`text-sm font-bold ${selectedCustomer.outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
                  >
                    {selectedCustomer.outstandingBalance > 0
                      ? `₹${selectedCustomer.outstandingBalance.toLocaleString()}`
                      : '₹0'}
                  </p>
                </div>
              </div>

              {selectedCustomer.lastPurchaseDate && (
                <div className="text-[10px] text-muted-foreground">
                  Last purchase:{' '}
                  {new Date(
                    selectedCustomer.lastPurchaseDate,
                  ).toLocaleDateString()}{' '}
                  · Total purchases: {selectedCustomer.totalPurchases}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedCustomer(null)
                  openEdit(selectedCustomer)
                }}
                className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700 transition-colors"
              >
                Edit Customer
              </button>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
