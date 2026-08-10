import { Edit2, Loader2, Trash2 } from 'lucide-react'
import type { ConversionRow } from '@/lib/api'

interface ConversionTableProps {
  conversions: Array<ConversionRow>
  loading: boolean
  search: string
  deletingId: string | null
  onEdit: (conv: ConversionRow) => void
  onDelete: (id: string) => void
}

export function ConversionTable({
  conversions,
  loading,
  search,
  deletingId,
  onEdit,
  onDelete,
}: ConversionTableProps) {
  const filtered = conversions.filter(
    (c) =>
      c.parentUnitName.toLowerCase().includes(search.toLowerCase()) ||
      c.childUnitName.toLowerCase().includes(search.toLowerCase()) ||
      String(c.factor).includes(search),
  )

  if (loading && !conversions.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-border rounded-xl">
        <p className="text-sm text-muted-foreground">
          {search
            ? 'No matching conversions'
            : 'No conversions found. Add one to get started.'}
        </p>
      </div>
    )
  }

  return (
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
          {filtered.map((conv) => (
            <tr key={conv.id}>
              <td>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {conv.parentUnitName}
                  </span>
                  <code className="text-[10px] text-muted-foreground font-mono">
                    ({conv.parentUnitSymbol})
                  </code>
                </div>
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {conv.childUnitName}
                  </span>
                  <code className="text-[10px] text-muted-foreground font-mono">
                    ({conv.childUnitSymbol})
                  </code>
                </div>
              </td>
              <td>
                <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono font-semibold text-foreground">
                  {conv.factor}
                </code>
              </td>
              <td>
                <span className="text-xs text-muted-foreground">
                  1 {conv.parentUnitSymbol} = {conv.factor}{' '}
                  {conv.childUnitSymbol}
                </span>
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onEdit(conv)}
                    className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(conv.id)}
                    disabled={deletingId === conv.id}
                    className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === conv.id ? (
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
  )
}
