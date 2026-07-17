import { Edit2, Trash2, Loader2, Package, AlertTriangle, Eye } from "lucide-react"
import type { ProductWithRelations } from "@/lib/api"
import type { DisplayStock } from "@/lib/api"

const statusMeta: Record<string, { color: string; label: string }> = {
  active:        { color: 'bg-emerald-100 text-emerald-700', label: 'Active' },
  inactive:      { color: 'bg-gray-100 text-gray-600', label: 'Inactive' },
  discontinued:  { color: 'bg-red-100 text-red-700', label: 'Discontinued' },
}

interface ProductTableProps {
  products: ProductWithResults[]
  loading: boolean
  search: string
  deletingId: string | null
  onEdit: (product: ProductWithRelations) => void
  onDelete: (id: string) => void
  onViewDetails: (product: ProductWithRelations) => void
}

interface ProductWithResults extends ProductWithRelations {
  displayStock?: DisplayStock
}

export function ProductTable({
  products, loading, search, deletingId,
  onEdit, onDelete, onViewDetails,
}: ProductTableProps) {
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  )

  if (loading && !products.length) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-border rounded-xl">
        <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{search ? 'No matching products' : 'No products yet. Create one to get started.'}</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Base Unit</th>
              <th>Current Stock</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(product => (
              <tr key={product.id} className={product.currentStock <= product.minStock && product.currentStock > 0 ? 'bg-amber-50/50' : ''}>
                <td>
                  <button
                    onClick={() => onViewDetails(product)}
                    className="flex items-center gap-2.5 text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover:shadow-md transition-shadow">
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm group-hover:text-emerald-700 transition-colors">
                        {product.name}
                      </p>
                      {product.description && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{product.description}</p>
                      )}
                    </div>
                  </button>
                </td>
                <td>
                  <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">{product.sku}</code>
                </td>
                <td>
                  <span className="text-xs text-muted-foreground">{product.category}</span>
                </td>
                <td>
                  <span className="text-xs font-medium">{product.baseUnitName}</span>
                  <code className="ml-1 text-[10px] text-muted-foreground font-mono">({product.baseUnitSymbol})</code>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className={`text-sm font-semibold ${product.currentStock <= product.minStock ? 'text-red-600' : 'text-foreground'}`}>
                      {product.displayStock?.displayText ?? `${product.currentStock} ${product.baseUnitSymbol}`}
                    </div>
                    {product.currentStock <= product.minStock && product.currentStock > 0 && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Low stock" />
                    )}
                    {product.currentStock === 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                        Out of stock
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    statusMeta[product.status]?.color ?? 'bg-muted text-muted-foreground'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      product.status === 'active' ? 'bg-emerald-500' :
                      product.status === 'inactive' ? 'bg-gray-400' : 'bg-red-400'
                    }`} />
                    {statusMeta[product.status]?.label ?? product.status}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onViewDetails(product)}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => onEdit(product)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(product.id)}
                      disabled={deletingId === product.id}
                      className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
